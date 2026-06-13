import prisma from '@/lib/prisma';
import {
  BuilderCurriculumNode,
  createNodeId,
  slugify,
} from '@/lib/teacher-course-builder';

interface StarterVideo {
  title: string;
  url: string;
}

interface StarterSubTopic {
  id: string;
  title: string;
  videos: StarterVideo[];
  forceFolder?: boolean;
}

export interface StarterMainTopic {
  id: string;
  title: string;
  subTopics: StarterSubTopic[];
}

/* ──────────────────────────────────────────────
   Fetch the starter catalog from VIdeoLibraryNode
   ────────────────────────────────────────────── */

interface FlatDBNode {
  id: string;
  title: string;
  type: string;
  url: string | null;
  parentId: string | null;
  sortOrder: number;
}

function buildSubTree(parentId: string, allNodes: FlatDBNode[]): FlatDBNode[] {
  const children = allNodes.filter((n) => n.parentId === parentId);
  const result: FlatDBNode[] = [];
  for (const child of children) {
    result.push(child);
    result.push(...buildSubTree(child.id, allNodes));
  }
  return result;
}

/**
 * Convert VideoLibraryNode rows into the StarterMainTopic shape expected by
 * the rest of the course-builder code.
 *
 * Hierarchy: root folder → second-level children (folders or videos) → nested videos
 *
 * Each root folder becomes a StarterMainTopic.
 * Each direct child of a root folder becomes a StarterSubTopic.
 *   - If the child is a folder, its descendant videos are collected.
 *   - If the child is a video, it becomes a single-video sub-topic.
 */
export async function getStarterCatalogFromDB(): Promise<StarterMainTopic[]> {
  const allNodes = await prisma.videoLibraryNode.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      title: true,
      type: true,
      url: true,
      parentId: true,
      sortOrder: true,
    },
  });

  const rootFolders = allNodes.filter((n) => n.parentId === null && n.type === 'folder');

  return rootFolders.map((root) => {
    const directChildren = allNodes
      .filter((n) => n.parentId === root.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const subTopics: StarterSubTopic[] = directChildren.map((child) => {
      if (child.type !== 'folder') {
        // Single video at second-child level
        return {
          id: child.id,
          title: child.title,
          videos: [{ title: child.title, url: child.url || '' }],
        };
      }

      // Folder — collect ALL descendant videos
      const descendants = buildSubTree(child.id, allNodes);
      const videoDescendants = descendants.filter((d) => d.type !== 'folder');

      return {
        id: child.id,
        title: child.title,
        videos: videoDescendants.map((v) => ({
          title: v.title,
          url: v.url || '',
        })),
        forceFolder: videoDescendants.length > 1 ? undefined : false,
      };
    });

    return {
      id: root.id,
      title: root.title,
      subTopics,
    };
  });
}

/* ──────────────────────────────────────────────
   Summary (for topic picker UI)
   ────────────────────────────────────────────── */

export async function getStarterCatalogSummary() {
  const catalog = await getStarterCatalogFromDB();
  return catalog.map((topic) => ({
    id: topic.id,
    title: topic.title,
    subTopicCount: topic.subTopics.length,
    videoCount: topic.subTopics.reduce((total, sub) => total + sub.videos.length, 0),
  }));
}

/* ──────────────────────────────────────────────
   Build curriculum nodes from selected topics
   ────────────────────────────────────────────── */

const applyGroupToSubtree = (node: BuilderCurriculumNode, groupId: string): BuilderCurriculumNode => ({
  ...node,
  releaseGroupId: groupId,
  children: (node.children || []).map((child) => applyGroupToSubtree(child, groupId)),
});

const createVideoNode = (video: StarterVideo): BuilderCurriculumNode => ({
  id: createNodeId('video'),
  title: video.title,
  type: 'youtube',
  url: video.url,
  duration: null,
  releaseAt: null,
  releaseGroupId: null,
  children: [],
});

export function buildCurriculumFromStarter(
  mainTopicIds: string[],
  catalog: StarterMainTopic[]
): BuilderCurriculumNode[] {
  const selected = catalog.filter((topic) => mainTopicIds.includes(topic.id));

  return selected.map((mainTopic) => {
    const mainNode: BuilderCurriculumNode = {
      id: createNodeId(`main_${slugify(mainTopic.title)}`),
      title: mainTopic.title,
      type: 'folder',
      releaseGroupId: null,
      releaseAt: null,
      children: [],
    };

    const children: BuilderCurriculumNode[] = mainTopic.subTopics.flatMap((subTopic) => {
      const groupId = `group_${slugify(mainTopic.title)}_${slugify(subTopic.title)}_${createNodeId('grp').slice(-6)}`;
      const shouldFlatten = !subTopic.forceFolder;

      if (shouldFlatten) {
        return subTopic.videos.map((video) => {
          const videoNode: BuilderCurriculumNode = {
            ...createVideoNode(video),
            title: video.title || subTopic.title,
          };
          return applyGroupToSubtree(videoNode, groupId);
        });
      }

      const folderNode: BuilderCurriculumNode = {
        id: createNodeId(`sub_${slugify(subTopic.title)}`),
        title: subTopic.title,
        type: 'folder',
        releaseAt: null,
        releaseGroupId: groupId,
        children: subTopic.videos.map((video) => createVideoNode(video)),
      };

      return [applyGroupToSubtree(folderNode, groupId)];
    });

    return {
      ...mainNode,
      children,
    };
  });
}
