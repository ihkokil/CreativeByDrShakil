import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';
import { parseCurriculumJson, BuilderCurriculumNode, createNodeId } from '@/lib/teacher-course-builder';
import { cleanupCourseCurriculumNode } from '@/lib/curriculum-cleanup';

function findNodeById(nodes: BuilderCurriculumNode[], nodeId: string): BuilderCurriculumNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    if (node.children) {
      const found = findNodeById(node.children, nodeId);
      if (found) return found;
    }
  }
  return null;
}

function updateNodeById(nodes: BuilderCurriculumNode[], nodeId: string, updater: (node: BuilderCurriculumNode) => BuilderCurriculumNode): BuilderCurriculumNode[] {
  return nodes.map(node => {
    if (node.id === nodeId) return updater(node);
    if (node.children) {
      return { ...node, children: updateNodeById(node.children, nodeId, updater) };
    }
    return node;
  });
}

function removeNodeById(nodes: BuilderCurriculumNode[], nodeId: string): BuilderCurriculumNode[] {
  return nodes
    .filter(node => node.id !== nodeId)
    .map(node => {
      if (node.children) {
        return { ...node, children: removeNodeById(node.children, nodeId) };
      }
      return node;
    });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; nodeId: string }> }
) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId, nodeId } = await params;
    const supabase = getSupabaseAdmin();

    const { data: course }: { data: any } = await supabase
      .from('Course')
      .select('id, curriculumJson')
      .eq('id', courseId)
      .limit(1)
      .maybeSingle();

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const curriculum = parseCurriculumJson(course.curriculumJson);
    const node = findNodeById(curriculum, nodeId);

    if (!node) {
      return NextResponse.json({ error: 'Node not found.' }, { status: 404 });
    }

    return NextResponse.json({ node });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; nodeId: string }> }
) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId, nodeId } = await params;
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    const { data: course }: { data: any } = await supabase
      .from('Course')
      .select('id, curriculumJson')
      .eq('id', courseId)
      .limit(1)
      .maybeSingle();

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    let curriculum = parseCurriculumJson(course.curriculumJson);
    const existing = findNodeById(curriculum, nodeId);

    if (!existing) {
      return NextResponse.json({ error: 'Node not found.' }, { status: 404 });
    }

    curriculum = updateNodeById(curriculum, nodeId, (node) => ({
      ...node,
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.url !== undefined ? { url: body.url } : {}),
      ...(body.duration !== undefined ? { duration: body.duration } : {}),
      ...(body.storagePath !== undefined ? { storagePath: body.storagePath } : {}),
      ...(body.releaseGroupId !== undefined ? { releaseGroupId: body.releaseGroupId } : {}),
      ...(body.releaseAt !== undefined ? { releaseAt: body.releaseAt } : {}),
      ...(body.mediaVaultFolderId !== undefined ? { mediaVaultFolderId: body.mediaVaultFolderId } : {}),
      ...(body.attachments !== undefined ? { attachments: body.attachments } : {}),
    }));

    const { error: updateError } = await supabase
      .from('Course')
      // @ts-ignore
      .update({
        curriculumJson: JSON.stringify(curriculum),
        updatedAt: new Date().toISOString(),
      })
      .eq('id', courseId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, node: findNodeById(curriculum, nodeId) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; nodeId: string }> }
) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId, nodeId } = await params;
    const supabase = getSupabaseAdmin();

    const { data: course }: { data: any } = await supabase
      .from('Course')
      .select('id, curriculumJson')
      .eq('id', courseId)
      .limit(1)
      .maybeSingle();

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    // Cascade remove node from curriculumJson, remove linked CourseQuiz records, and clean progress
    await cleanupCourseCurriculumNode(supabase, courseId, nodeId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
