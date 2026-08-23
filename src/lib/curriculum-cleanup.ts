import {
  parseCurriculumJson,
  removeQuizFromCurriculumTree,
  removeDeletedMediaNodesFromCurriculumTree,
  removeNodeFromCurriculum,
  BuilderCurriculumNode,
} from './teacher-course-builder';

/**
 * Cascade cleans all references when a Quiz is deleted:
 * 1. Deletes CourseQuiz links
 * 2. Deletes VideoLibraryNode records with type='quiz' matching this quizId
 * 3. Removes the quiz from VideoLibraryNode attachments
 * 4. Cleans Course.curriculumJson across all courses
 * 5. Cleans StudentModuleAvailability and LessonProgress records
 */
export async function cleanupDeletedQuiz(supabase: any, quizId: string): Promise<void> {
  if (!quizId) return;
  const targetId = String(quizId).trim();

  try {
    // 1. Delete CourseQuiz links
    await supabase.from('CourseQuiz').delete().eq('quizId', targetId);

    // 2. Delete VideoLibraryNode rows of type 'quiz'
    await supabase
      .from('VideoLibraryNode')
      .delete()
      .eq('type', 'quiz')
      .or(`url.eq.${targetId},id.eq.${targetId}`);

    // 3. Clean up attachments in VideoLibraryNode
    const { data: nodesWithAttachments } = await supabase
      .from('VideoLibraryNode')
      .select('id, attachments')
      .not('attachments', 'is', null);

    if (nodesWithAttachments && nodesWithAttachments.length > 0) {
      for (const node of nodesWithAttachments) {
        if (Array.isArray(node.attachments)) {
          const originalLen = node.attachments.length;
          const filtered = node.attachments.filter((att: any) => {
            return (
              att?.quizId !== targetId &&
              att?.url !== targetId &&
              att?.id !== targetId &&
              att?.id !== `quiz_${targetId}`
            );
          });

          if (filtered.length !== originalLen) {
            await supabase
              .from('VideoLibraryNode')
              .update({
                attachments: filtered.length > 0 ? filtered : null,
                updatedAt: new Date().toISOString(),
              } as any)
              .eq('id', node.id);
          }
        }
      }
    }

    // 4. Scan and update all Courses with curriculumJson
    const { data: courses } = await supabase
      .from('Course')
      .select('id, curriculumJson')
      .not('curriculumJson', 'is', null);

    if (courses && courses.length > 0) {
      for (const course of courses) {
        const parsed = parseCurriculumJson(course.curriculumJson);
        const { nodes: cleanedCurriculum, removed } = removeQuizFromCurriculumTree(parsed, targetId);

        if (removed) {
          await supabase
            .from('Course')
            .update({
              curriculumJson: JSON.stringify(cleanedCurriculum),
              updatedAt: new Date().toISOString(),
            } as any)
            .eq('id', course.id);
        }
      }
    }

    // 5. Clean student availability and progress records
    const nodeVariations = [targetId, `quiz_${targetId}`];
    await supabase
      .from('StudentModuleAvailability')
      .delete()
      .in('lessonNodeId', nodeVariations);

    await supabase
      .from('LessonProgress')
      .delete()
      .in('lessonNodeId', nodeVariations);
  } catch (error) {
    console.error(`[curriculum-cleanup] Error during cleanupDeletedQuiz(${targetId}):`, error);
  }
}

/**
 * Cascade cleans all references when a VideoLibraryNode (folder/video/document/quiz) is deleted:
 * 1. Recursively collects all descendant node IDs, URLs, and child quiz IDs
 * 2. Deletes CourseQuiz records
 * 3. Removes deleted nodes and attachments from Course.curriculumJson across all courses
 * 4. Deletes VideoLibraryNode rows
 * 5. Cleans StudentModuleAvailability and LessonProgress records
 */
export async function cleanupDeletedVideoLibraryNode(supabase: any, rootNodeId: string): Promise<void> {
  if (!rootNodeId) return;

  try {
    // 1. Collect all descendant nodes recursively
    const allNodeIds = new Set<string>([rootNodeId]);
    const allUrls = new Set<string>();
    const childQuizIds = new Set<string>();

    let currentParentIds = [rootNodeId];
    while (currentParentIds.length > 0) {
      const { data: children } = await supabase
        .from('VideoLibraryNode')
        .select('id, type, url, parentId')
        .in('parentId', currentParentIds);

      if (!children || children.length === 0) break;

      const nextParentIds: string[] = [];
      for (const child of children) {
        allNodeIds.add(child.id);
        if (child.url) {
          allUrls.add(child.url);
          if (child.type === 'quiz') {
            childQuizIds.add(child.url);
          }
        }
        if (child.type === 'folder') {
          nextParentIds.push(child.id);
        }
      }
      currentParentIds = nextParentIds;
    }

    const nodeIdList = Array.from(allNodeIds);

    // 2. Clean CourseQuiz links
    if (childQuizIds.size > 0) {
      await supabase.from('CourseQuiz').delete().in('quizId', Array.from(childQuizIds));
    }
    await supabase.from('CourseQuiz').delete().in('curriculumNodeId', nodeIdList);

    // 3. Scan and update all Courses with curriculumJson
    const { data: courses } = await supabase
      .from('Course')
      .select('id, curriculumJson')
      .not('curriculumJson', 'is', null);

    if (courses && courses.length > 0) {
      for (const course of courses) {
        const parsed = parseCurriculumJson(course.curriculumJson);
        const { nodes: cleanedCurriculum, removed } = removeDeletedMediaNodesFromCurriculumTree(
          parsed,
          allNodeIds,
          allUrls
        );

        if (removed) {
          await supabase
            .from('Course')
            .update({
              curriculumJson: JSON.stringify(cleanedCurriculum),
              updatedAt: new Date().toISOString(),
            } as any)
            .eq('id', course.id);
        }
      }
    }

    // 4. Delete the nodes from VideoLibraryNode
    await supabase.from('VideoLibraryNode').delete().in('id', nodeIdList);

    // 5. Clean student availability and progress records
    await supabase.from('StudentModuleAvailability').delete().in('lessonNodeId', nodeIdList);
    await supabase.from('LessonProgress').delete().in('lessonNodeId', nodeIdList);
  } catch (error) {
    console.error(`[curriculum-cleanup] Error during cleanupDeletedVideoLibraryNode(${rootNodeId}):`, error);
  }
}

