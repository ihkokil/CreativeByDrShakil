export type CurriculumContentType = 'folder' | 'youtube' | 'self-hosted' | 'document';
export type CourseReleaseModeValue = 'fixed_interval' | 'groups_per_week' | 'day_of_week' | 'explicit_dates' | 'instant' | 'circular';

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
  mediaVaultFolderId?: string | null;
  attachments?: any[];
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
  if (!title) return null;

  let finalType: CurriculumContentType = 'folder';
  const parsedType = normalizeNullableText(raw.type) as CurriculumContentType | null;
  if (parsedType && ['folder', 'youtube', 'self-hosted', 'document'].includes(parsedType)) {
    finalType = parsedType;
  }

  const childrenRaw: unknown[] = Array.isArray(raw.children)
    ? raw.children
    : (Array.isArray((raw as any).subTopics) ? (raw as any).subTopics : []);
  const children = childrenRaw
    .map(normalizeNode)
    .filter((node): node is BuilderCurriculumNode => Boolean(node));

  return {
    id,
    title,
    type: finalType,
    duration: normalizeNullableText(raw.duration),
    url: normalizeNullableText(raw.url),
    storagePath: normalizeNullableText(raw.storagePath),
    releaseGroupId: normalizeNullableText(raw.releaseGroupId),
    releaseAt: normalizeNullableText(raw.releaseAt),
    mediaVaultFolderId: normalizeNullableText((raw as any).mediaVaultFolderId),
    attachments: Array.isArray((raw as any).attachments) ? (raw as any).attachments : undefined,
    children,
  };
};

export function parseCurriculumJson(raw: unknown): BuilderCurriculumNode[] {
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];
  return data
    .map(normalizeNode)
    .filter((node): node is BuilderCurriculumNode => Boolean(node));
}

export function stripMediaVaultChildren(nodes: BuilderCurriculumNode[]): BuilderCurriculumNode[] {
  return nodes.map(node => ({
    ...node,
    children: node.mediaVaultFolderId ? [] : (node.children ? stripMediaVaultChildren(node.children) : []),
  }));
}

export function parseReleaseGroupDateMap(raw: unknown): Record<string, string> {
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!isObject(data)) return {};

  return Object.entries(data).reduce<Record<string, string>>((acc, [key, value]) => {
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
    // The top-level topic gets the group.
    const groupId = mainTopic.releaseGroupId || `group_${slugify(mainTopic.title)}_${mainTopic.id.slice(-6)}`;
    
    // All children inherit this group, overriding their own.
    const children = (mainTopic.children || []).map((child) => setReleaseGroupToSubtree(child, groupId));

    return {
      ...mainTopic,
      releaseGroupId: groupId,
      children,
    };
  });
}

