import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';
import { parseCurriculumJson, BuilderCurriculumNode, createNodeId } from '@/lib/teacher-course-builder';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId } = await params;
    const body = await request.json();
    const { sourceCourseId, topicNodeIds } = body;

    if (!sourceCourseId || typeof sourceCourseId !== 'string') {
      return NextResponse.json({ error: 'sourceCourseId is required.' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Fetch both courses
    const [targetRes, sourceRes] = await Promise.all([
      supabase.from('Course').select('id, curriculumJson').eq('id', courseId).limit(1).maybeSingle(),
      supabase.from('Course').select('id, curriculumJson').eq('id', sourceCourseId).limit(1).maybeSingle(),
    ]);

    const targetCourse = targetRes.data as any;
    const sourceCourse = sourceRes.data as any;

    if (!targetCourse) return NextResponse.json({ error: 'Target course not found.' }, { status: 404 });
    if (!sourceCourse) return NextResponse.json({ error: 'Source course not found.' }, { status: 404 });

    const targetCurriculum = parseCurriculumJson(targetCourse.curriculumJson);
    const sourceCurriculum = parseCurriculumJson(sourceCourse.curriculumJson);

    // If topicNodeIds is provided, only import those specific nodes
    let nodesToImport: BuilderCurriculumNode[];

    if (Array.isArray(topicNodeIds) && topicNodeIds.length > 0) {
      const topicIdSet = new Set(topicNodeIds);
      const findNodes = (nodes: BuilderCurriculumNode[]): BuilderCurriculumNode[] => {
        const found: BuilderCurriculumNode[] = [];
        for (const node of nodes) {
          if (topicIdSet.has(node.id)) {
            found.push(node);
          } else if (node.children) {
            found.push(...findNodes(node.children));
          }
        }
        return found;
      };
      nodesToImport = findNodes(sourceCurriculum);
    } else {
      // Import all top-level nodes
      nodesToImport = sourceCurriculum;
    }

    // Re-id all imported nodes to avoid conflicts
    const reIdNodes = (nodes: BuilderCurriculumNode[]): BuilderCurriculumNode[] =>
      nodes.map(node => ({
        ...node,
        id: createNodeId('imp'),
        children: node.children ? reIdNodes(node.children) : undefined,
      }));

    const importedNodes = reIdNodes(nodesToImport);
    const mergedCurriculum = [...targetCurriculum, ...importedNodes];

    const { error: updateError } = await supabase
      .from('Course')
      // @ts-ignore
      .update({
        curriculumJson: JSON.stringify(mergedCurriculum),
        updatedAt: new Date().toISOString(),
      })
      .eq('id', courseId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      importedCount: importedNodes.length,
      message: `Imported ${importedNodes.length} topics from source course.`,
    });
  } catch (error: any) {
    console.error('[teacher/courses/import-topics] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
