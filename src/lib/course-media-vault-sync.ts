import { getSupabaseAdmin } from './db';

/**
 * Finds the root VideoLibraryNode folder for a given Course.
 */
export async function findRootMediaVaultFolderForCourse(supabase: any, course: { id: string; title: string; curriculumJson?: string | null }) {
  if (!course?.title) return null;

  const normalizedTitle = String(course.title).trim();

  // 1. Try exact/case-insensitive match on root folders
  const { data: rootFolder } = await supabase
    .from('VideoLibraryNode')
    .select('*')
    .is('parentId', null)
    .ilike('title', normalizedTitle)
    .limit(1)
    .maybeSingle();

  if (rootFolder) return rootFolder;

  // 2. Try partial / substring match
  const { data: allRootFolders } = await supabase
    .from('VideoLibraryNode')
    .select('*')
    .is('parentId', null);

  if (allRootFolders && allRootFolders.length > 0) {
    const courseTitleLower = normalizedTitle.toLowerCase();
    const matched = allRootFolders.find((f: any) => {
      const folderTitleLower = String(f.title || '').trim().toLowerCase();
      return (
        folderTitleLower === courseTitleLower ||
        courseTitleLower.includes(folderTitleLower) ||
        folderTitleLower.includes(courseTitleLower)
      );
    });

    if (matched) return matched;
  }

  return null;
}

/**
 * Finds the Course corresponding to a Media Vault root folder or module.
 */
export async function findCourseForMediaVaultFolder(supabase: any, rootFolder: { id: string; title: string }) {
  if (!rootFolder?.title) return null;

  const folderTitle = String(rootFolder.title).trim();

  // 1. Try exact/case-insensitive title match
  const { data: exactCourse } = await supabase
    .from('Course')
    .select('id, title, slug, curriculumJson')
    .ilike('title', folderTitle)
    .limit(1)
    .maybeSingle();

  if (exactCourse) return exactCourse;

  // 2. Try substring or fuzzy match across all courses
  const { data: allCourses } = await supabase
    .from('Course')
    .select('id, title, slug, curriculumJson');

  if (allCourses && allCourses.length > 0) {
    const folderTitleLower = folderTitle.toLowerCase();
    const matched = allCourses.find((c: any) => {
      const courseTitleLower = String(c.title || '').trim().toLowerCase();
      return (
        courseTitleLower === folderTitleLower ||
        folderTitleLower.includes(courseTitleLower) ||
        courseTitleLower.includes(folderTitleLower)
      );
    });

    if (matched) return matched;
  }

  return null;
}

/**
 * Recursively collects all descendant folder IDs under a given root folder in Media Vault.
 */
export async function getAllDescendantFolderIds(supabase: any, rootFolderId: string): Promise<string[]> {
  const folderIds: string[] = [rootFolderId];
  let currentParentIds = [rootFolderId];

  while (currentParentIds.length > 0) {
    const { data: children } = await supabase
      .from('VideoLibraryNode')
      .select('id, type')
      .in('parentId', currentParentIds);

    if (!children || children.length === 0) break;

    const nextIds: string[] = [];
    for (const c of children) {
      if (c.type === 'folder') {
        folderIds.push(c.id);
        nextIds.push(c.id);
      }
    }
    currentParentIds = nextIds;
  }

  return folderIds;
}

/**
 * Synchronizes Quiz placement from Quiz page to Media Vault (VideoLibraryNode table).
 */
