import { db } from '@/lib/db';
import { BuilderCurriculumNode, CurriculumContentType } from '@/lib/teacher-course-builder';
import { Prisma } from '@prisma/client';

export async function populateMediaVaultNodes(nodes: BuilderCurriculumNode[]): Promise<BuilderCurriculumNode[]> {
  const [populated] = await populateMediaVaultNodesBatch([nodes]);
  return populated;
}

export async function populateMediaVaultNodesBatch(allNodes: BuilderCurriculumNode[][]): Promise<BuilderCurriculumNode[][]> {
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
  
  allNodes.forEach(nodes => collect(nodes));

  if (folderIds.size === 0) {
    return allNodes;
  }

  // Fetch children from DB for all referenced folders ONCE
  const libraryContents = await db.videoLibraryNode.findMany({
    where: {
        parentId: { in: Array.from(folderIds) }
    },
    orderBy: { sortOrder: 'asc' }
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
      attachments: (item.attachments as any[]) || undefined,
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

  return allNodes.map(nodes => inject(nodes));
}
