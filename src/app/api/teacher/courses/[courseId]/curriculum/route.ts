import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireTeacherPayload } from '@/lib/route-auth';
import {
  BuilderCurriculumNode,
  addNodeToCurriculum,
  assignReleaseGroupForInsertion,
  collectSecondChildGroups,
  computeReleaseGroupDates,
  createNodeId,
  ensureGroupInheritance,
  findNodePath,
  parseCurriculumJson,
  parseReleaseGroupDateMap,
} from '@/lib/teacher-course-builder';

const getCourseForPayload = async (courseId: string, userId: string, role: string) => {
  if (role === 'admin') {
    return prisma.course.findUnique({ where: { id: courseId } });
  }

  return prisma.course.findFirst({ where: { id: courseId, teacherId: userId } });
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
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

    const curriculum = ensureGroupInheritance(parseCurriculumJson(course.curriculumJson));
    const groups = collectSecondChildGroups(curriculum);
    const releaseGroupDates = parseReleaseGroupDateMap(course.releaseGroupDates);
    const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
      releaseMode: course.releaseMode,
      releaseStartAt: course.releaseStartAt,
      releaseIntervalDays: course.releaseIntervalDays,
      releaseGroupsPerWeek: course.releaseGroupsPerWeek,
      releaseGroupDates,
    });

    return NextResponse.json({
      curriculum,
      groups,
      releaseGroupDates,
      computedReleaseGroupDates,
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        status: course.status,
        releaseMode: course.releaseMode,
        releaseStartAt: course.releaseStartAt,
        releaseIntervalDays: course.releaseIntervalDays,
        releaseGroupsPerWeek: course.releaseGroupsPerWeek,
        timezone: course.timezone,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

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
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const type = typeof body.type === 'string' ? body.type.trim() : '';
    const parentId = typeof body.parentId === 'string' && body.parentId.trim() ? body.parentId : null;

    if (!title) {
      return NextResponse.json({ error: 'Node title is required.' }, { status: 400 });
    }

    if (!['folder', 'youtube', 'self-hosted', 'document'].includes(type)) {
      return NextResponse.json({ error: 'Invalid node type.' }, { status: 400 });
    }

    const curriculum = ensureGroupInheritance(parseCurriculumJson(course.curriculumJson));

    if (parentId) {
      const parentPath = findNodePath(curriculum, parentId);
      if (!parentPath) {
        return NextResponse.json({ error: 'Parent node not found.' }, { status: 404 });
      }

      const parent = parentPath[parentPath.length - 1];
      if (parent.type !== 'folder') {
        return NextResponse.json({ error: 'New content can only be inserted into folders.' }, { status: 400 });
      }
    }

    const newNode: BuilderCurriculumNode = {
      id: createNodeId(type === 'folder' ? 'folder' : 'video'),
      title,
      type: type as BuilderCurriculumNode['type'],
      duration: typeof body.duration === 'string' && body.duration.trim() ? body.duration.trim() : null,
      url: typeof body.url === 'string' && body.url.trim() ? body.url.trim() : null,
      storagePath: typeof body.storagePath === 'string' && body.storagePath.trim() ? body.storagePath.trim() : null,
      releaseAt: typeof body.releaseAt === 'string' && body.releaseAt.trim() ? new Date(body.releaseAt).toISOString() : null,
      releaseGroupId: null,
      children: [],
    };

    if (newNode.type !== 'folder' && !newNode.url) {
      return NextResponse.json({ error: 'Video or document URL is required.' }, { status: 400 });
    }

    const nodeWithGroup = assignReleaseGroupForInsertion(curriculum, parentId, newNode);
    const { nodes: insertedCurriculum, added } = addNodeToCurriculum(curriculum, parentId, nodeWithGroup);

    if (!added) {
      return NextResponse.json({ error: 'Failed to insert node into curriculum.' }, { status: 400 });
    }

    const normalizedCurriculum = ensureGroupInheritance(insertedCurriculum);
    const groups = collectSecondChildGroups(normalizedCurriculum);

    const existingReleaseDates = parseReleaseGroupDateMap(course.releaseGroupDates);
    const compactReleaseGroupDates = groups.reduce<Record<string, string>>((acc, group) => {
      if (existingReleaseDates[group.id]) {
        acc[group.id] = existingReleaseDates[group.id];
      }
      return acc;
    }, {});

    const updatedCourse = await prisma.course.update({
      where: { id: course.id },
      data: {
        curriculumJson: normalizedCurriculum as unknown as Prisma.InputJsonValue,
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
      curriculum: normalizedCurriculum,
      groups,
      releaseGroupDates: compactReleaseGroupDates,
      computedReleaseGroupDates,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
