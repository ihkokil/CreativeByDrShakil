export type CurriculumContentType = 'folder' | 'youtube' | 'self-hosted' | 'document';
export type CourseReleaseModeValue = 'fixed_interval' | 'groups_per_week' | 'day_of_week' | 'explicit_dates' | 'instant';

export interface LessonAvailabilityOverride {
  lessonNodeId: string;
  availabilityMode: 'inherit' | 'available' | 'locked';
  availableAt?: string | null;
}

export interface BuilderCurriculumNode {
  id: string;
  title: string;
  type: CurriculumContentType;
  duration?: string | null;
  url?: string | null;
  storagePath?: string | null;
  releaseGroupId?: string | null;
  releaseAt?: string | null;
  children?: BuilderCurriculumNode[];
}

export interface BuilderNodeWithAvailability extends BuilderCurriculumNode {
  availableAt?: string | null;
  locked?: boolean;
  availabilityMode?: 'inherit' | 'available' | 'locked';
  availabilityOverrideAt?: string | null;
  completed?: boolean;
  children?: BuilderNodeWithAvailability[];
}

export interface ReleaseGroupSummary {
  id: string;
  title: string;
  mainTopicTitle: string;
  nodeId: string;
  index: number;
}

export interface CourseScheduleConfig {
  releaseMode?: CourseReleaseModeValue | null;
  releaseStartAt?: string | Date | null;
  releaseIntervalDays?: number | null;
  releaseGroupsPerWeek?: number | null;
  releaseDaysOfWeek?: number[] | null;
  releaseGroupDates?: Record<string, string>;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function createNodeId(prefix = 'node'): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeNullableText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeNode = (raw: unknown): BuilderCurriculumNode | null => {
  if (!isObject(raw)) return null;

  const id = normalizeNullableText(raw.id) || createNodeId('node');
  const title = normalizeNullableText(raw.title);
  const rawType = normalizeNullableText(raw.type) as CurriculumContentType | null;

  if (!title || !rawType) return null;
  if (!['folder', 'youtube', 'self-hosted', 'document'].includes(rawType)) return null;

  const childrenRaw = Array.isArray(raw.children) ? raw.children : [];
  const children = childrenRaw
    .map(normalizeNode)
    .filter((node): node is BuilderCurriculumNode => Boolean(node));

  return {
    id,
    title,
    type: rawType,
    duration: normalizeNullableText(raw.duration),
    url: normalizeNullableText(raw.url),
    storagePath: normalizeNullableText(raw.storagePath),
    releaseGroupId: normalizeNullableText(raw.releaseGroupId),
    releaseAt: normalizeNullableText(raw.releaseAt),
    children,
  };
};

export function parseCurriculumJson(raw: unknown): BuilderCurriculumNode[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeNode)
    .filter((node): node is BuilderCurriculumNode => Boolean(node));
}

export function parseReleaseGroupDateMap(raw: unknown): Record<string, string> {
  if (!isObject(raw)) return {};

  return Object.entries(raw).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value !== 'string') return acc;
    const normalizedKey = key.trim();
    if (!normalizedKey) return acc;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return acc;

    acc[normalizedKey] = parsed.toISOString();
    return acc;
  }, {});
}

const setReleaseGroupToSubtree = (node: BuilderCurriculumNode, releaseGroupId: string): BuilderCurriculumNode => {
  const children = (node.children || []).map((child) => setReleaseGroupToSubtree(child, releaseGroupId));
  return {
    ...node,
    releaseGroupId,
    children,
  };
};

export function ensureGroupInheritance(nodes: BuilderCurriculumNode[]): BuilderCurriculumNode[] {
  return nodes.map((mainTopic) => {
    const children = (mainTopic.children || []).map((secondChild) => {
      const groupId = secondChild.releaseGroupId || `group_${slugify(mainTopic.title)}_${slugify(secondChild.title)}_${secondChild.id.slice(-6)}`;
      return setReleaseGroupToSubtree(secondChild, groupId);
    });

    return {
      ...mainTopic,
      releaseGroupId: null,
      children,
    };
  });
}

export function collectSecondChildGroups(nodes: BuilderCurriculumNode[]): ReleaseGroupSummary[] {
  const groups: ReleaseGroupSummary[] = [];
  let index = 0;

  nodes.forEach((mainTopic) => {
    (mainTopic.children || []).forEach((secondChild) => {
      const id = secondChild.releaseGroupId || `group_${slugify(mainTopic.title)}_${slugify(secondChild.title)}_${secondChild.id.slice(-6)}`;
      groups.push({
        id,
        title: secondChild.title,
        mainTopicTitle: mainTopic.title,
        nodeId: secondChild.id,
        index,
      });
      index += 1;
    });
  });

  return groups;
}

