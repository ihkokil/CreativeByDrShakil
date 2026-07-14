import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { course as courseSchema } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeacherPayload } from '@/lib/route-auth';
import {
  BuilderCurriculumNode,
  collectSecondChildGroups,
  computeReleaseGroupDates,
  createNodeId,
  ensureGroupInheritance,
  parseCurriculumJson,
  parseReleaseGroupDateMap,
} from '@/lib/teacher-course-builder';
import { buildCurriculumFromStarter, getStarterCatalogFromDB } from '@/lib/starter-catalog';

const getCourseForPayload = async (courseId: string, userId: string, role: string) => {
  return db.query.course.findFirst({ where: (c, { eq }) => eq(c.id, courseId) });
};

const buildNodeFromPayload = (raw: any): BuilderCurriculumNode | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const type = typeof raw.type === 'string' ? raw.type.trim() : '';
  if (!title || !['folder', 'youtube', 'self-hosted', 'document'].includes(type)) {
    return null;
  }

  const childrenSource = Array.isArray(raw.items) ? raw.items : Array.isArray(raw.children) ? raw.children : [];
  const children = childrenSource
    .map(buildNodeFromPayload)
    .filter((node: BuilderCurriculumNode | null): node is BuilderCurriculumNode => Boolean(node));

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : createNodeId(type === 'folder' ? 'folder' : 'video'),
    title,
    type: type as BuilderCurriculumNode['type'],
    url: typeof raw.url === 'string' && raw.url.trim() ? raw.url.trim() : null,
    duration: typeof raw.duration === 'string' && raw.duration.trim() ? raw.duration.trim() : null,
    storagePath: typeof raw.storagePath === 'string' && raw.storagePath.trim() ? raw.storagePath.trim() : null,
    releaseGroupId: null,
    releaseAt: typeof raw.releaseAt === 'string' && raw.releaseAt.trim() ? raw.releaseAt.trim() : null,
    children,
  };
};

const buildCurriculumFromPayloadTopics = (topics: any[], existingCurriculum: BuilderCurriculumNode[]): BuilderCurriculumNode[] => {
  const normalized: BuilderCurriculumNode[] = [];

  topics.forEach((topic) => {
    const title = typeof topic.title === 'string' ? topic.title.trim() : '';
    if (!title) {
      return;
    }

    const subTopicsSource = Array.isArray(topic.subTopics) ? topic.subTopics : [];
    const children = subTopicsSource
      .map(buildNodeFromPayload)
      .filter((node: BuilderCurriculumNode | null): node is BuilderCurriculumNode => Boolean(node));

    const mediaVaultFolderId = typeof topic.mediaVaultFolderId === 'string' && topic.mediaVaultFolderId.trim() ? topic.mediaVaultFolderId.trim() : null;

    const existing = existingCurriculum.find(e => 
       (mediaVaultFolderId && e.mediaVaultFolderId === mediaVaultFolderId) ||
       (!mediaVaultFolderId && e.title === title)
    );

    normalized.push({
      id: existing ? existing.id : createNodeId('main'),
      title,
      type: 'folder',
      mediaVaultFolderId,
      releaseGroupId: existing ? existing.releaseGroupId : null,
      releaseAt: existing ? (existing.releaseAt || null) : (typeof topic.releaseAt === 'string' && topic.releaseAt.trim() ? topic.releaseAt.trim() : null),
      children: mediaVaultFolderId ? [] : children,
    });
  });

  return normalized;
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const resolvedParams = await params;
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const course = await getCourseForPayload(resolvedParams.courseId, payload.sub, payload.role);
    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const body = await request.json();
    const mainTopicIds = Array.isArray(body.mainTopicIds)
      ? body.mainTopicIds.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
    const topics = Array.isArray(body.topics) ? body.topics : [];

    if (!mainTopicIds.length && !topics.length) {
      return NextResponse.json({ error: 'At least one main topic must be selected.' }, { status: 400 });
    }

    const existingCurriculum = parseCurriculumJson(course.curriculumJson);
    const importedNodes = topics.length
      ? buildCurriculumFromPayloadTopics(topics, existingCurriculum)
      : buildCurriculumFromStarter(mainTopicIds, await getStarterCatalogFromDB());

    // If topics were provided explicitly (from the wizard), they represent the FULL desired state of selected modules.
    // If only mainTopicIds were provided (from the standalone builder), they represent NEW modules to append.
    const mergedCurriculum = ensureGroupInheritance(
      topics.length ? importedNodes : [...existingCurriculum, ...importedNodes]
    );

    const groups = collectSecondChildGroups(mergedCurriculum);
    const releaseGroupDates = parseReleaseGroupDateMap(course.releaseGroupDates);
    groups.forEach((group) => {
      if (!releaseGroupDates[group.id]) {
        releaseGroupDates[group.id] = '';
      }
    });

    const compactReleaseGroupDates = Object.entries(releaseGroupDates).reduce<Record<string, string>>((acc, [key, value]) => {
      if (value) {
        acc[key] = value;
      }
      return acc;
    }, {});

    await db.update(courseSchema).set({
        curriculumJson: JSON.stringify(mergedCurriculum),
        releaseGroupDates: JSON.stringify(compactReleaseGroupDates),
      }).where(eq(courseSchema.id, course.id));

    const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
      releaseMode: course.releaseMode,
      releaseStartAt: course.releaseStartAt || course.courseStartDate,
      releaseIntervalDays: course.releaseIntervalDays,
      releaseGroupsPerWeek: course.releaseGroupsPerWeek,
      releaseGroupDates: compactReleaseGroupDates,
    });

    return NextResponse.json({
      curriculum: mergedCurriculum,
      groups,
      releaseGroupDates: compactReleaseGroupDates,
      computedReleaseGroupDates,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