/**
 * Cleans up references when a specific node is removed from a Course's curriculum tree:
 */
export async function cleanupCourseCurriculumNode(
  supabase: any,
  courseId: string,
  nodeId: string
): Promise<void> {
  if (!courseId || !nodeId) return;

  try {
    // 1. Fetch the course curriculum
    const { data: course } = await supabase
      .from('Course')
      .select('id, curriculumJson')
      .eq('id', courseId)
      .limit(1)
      .maybeSingle();

    if (!course) return;

    // Collect all sub-node IDs being removed
    const collectedIds = new Set<string>([nodeId]);
    const parsed = parseCurriculumJson(course.curriculumJson);

    const findAndCollect = (list: BuilderCurriculumNode[]) => {
      for (const item of list) {
        if (item.id === nodeId) {
          const collectChildren = (children?: BuilderCurriculumNode[]) => {
            if (!children) return;
            for (const child of children) {
              collectedIds.add(child.id);
              if (child.children) collectChildren(child.children);
            }
          };
          collectChildren(item.children);
          return;
        }
        if (item.children) findAndCollect(item.children);
      }
    };
    findAndCollect(parsed);

    const { nodes: cleanedCurriculum, removed } = removeNodeFromCurriculum(parsed, nodeId);

    if (removed) {
      await supabase
        .from('Course')
        .update({
          curriculumJson: JSON.stringify(cleanedCurriculum),
          updatedAt: new Date().toISOString(),
        } as any)
        .eq('id', courseId);
    }

    // 2. Clean CourseQuiz links associated with this course and node
    const idsList = Array.from(collectedIds);
    await supabase
      .from('CourseQuiz')
      .delete()
      .eq('courseId', courseId)
      .in('curriculumNodeId', idsList);

    // 3. Clean Student availability & progress
    await supabase
      .from('StudentModuleAvailability')
      .delete()
      .eq('courseId', courseId)
      .in('lessonNodeId', idsList);

    await supabase
      .from('LessonProgress')
      .delete()
      .eq('courseId', courseId)
      .in('lessonNodeId', idsList);
  } catch (error) {
    console.error(`[curriculum-cleanup] Error during cleanupCourseCurriculumNode(${courseId}, ${nodeId}):`, error);
  }
}

/**
 * Cleans up references when a Quiz is unlinked from a specific Course:
 */
export async function unlinkCourseQuiz(
  supabase: any,
  courseId: string,
  quizId: string
): Promise<void> {
  if (!courseId || !quizId) return;
  const targetQuizId = String(quizId).trim();

  try {
    // 1. Delete CourseQuiz link
    await supabase
      .from('CourseQuiz')
      .delete()
      .eq('courseId', courseId)
      .eq('quizId', targetQuizId);

    // 2. Remove quiz from Course.curriculumJson for this course
    const { data: course } = await supabase
      .from('Course')
      .select('id, curriculumJson, title')
      .eq('id', courseId)
      .limit(1)
      .maybeSingle();

    if (course && course.curriculumJson) {
      const parsed = parseCurriculumJson(course.curriculumJson);
      const { nodes: cleanedCurriculum, removed } = removeQuizFromCurriculumTree(parsed, targetQuizId);

      if (removed) {
        await supabase
          .from('Course')
          .update({
            curriculumJson: JSON.stringify(cleanedCurriculum),
            updatedAt: new Date().toISOString(),
          } as any)
          .eq('id', courseId);
      }
    }

    // 3. Delete any VideoLibraryNode of type 'quiz' under this course's root folder
    if (course?.title) {
      const { data: rootFolder } = await supabase
        .from('VideoLibraryNode')
        .select('id')
        .is('parentId', null)
        .ilike('title', course.title)
        .limit(1)
        .maybeSingle();

      if (rootFolder) {
        // Collect subfolder IDs
        const subfolderIds: string[] = [rootFolder.id];
        let currentParentIds = [rootFolder.id];

        while (currentParentIds.length > 0) {
          const { data: children } = await supabase
            .from('VideoLibraryNode')
            .select('id, type')
            .in('parentId', currentParentIds);

          if (!children || children.length === 0) break;
          const nextIds: string[] = [];
          for (const c of children) {
            if (c.type === 'folder') {
              subfolderIds.push(c.id);
              nextIds.push(c.id);
            }
          }
          currentParentIds = nextIds;
        }

        await supabase
          .from('VideoLibraryNode')
          .delete()
          .eq('type', 'quiz')
          .eq('url', targetQuizId)
          .in('parentId', subfolderIds);
      }
    }

    // 4. Clean student availability and progress
    const nodeVariations = [targetQuizId, `quiz_${targetQuizId}`];
    await supabase
      .from('StudentModuleAvailability')
      .delete()
      .eq('courseId', courseId)
      .in('lessonNodeId', nodeVariations);

    await supabase
      .from('LessonProgress')
      .delete()
      .eq('courseId', courseId)
      .in('lessonNodeId', nodeVariations);
  } catch (error) {
    console.error(`[curriculum-cleanup] Error during unlinkCourseQuiz(${courseId}, ${targetQuizId}):`, error);
  }
}
