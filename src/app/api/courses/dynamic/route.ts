import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getSupabaseAdmin } from '@/lib/db';
import { BuilderCurriculumNode, parseCurriculumJson } from '@/lib/teacher-course-builder';

const formatPrice = (price: number) => {
  if (price <= 0) {
    return 'Free';
  }
  return `৳${Math.round(price).toLocaleString('en-BD')}`;
};

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // 1. Fetch courses and orders in parallel
    const [coursesRes, ordersRes] = await Promise.all([
      supabase
        .from('Course')
        .select('*')
        .eq('status', 'published')
        .not('slug', 'is', null)
        .order('publishedAt', { ascending: false })
        .order('updatedAt', { ascending: false }),
      supabase
        .from('Order')
        .select('courseId')
        .eq('status', 'approved')
    ]);

    if (coursesRes.error) throw coursesRes.error;
    if (ordersRes.error) throw ordersRes.error;

    const coursesData = coursesRes.data || [];
    const ordersData = ordersRes.data || [];

    // Aggregate order counts in memory
    const orderCountMap = new Map<string, number>();
    ordersData.forEach((row) => {
      if (row.courseId) {
        orderCountMap.set(row.courseId, (orderCountMap.get(row.courseId) || 0) + 1);
      }
    });

    const teacherIds = Array.from(new Set(coursesData.map(c => c.teacherId).filter(Boolean))) as string[];
    const courseIds = coursesData.map(c => c.id);

    // 2. Fetch teachers and course instructors in parallel
    const [teachersRes, instructorsRes] = await Promise.all([
      teacherIds.length > 0
        ? supabase
            .from('User')
            .select('id, fullName, designation, profileImage')
            .in('id', teacherIds)
        : Promise.resolve({ data: [], error: null }),
      courseIds.length > 0
        ? supabase
            .from('CourseInstructor')
            .select('id, courseId, name, designation, imageUrl, sortOrder')
            .in('courseId', courseIds)
            .order('sortOrder', { ascending: true })
        : Promise.resolve({ data: [], error: null })
    ]);

    if (teachersRes.error) throw teachersRes.error;
    if (instructorsRes.error) throw instructorsRes.error;

    const teachers = teachersRes.data || [];
    const instructors = instructorsRes.data || [];

    const teacherMap = new Map(teachers.map(t => [t.id, t]));
    const instructorsMap = new Map<string, any[]>();
    instructors.forEach((inst: any) => {
      const list = instructorsMap.get(inst.courseId) || [];
      list.push(inst);
      instructorsMap.set(inst.courseId, list);
    });

    const courses = coursesData.map((c: any) => ({
      ...c,
      teacher: c.teacherId ? teacherMap.get(c.teacherId) || null : null,
      instructors: instructorsMap.get(c.id) || [],
    }));

    const rawCurriculums = courses.map((course) => parseCurriculumJson(course.curriculumJson));
    
    // 3. Fetch video library nodes to calculate lesson counts in memory
    const { data: videoNodes, error: videoError } = await supabase
      .from('VideoLibraryNode')
      .select('id, parentId, type')
      .neq('type', 'folder');

    if (videoError) throw videoError;

    const folderCounts: Record<string, number> = {};
    (videoNodes || []).forEach((node: any) => {
      if (node.parentId) {
        folderCounts[node.parentId] = (folderCounts[node.parentId] || 0) + 1;
      }
    });

    const processedCourses = courses.map((course, index) => {
      const curriculum = rawCurriculums[index];
      let lessonCount = 0;
      
      const countNodes = (list: BuilderCurriculumNode[]) => {
        list.forEach(node => {
          if (node.type !== 'folder') {
            lessonCount++;
          }
          if (node.mediaVaultFolderId) {
             if (folderCounts[node.mediaVaultFolderId]) {
                 lessonCount += folderCounts[node.mediaVaultFolderId];
             }
          } else if (node.children) {
            countNodes(node.children);
          }
        });
      };
      countNodes(curriculum);

      const enrolledCount = orderCountMap.get(course.id) || 0;

      return {
        id: course.id,
        slug: course.slug,
        title: course.title,
        price: formatPrice(course.price),
        salePrice: course.salePrice ? formatPrice(course.salePrice) : null,
        priceValue: course.price,
        duration: course.duration,
        lessonCount,
        enrolledCount,
        isFeatured: course.isFeatured,
        description: course.overview || course.description,
        overview: course.overview,
        learningOutcomes: course.learningOutcomes,
        language: course.language || 'English / Bengali',
        image: course.imageUrl,
        status: course.status,
        publishedAt: course.publishedAt,
        instructors: course.instructors,
        mainInstructor: {
          id: course.teacher?.id || `teacher-${course.id}`,
          name: course.teacher?.fullName || course.instructor,
          role: course.teacher?.designation || 'Course Instructor',
          image: course.teacher?.profileImage || '/placeholder-square.svg',
        },
      };
    });

    return NextResponse.json({
      courses: processedCourses,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
      },
    });
  } catch (error: any) {
    console.error('[Courses Dynamic Error]', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });
    return NextResponse.json(
      { error: 'Failed to load courses. Please try again.' },
      { status: 500 }
    );
  }
}