export function findNodePath(nodes: BuilderCurriculumNode[], nodeId: string): BuilderCurriculumNode[] | null {
  const visit = (list: BuilderCurriculumNode[], trail: BuilderCurriculumNode[]): BuilderCurriculumNode[] | null => {
    for (const node of list) {
      const nextTrail = [...trail, node];
      if (node.id === nodeId) {
        return nextTrail;
      }

      const found = visit(node.children || [], nextTrail);
      if (found) {
        return found;
      }
    }

    return null;
  };

  return visit(nodes, []);
}

export function assignReleaseGroupForInsertion(
  nodes: BuilderCurriculumNode[],
  parentId: string | null,
  newNode: BuilderCurriculumNode
): BuilderCurriculumNode {
  if (!parentId) return newNode;

  const path = findNodePath(nodes, parentId);
  if (!path) return newNode;

  const parent = path[path.length - 1];
  if (parent.type !== 'folder') return newNode;

  let releaseGroupId: string | null = null;
  if (path.length === 1) {
    releaseGroupId = `group_${slugify(parent.title)}_${slugify(newNode.title)}_${newNode.id.slice(-6)}`;
  } else {
    releaseGroupId = parent.releaseGroupId || null;
  }

  if (!releaseGroupId) return newNode;
  return setReleaseGroupToSubtree(newNode, releaseGroupId);
}

export function addNodeToCurriculum(
  nodes: BuilderCurriculumNode[],
  parentId: string | null,
  newNode: BuilderCurriculumNode
): { nodes: BuilderCurriculumNode[]; added: boolean } {
  if (!parentId) {
    return { nodes: [...nodes, newNode], added: true };
  }

  let added = false;

  const visit = (list: BuilderCurriculumNode[]): BuilderCurriculumNode[] =>
    list.map((node) => {
      if (node.id === parentId) {
        if (node.type !== 'folder') {
          return node;
        }

        added = true;
        return {
          ...node,
          children: [...(node.children || []), newNode],
        };
      }

      if (!node.children?.length) {
        return node;
      }

      return {
        ...node,
        children: visit(node.children),
      };
    });

  return { nodes: visit(nodes), added };
}

export function updateNodeInCurriculum(
  nodes: BuilderCurriculumNode[],
  nodeId: string,
  updater: (node: BuilderCurriculumNode) => BuilderCurriculumNode
): { nodes: BuilderCurriculumNode[]; updated: boolean } {
  let updated = false;

  const visit = (list: BuilderCurriculumNode[]): BuilderCurriculumNode[] =>
    list.map((node) => {
      if (node.id === nodeId) {
        updated = true;
        return updater(node);
      }

      if (!node.children?.length) {
        return node;
      }

      return {
        ...node,
        children: visit(node.children),
      };
    });

  return { nodes: visit(nodes), updated };
}

export function removeNodeFromCurriculum(
  nodes: BuilderCurriculumNode[],
  nodeId: string
): { nodes: BuilderCurriculumNode[]; removed: boolean } {
  let removed = false;

  const visit = (list: BuilderCurriculumNode[]): BuilderCurriculumNode[] => {
    const next: BuilderCurriculumNode[] = [];

    list.forEach((node) => {
      if (node.id === nodeId) {
        removed = true;
        return;
      }

      if (!node.children?.length) {
        next.push(node);
        return;
      }

      next.push({
        ...node,
        children: visit(node.children),
      });
    });

    return next;
  };

  return { nodes: visit(nodes), removed };
}