export function collectSecondChildGroups(nodes: BuilderCurriculumNode[]): ReleaseGroupSummary[] {
  const groups: ReleaseGroupSummary[] = [];
  let index = 0;

  nodes.forEach((mainTopic) => {
    const id = mainTopic.releaseGroupId || `group_${slugify(mainTopic.title)}_${mainTopic.id.slice(-6)}`;
    groups.push({
      id,
      title: mainTopic.title,
      mainTopicTitle: mainTopic.title,
      nodeId: mainTopic.id,
      index,
    });
    index += 1;
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

/**
 * Pin a date to 10:00 PM GMT+6 (Bangladesh Standard Time) on the same calendar day.
 * 10:00 PM GMT+6 = 16:00 UTC.
 * We shift by 6 hours so we pin to the calendar day in Dhaka, not the calendar day in UTC.
 */
const pinTo10pmBST = (date: Date): Date => {
  const dhakaTime = new Date(date.getTime() + 6 * 60 * 60 * 1000);
  const pinned = new Date(Date.UTC(
    dhakaTime.getUTCFullYear(),
    dhakaTime.getUTCMonth(),
    dhakaTime.getUTCDate(),
    16, // 16:00 UTC = 22:00 GMT+6
    0,
    0,
    0
  ));
  return pinned;
};

const getNextTargetDayDhaka = (date: Date, targetDay: number = 5): Date => {
  const dhaka = new Date(date.getTime() + 6 * 60 * 60 * 1000);
  const day = dhaka.getUTCDay(); 
  const diff = (targetDay - day + 7) % 7;
  dhaka.setUTCDate(dhaka.getUTCDate() + diff);
  return new Date(Date.UTC(
    dhaka.getUTCFullYear(),
    dhaka.getUTCMonth(),
    dhaka.getUTCDate(),
    12, // noon Dhaka time
    0,
    0,
    0
  ));
};

export function computeReleaseGroupDates(
  groups: ReleaseGroupSummary[],
  config: CourseScheduleConfig
): Record<string, string> {
  const dates: Record<string, string> = {};
  const mode = config.releaseMode || 'circular';
  const startDate = normalizeDate(config.releaseStartAt) || new Date();
  const overrideDates = config.releaseGroupDates || {};

  if (mode === 'instant') {
    return dates;
  }

  if (mode === 'circular') {
    const N = groups.length;
    if (N === 0) return dates;
    
    let targetDay = 5; // Friday default
    if (config.releaseDaysOfWeek && config.releaseDaysOfWeek.length > 0) {
      targetDay = config.releaseDaysOfWeek[0];
    }
    
    // Global start date: June 12, 2026 16:00 UTC (10:00 PM GMT+6)
    const GLOBAL_START_DATE = new Date(Date.UTC(2026, 5, 12, 16, 0, 0));
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    
    const startSnapped = getNextTargetDayDhaka(startDate, targetDay);
    const globalSnapped = getNextTargetDayDhaka(GLOBAL_START_DATE, targetDay);
    
    const diffMs = startSnapped.getTime() - globalSnapped.getTime();
    let weeksSinceGlobalStart = Math.round(diffMs / ONE_WEEK_MS);
    if (weeksSinceGlobalStart < 0) weeksSinceGlobalStart = 0;
    
    // Determine the rotation offset — which module index should come first
    // for this student based on which week they joined relative to the global cycle.
    const rotationOffset = weeksSinceGlobalStart % N;
    
    // Assign unlock dates so that:
    //   - The module at rotationOffset unlocks on the student's start week (week 0 for them)
    //   - The next module in rotation order unlocks 1 week later, etc.
    // This guarantees at least one module is always unlocked from enrollment.
    groups.forEach((group, i) => {
      // How many weeks after the student's start week does group i unlock?
      let weeksAfterStart = i - rotationOffset;
      if (weeksAfterStart < 0) weeksAfterStart += N;
      
      const unlockDate = new Date(startSnapped.getTime() + weeksAfterStart * ONE_WEEK_MS);
      
      dates[group.id] = pinTo10pmBST(unlockDate).toISOString();
    });
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

  const getDhakaDay = (d: Date) => {
    const dhakaTime = new Date(d.getTime() + 6 * 60 * 60 * 1000);
    return dhakaTime.getUTCDay();
  };

  if (mode === 'day_of_week') {
    let selectedDays = config.releaseDaysOfWeek || [0];
    if (typeof selectedDays === 'string') {
      try {
        selectedDays = JSON.parse(selectedDays);
      } catch {
        selectedDays = [0];
      }
    }
    if (!Array.isArray(selectedDays) || selectedDays.length === 0) {
      selectedDays = [0];
    }

    groups.forEach((group) => {
      let validDaysHit = 0;
      const currentCheckDate = new Date(startDate);

      if (selectedDays.includes(getDhakaDay(currentCheckDate))) {
        if (group.index === 0) {
          dates[group.id] = currentCheckDate.toISOString();
          return;
        }
        validDaysHit++;
      }

      while (validDaysHit <= group.index) {
        currentCheckDate.setDate(currentCheckDate.getDate() + 1);
        if (selectedDays.includes(getDhakaDay(currentCheckDate))) {
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

  // Pin all computed dates to 10:00 PM GMT+6 (16:00 UTC) on their calendar day.
  // Modules become available at night (10 PM Bangladesh time) on the scheduled date.
  for (const groupId of Object.keys(dates)) {
    const raw = normalizeDate(dates[groupId]);
    if (raw) {
      dates[groupId] = pinTo10pmBST(raw).toISOString();
    }
  }

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

export function stripLockedChildren(nodes: any[]): any[] {
  return nodes.map((node) => {
    if (node.locked) {
      return {
        ...node,
        children: [],
      };
    }
    return {
      ...node,
      children: node.children ? stripLockedChildren(node.children) : undefined,
    };
  });
}

export function sortCurriculumByAvailability(nodes: any[]): any[] {
  return [...nodes].sort((a, b) => {
    const dateA = a.availableAt ? new Date(a.availableAt).getTime() : 0;
    const dateB = b.availableAt ? new Date(b.availableAt).getTime() : 0;
    return dateA - dateB;
  });
}
