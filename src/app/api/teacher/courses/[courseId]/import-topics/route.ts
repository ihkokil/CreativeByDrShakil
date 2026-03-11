import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
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
  if (role === 'admin') {
    return prisma.course.findUnique({ where: { id: courseId } });
  }

  return prisma.course.findFirst({ where: { id: courseId, teacherId: userId } });
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
    releaseAt: null,
    children,
  };
};

const buildCurriculumFromPayloadTopics = (topics: any[]): BuilderCurriculumNode[] => {
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

    normalized.push({
      id: typeof topic.id === 'string' && topic.id.trim() ? topic.id.trim() : createNodeId('main'),
      title,
      type: 'folder',
      releaseGroupId: null,
      releaseAt: null,
      children,
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
      ? buildCurriculumFromPayloadTopics(topics)
      : buildCurriculumFromStarter(mainTopicIds, await getStarterCatalogFromDB());
    const mergedCurriculum = ensureGroupInheritance([...existingCurriculum, ...importedNodes]);

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

    const updatedCourse = await prisma.course.update({
      where: { id: course.id },
      data: {
        curriculumJson: mergedCurriculum as unknown as Prisma.InputJsonValue,
        releaseGroupDates: compactReleaseGroupDates as Prisma.InputJsonValue,
      },
    });

    const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
      releaseMode: updatedCourse.releaseMode,
      releaseStartAt: updatedCourse.releaseStartAt,
      releaseIntervalDays: updatedCourse.releaseIntervalDays,
      releaseGroupsPerWeek: updatedCourse.releaseGroupsPerWeek,
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