export async function syncQuizPlacementToMediaVault(
  supabase: any,
  courseId: string,
  quizIds: string[],
  targetNodeId: string | null
) {
  if (!courseId || !quizIds || quizIds.length === 0) return;

  const { data: course } = await supabase
    .from('Course')
    .select('id, title, curriculumJson')
    .eq('id', courseId)
    .limit(1)
    .maybeSingle();

  if (!course) return;

  const nowStr = new Date().toISOString();

  // 1. Find or create root folder in Media Vault for this course
  let rootFolder = await findRootMediaVaultFolderForCourse(supabase, course);
  if (!rootFolder) {
    const rootId = crypto.randomUUID();
    const newRoot = {
      id: rootId,
      title: course.title,
      type: 'folder',
      parentId: null,
      sortOrder: 0,
      createdAt: nowStr,
      updatedAt: nowStr,
    };
    await supabase.from('VideoLibraryNode').insert(newRoot as any);
    rootFolder = newRoot;
  }

  // Collect all folder IDs in this course's Media Vault hierarchy
  const allCourseFolderIds = await getAllDescendantFolderIds(supabase, rootFolder.id);

  // 2. Fetch quiz details
  const { data: quizzes = [] } = await supabase
    .from('Quiz')
    .select('id, title, durationMinutes')
    .in('id', quizIds);

  let destinationFolderId = targetNodeId;

  // If no target module specified, place in "All Quizes" folder
  if (!destinationFolderId) {
    const { data: allQuizzesFolder } = await supabase
      .from('VideoLibraryNode')
      .select('id')
      .eq('parentId', rootFolder.id)
      .eq('type', 'folder')
      .or('title.ilike.All Quizes,title.ilike.All Quizzes')
      .limit(1)
      .maybeSingle();

    if (allQuizzesFolder) {
      destinationFolderId = allQuizzesFolder.id;
    } else {
      const allQId = crypto.randomUUID();
      const newAllQFolder = {
        id: allQId,
        title: 'All Quizes',
        type: 'folder',
        parentId: rootFolder.id,
        sortOrder: 999,
        createdAt: nowStr,
        updatedAt: nowStr,
      };
      await supabase.from('VideoLibraryNode').insert(newAllQFolder as any);
      destinationFolderId = allQId;
    }
  }

  // 3. For each quiz, sync the VideoLibraryNode
  for (const q of quizzes) {
    // Find all existing nodes for this quiz under this course
    const { data: existingNodes = [] } = await supabase
      .from('VideoLibraryNode')
      .select('id, parentId')
      .eq('type', 'quiz')
      .eq('url', q.id)
      .in('parentId', allCourseFolderIds);

    const existingInDest = (existingNodes || []).find((n: any) => n.parentId === destinationFolderId);

    if (!existingInDest) {
      if (existingNodes && existingNodes.length > 0) {
        // Move the first existing node to destination
        const firstNode = existingNodes[0];
        await supabase
          .from('VideoLibraryNode')
          .update({
            parentId: destinationFolderId,
            title: q.title,
            duration: q.durationMinutes ? `${q.durationMinutes} min` : null,
            updatedAt: nowStr,
          } as any)
          .eq('id', firstNode.id);

        // Delete any remaining duplicate nodes in other folders of this course
        if (existingNodes.length > 1) {
          const duplicateIds = existingNodes.slice(1).map((n: any) => n.id);
          await supabase.from('VideoLibraryNode').delete().in('id', duplicateIds);
        }
      } else {
        // Insert new quiz node in destination folder
        const { data: orderRes } = await supabase
          .from('VideoLibraryNode')
          .select('sortOrder')
          .eq('parentId', destinationFolderId)
          .order('sortOrder', { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextOrder = ((orderRes as any)?.sortOrder ?? -1) + 1;

        await supabase.from('VideoLibraryNode').insert({
          id: crypto.randomUUID(),
          title: q.title,
          type: 'quiz',
          url: q.id,
          duration: q.durationMinutes ? `${q.durationMinutes} min` : null,
          parentId: destinationFolderId,
          sortOrder: nextOrder,
          createdAt: nowStr,
          updatedAt: nowStr,
        } as any);
      }
    } else {
      // Already in destination folder, just update title/duration and remove duplicates
      await supabase
        .from('VideoLibraryNode')
        .update({
          title: q.title,
          duration: q.durationMinutes ? `${q.durationMinutes} min` : null,
          updatedAt: nowStr,
        } as any)
        .eq('id', existingInDest.id);

      const duplicates = (existingNodes || []).filter((n: any) => n.id !== existingInDest.id);
      if (duplicates.length > 0) {
        await supabase.from('VideoLibraryNode').delete().in('id', duplicates.map((n: any) => n.id));
      }
    }
  }
}
