import { db } from '@/lib/db';
import { BuilderCurriculumNode, CurriculumContentType } from '@/lib/teacher-course-builder';

export async function populateMediaVaultNodes(nodes: BuilderCurriculumNode[]): Promise<BuilderCurriculumNode[]> {
  const folderIds = new Set<string>();
  const collect = (list: BuilderCurriculumNode[]) => {
    list.forEach(node => {
      if (node.mediaVaultFolderId) {
        folderIds.add(node.mediaVaultFolderId);
      }
      if (node.children) {
        collect(node.children);
      }
    });
  };
  
  collect(nodes);

  if (folderIds.size === 0) {
    return nodes;
  }

  // Fetch children from DB for all referenced folders
  const libraryContents = await db.query.videoLibraryNode.findMany({
    where: (n, { inArray }) => inArray(n.parentId, Array.from(folderIds)),
    orderBy: (n, { asc }) => asc(n.sortOrder)
  });

  const childrenMap: Record<string, BuilderCurriculumNode[]> = {};
  for (const item of libraryContents) {
    if (!item.parentId) continue;
    if (!childrenMap[item.parentId]) {
      childrenMap[item.parentId] = [];
    }
    childrenMap[item.parentId].push({
      id: item.id,
      title: item.title,
      type: item.type as CurriculumContentType,
      url: item.url,
      duration: item.duration,
      storagePath: null,
      releaseGroupId: null,
      children: [], // Flat list for now
    });
  }

  const inject = (list: BuilderCurriculumNode[]): BuilderCurriculumNode[] => {
    return list.map(node => {
      let newChildren = node.children ? inject(node.children) : [];
      if (node.mediaVaultFolderId && childrenMap[node.mediaVaultFolderId]) {
        // Replace children entirely with the dynamically fetched ones
        newChildren = childrenMap[node.mediaVaultFolderId];
      }
      return {
        ...node,
        children: newChildren
      };
    });
  };

  return inject(nodes);
}
