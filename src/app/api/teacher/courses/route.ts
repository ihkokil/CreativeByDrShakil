import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';
import { parseCurriculumJson, slugify } from '@/lib/teacher-course-builder';
import { parseDisplayDateToIso } from '@/lib/date-format';

const buildUniqueSlug = async (title: string, supabase: any) => {
  const base = slugify(title) || `course-${Date.now()}`;
  let slug = base;
  let counter = 2;

  while (true) {
    const { data } = await supabase.from('Course').select('id').eq('slug', slug).limit(1);
    if (!data || data.length === 0) break;
    slug = `${base}-${counter}`;
    counter += 1;
  }

  return slug;
};

export async function GET(request: NextRequest) {
  try {
    let payload;
    try {
      payload = await requireTeacherPayload(request);
    } catch (authError: any) {
      console.error('Auth payload error:', authError);
      return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 });
    }

    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized. No valid teacher/admin token.' }, { status: 401 });
    }

    const requestedTeacherId = request.nextUrl.searchParams.get('teacherId');
    const where =
      payload.role === 'admin' && requestedTeacherId
        ? { teacherId: requestedTeacherId }
        : {};

    const supabase = getSupabase();
    let courses;

    try {
      let coursesQuery = supabase.from('Course').select('*').order('updatedAt', { ascending: false });
      if (where.teacherId) {
        coursesQuery = coursesQuery.eq('teacherId', where.teacherId);
      }
      
      const { data: coursesResult = [], error: coursesError } = await coursesQuery;
      if (coursesError) throw coursesError;

      // In Supabase, we can't easily group by in the same way, so we'll fetch order counts
      const courseIds = (coursesResult || []).map((c: any) => c.id);
      
      let orderCountsResult: any[] = [];
      if (courseIds.length > 0) {
        const { data: ordersData = [], error: ordersError } = await supabase
          .from('Order')
          .select('courseId')
          .eq('status', 'approved')
          .in('courseId', courseIds);
        
        if (ordersError) throw ordersError;
        
        const counts = (ordersData || []).reduce((acc: any, order: any) => {
          acc[order.courseId] = (acc[order.courseId] || 0) + 1;
          return acc;
        }, {});
        
        orderCountsResult = Object.keys(counts).map(id => ({ courseId: id, count: counts[id] }));
      }

      const allInstructors = courseIds.length > 0
        ? await supabase.from('CourseInstructor').select('*').in('courseId', courseIds).order('sortOrder', { ascending: true }).then(r => r.data || [])
        : [];
        
      const instructorsMap = new Map<string, any[]>();
      for (const inst of allInstructors) {
        const list = instructorsMap.get((inst as any).courseId) || [];
        list.push(inst);
        instructorsMap.set((inst as any).courseId, list);
      }
      const rawCourses = (coursesResult || []).map((c: any) => ({ ...c, instructors: instructorsMap.get(c.id) || [] }));

      const orderCountMap = new Map(orderCountsResult.map((row: any) => [row.courseId as string, row.count]));

      courses = rawCourses.map(c => ({
        ...c,
        _count: { orders: orderCountMap.get(c.id) || 0 },
      }));
    } catch (dbError: any) {
      console.error('DB query error:', dbError);
      throw dbError;
    }

    return NextResponse.json({ courses });
  } catch (error: any) {
    console.error('GET /api/teacher/courses error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const duration = typeof body.duration === 'string' ? body.duration.trim() : '';
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : null;
    const courseStartDate = typeof body.courseStartDate === 'string' ? parseDisplayDateToIso(body.courseStartDate) : null;
    const isFeatured = body.isFeatured === true;

    if (!title) {
      return NextResponse.json({ error: 'Course title is required.' }, { status: 400 });
    }

    const numericPrice = Number(body.price);
    const numericSalePrice = body.salePrice ? Number(body.salePrice) : null;

    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return NextResponse.json({ error: 'Price must be a valid positive number.' }, { status: 400 });
    }

    if (numericSalePrice !== null && (Number.isNaN(numericSalePrice) || numericSalePrice < 0)) {
      return NextResponse.json({ error: 'Sale price must be a valid positive number.' }, { status: 400 });
    }

    const supabase = getSupabase();
    
    const { data: teacher } = await supabase
      .from('User')
      .select('fullName')
      .eq('id', payload.sub)
      .limit(1)
      .maybeSingle();

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher account not found.' }, { status: 404 });
    }

    const slug = await buildUniqueSlug(title, supabase);

    const courseId = crypto.randomUUID();
    const { error: insertError } = await supabase.from('Course').insert({
        id: courseId,
        slug,
        title,
        description: 'Course description will be added soon.',
        price: numericPrice,
        salePrice: numericSalePrice,
        instructor: teacher.fullName,
        imageUrl,
        duration: duration || '1y',
        courseStartDate: courseStartDate ? new Date(courseStartDate).toISOString() : null,
        isFeatured,
        teacherId: payload.sub,
        status: 'draft',
        timezone: 'Asia/Dhaka',
        curriculumJson: '[]',
        releaseGroupDates: '{}',
    } as any);
    
    if (insertError) throw insertError;

    const { data: courseRow } = await supabase.from('Course').select('*').eq('id', courseId).limit(1).maybeSingle();
    let courseInstructors: any[] = [];
    if (courseRow) {
      const res = await supabase.from('CourseInstructor').select('*').eq('courseId', courseId).order('sortOrder', { ascending: true });
      courseInstructors = res.data || [];
    }
    const course = { ...(courseRow as any), instructors: courseInstructors };

    return NextResponse.json({
      course,
      curriculum: parseCurriculumJson('[]'),
    });
  } catch (error: any) {
    console.error('POST /api/teacher/courses error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
