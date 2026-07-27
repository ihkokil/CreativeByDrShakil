import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';

// GET list of courses with batch counts
export async function GET(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    
    // Fetch courses taught by the teacher (or all if admin)
    let query = supabase.from('Course').select('id, title, slug, createdAt, status');
    if (payload.role !== 'admin') {
      query = query.eq('teacherId', payload.sub);
    }
    
    const { data: courses, error: coursesError } = await query;
    if (coursesError) throw coursesError;

    // Fetch batches for these courses
    const courseIds = (courses || []).map(c => c.id);
    const { data: batches, error: batchesError } = await (supabase as any)
      .from('Batch')
      .select('*')
      .in('courseId', courseIds);
      
    if (batchesError) throw batchesError;

    const batchesMap = (batches || []).reduce((acc: any, batch: any) => {
      if (!acc[batch.courseId]) {
        acc[batch.courseId] = [];
      }
      acc[batch.courseId].push(batch);
      return acc;
    }, {});

    const enrichedCourses = (courses || []).map(course => {
      const courseBatches = batchesMap[course.id] || [];
      // Sort to get the latest batch
      courseBatches.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      return {
        ...course,
        totalBatches: courseBatches.length,
        latestBatchDate: courseBatches.length > 0 ? courseBatches[0].createdAt : null,
      };
    });

    return NextResponse.json({ courses: enrichedCourses });
  } catch (error: any) {
    console.error('Error fetching courses and batches:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