const normalizeDate = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export function computeReleaseGroupDates(
  groups: ReleaseGroupSummary[],
  config: CourseScheduleConfig
): Record<string, string> {
  const dates: Record<string, string> = {};
  const mode = config.releaseMode || null;
  const startDate = normalizeDate(config.releaseStartAt) || new Date();
  const overrideDates = config.releaseGroupDates || {};

  if (mode === 'instant') {
    return dates;
  }

  if (mode === 'fixed_interval') {
    const intervalDays = Math.max(1, config.releaseIntervalDays || 7);
    groups.forEach((group) => {
      const date = new Date(startDate.getTime() + group.index * intervalDays * 24 * 60 * 60 * 1000);
      dates[group.id] = date.toISOString();
    });
  }

  if (mode === 'groups_per_week') {
    const groupsPerWeek = config.releaseGroupsPerWeek === 3 ? 3 : 2;
    const stepMs = (7 * 24 * 60 * 60 * 1000) / groupsPerWeek;
    groups.forEach((group) => {
      const date = new Date(startDate.getTime() + group.index * stepMs);
      dates[group.id] = date.toISOString();
    });
  }

  if (mode === 'day_of_week') {
    const selectedDays = config.releaseDaysOfWeek || [0];
    groups.forEach((group) => {
      let validDaysHit = 0;
      const currentCheckDate = new Date(startDate);

      if (selectedDays.includes(currentCheckDate.getDay())) {
        if (group.index === 0) {
          dates[group.id] = currentCheckDate.toISOString();
          return;
        }
        validDaysHit++;
      }

      while (validDaysHit <= group.index) {
        currentCheckDate.setDate(currentCheckDate.getDate() + 1);
        if (selectedDays.includes(currentCheckDate.getDay())) {
          if (validDaysHit === group.index) {
            dates[group.id] = currentCheckDate.toISOString();
            return;
          }
          validDaysHit++;
        }
      }
    });
  }

  if (mode === 'explicit_dates') {
    groups.forEach((group) => {
      const explicit = normalizeDate(overrideDates[group.id]);
      if (explicit) {
        dates[group.id] = explicit.toISOString();
      }
    });
  }

  // For non-explicit modes, do NOT apply the stored releaseGroupDates map on top of
  // the computed schedule — doing so would overwrite correct interval/week/day-of-week
  // dates with stale admin-preview dates, making all modules appear unlocked.

  return dates;
}

const resolveAvailableAt = (
  path: BuilderCurriculumNode[],
  computedGroupDates: Record<string, string>,
  override?: LessonAvailabilityOverride | null
): string | null => {
  if (override?.availabilityMode === 'available') {
    const overrideDate = normalizeDate(override.availableAt || null);
    return overrideDate ? overrideDate.toISOString() : null;
  }

  for (let index = path.length - 1; index >= 0; index -= 1) {
    const overrideDate = normalizeDate(path[index].releaseAt || null);
    if (overrideDate) {
      return overrideDate.toISOString();
    }
  }

  for (let index = path.length - 1; index >= 0; index -= 1) {
    const groupId = path[index].releaseGroupId;
    if (groupId && computedGroupDates[groupId]) {
      return computedGroupDates[groupId];
    }
  }

  return null;
};

export function annotateCurriculumAvailability(
  nodes: BuilderCurriculumNode[],
  computedGroupDates: Record<string, string>,
  now = new Date(),
  overrides: LessonAvailabilityOverride[] = []
): BuilderNodeWithAvailability[] {
  const nowMs = now.getTime();
  const overrideMap = new Map(overrides.map((override) => [override.lessonNodeId, override]));

  const findNearestOverride = (path: BuilderCurriculumNode[]): LessonAvailabilityOverride | null => {
    for (let index = path.length - 1; index >= 0; index -= 1) {
      const candidate = overrideMap.get(path[index].id);
      if (candidate) {
        return candidate;
      }
    }

    return null;
  };

  const visit = (list: BuilderCurriculumNode[], trail: BuilderCurriculumNode[]): BuilderNodeWithAvailability[] =>
    list.map((node) => {
      const path = [...trail, node];
      const override = findNearestOverride(path);
      const availableAt = resolveAvailableAt(path, computedGroupDates, override);
      const availableAtDate = normalizeDate(availableAt);
      const locked = override?.availabilityMode === 'locked'
        ? true
        : Boolean(availableAtDate && availableAtDate.getTime() > nowMs);

      return {
        ...node,
        availableAt,
        locked,
        availabilityMode: override?.availabilityMode || 'inherit',
        availabilityOverrideAt: override?.availableAt || null,
        children: visit(node.children || [], path),
      };
    });

  return visit(nodes, []);
}

export function collectVideoNodes(nodes: BuilderCurriculumNode[]): BuilderCurriculumNode[] {
  const videos: BuilderCurriculumNode[] = [];

  const visit = (list: BuilderCurriculumNode[]) => {
    list.forEach((node) => {
      if (node.type !== 'folder') {
        videos.push(node);
      }
      if (node.children?.length) {
        visit(node.children);
      }
    });
  };

  visit(nodes);
  return videos;
}

export function countLessons(nodes: BuilderCurriculumNode[]): number {
  return collectVideoNodes(nodes).length;
}
