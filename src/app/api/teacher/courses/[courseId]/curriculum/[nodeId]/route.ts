import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { course as courseSchema } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeacherPayload } from '@/lib/route-auth';
import {
  collectSecondChildGroups,
  computeReleaseGroupDates,
  ensureGroupInheritance,
  parseCurriculumJson,
  parseReleaseGroupDateMap,
  removeNodeFromCurriculum,
  updateNodeInCurriculum,
  stripMediaVaultChildren,
} from '@/lib/teacher-course-builder';

const getCourseForPayload = async (courseId: string, userId: string, role: string) => {
  return db.query.course.findFirst({ where: (c, { eq }) => eq(c.id, courseId) });
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; nodeId: string }> }
) {
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
    const curriculum = ensureGroupInheritance(parseCurriculumJson(course.curriculumJson));

    let invalidMessage: string | null = null;

    const { nodes: patchedCurriculum, updated } = updateNodeInCurriculum(curriculum, resolvedParams.nodeId, (node) => {
      const nextNode = { ...node };

      if (typeof body.title === 'string') {
        const title = body.title.trim();
        if (title) {
          nextNode.title = title;
        }
      }

      if (body.type !== undefined) {
        if (!['folder', 'youtube', 'self-hosted', 'document'].includes(body.type)) {
          invalidMessage = 'Invalid node type.';
          return node;
        }

        if (body.type !== 'folder' && (node.children || []).length > 0) {
          invalidMessage = 'Cannot convert a folder with children into non-folder content.';
          return node;
        }

        nextNode.type = body.type;
      }

      if (typeof body.duration === 'string') {
        nextNode.duration = body.duration.trim() || null;
      }

      if (body.url !== undefined) {
        if (typeof body.url === 'string') {
          nextNode.url = body.url.trim() || null;
        } else if (body.url === null) {
          nextNode.url = null;
        }
      }

      if (typeof body.storagePath === 'string') {
        nextNode.storagePath = body.storagePath.trim() || null;
      }

      if (body.releaseAt !== undefined) {
        if (body.releaseAt === null || body.releaseAt === '') {
          nextNode.releaseAt = null;
        } else {
          const parsed = new Date(body.releaseAt);
          if (Number.isNaN(parsed.getTime())) {
            invalidMessage = 'Invalid override release date.';
            return node;
          }
          nextNode.releaseAt = parsed.toISOString();
        }
      }

      if (nextNode.type === 'folder') {
        nextNode.url = null;
        nextNode.storagePath = null;
      }

      if (nextNode.type !== 'folder' && !nextNode.url) {
        invalidMessage = 'Video/document URL is required for non-folder content.';
        return node;
      }

      return nextNode;
    });

    if (!updated) {
      return NextResponse.json({ error: 'Node not found.' }, { status: 404 });
    }

    if (invalidMessage) {
      return NextResponse.json({ error: invalidMessage }, { status: 400 });
    }

    const normalizedCurriculum = ensureGroupInheritance(patchedCurriculum);
    const groups = collectSecondChildGroups(normalizedCurriculum);
    const existingReleaseDates = parseReleaseGroupDateMap(course.releaseGroupDates);
    const compactReleaseGroupDates = groups.reduce<Record<string, string>>((acc, group) => {
      if (existingReleaseDates[group.id]) {
        acc[group.id] = existingReleaseDates[group.id];
      }
      return acc;
    }, {});

    const rawCurriculumToSave = stripMediaVaultChildren(normalizedCurriculum);

    await db.update(courseSchema).set({
        curriculumJson: JSON.stringify(rawCurriculumToSave),
        releaseGroupDates: JSON.stringify(compactReleaseGroupDates),
      }).where(eq(courseSchema.id, course.id));

    const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
      releaseMode: 'circular',
      releaseStartAt: new Date('2026-06-12T16:00:00Z'),
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; nodeId: string }> }
) {
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
    const { nodes: trimmedCurriculum, removed } = removeNodeFromCurriculum(curriculum, resolvedParams.nodeId);

    if (!removed) {
      return NextResponse.json({ error: 'Node not found.' }, { status: 404 });
    }

    const normalizedCurriculum = ensureGroupInheritance(trimmedCurriculum);
    const groups = collectSecondChildGroups(normalizedCurriculum);
    const existingReleaseDates = parseReleaseGroupDateMap(course.releaseGroupDates);
    const compactReleaseGroupDates = groups.reduce<Record<string, string>>((acc, group) => {
      if (existingReleaseDates[group.id]) {
        acc[group.id] = existingReleaseDates[group.id];
      }
      return acc;
    }, {});

    const rawCurriculumToSave = stripMediaVaultChildren(normalizedCurriculum);

    await db.update(courseSchema).set({
        curriculumJson: JSON.stringify(rawCurriculumToSave),
        releaseGroupDates: JSON.stringify(compactReleaseGroupDates),
      }).where(eq(courseSchema.id, course.id));

    const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
      releaseMode: 'circular',
      releaseStartAt: new Date('2026-06-12T16:00:00Z'),
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
