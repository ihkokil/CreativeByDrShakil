import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getSupabase } from '@/lib/db';
import { parseCurriculumJson } from '@/lib/teacher-course-builder';
import { populateMediaVaultNodes } from '@/lib/media-vault-populator';
import { formatLastUpdated } from '@/lib/date-format';

const formatPrice = (price: number) => {
  if (price <= 0) return 'Free';
  return `৳${Math.round(price).toLocaleString('en-BD')}`;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const supabase = getSupabase();

    const { data: course, error: courseError } = await supabase
      .from('Course')
      .select('*')
      .eq('slug', slug)
      .limit(1)
      .maybeSingle();

    if (courseError) throw courseError;

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const [teacherResult, instructorsResult, enrolledResult] = await Promise.all([
      course.teacherId
        ? supabase
            .from('User')
            .select('id, fullName, designation, profileImage')
            .eq('id', course.teacherId)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from('CourseInstructor')
        .select('*')
        .eq('courseId', course.id)
        .order('sortOrder', { ascending: true }),
      supabase
        .from('Order')
        .select('*', { count: 'exact', head: true })
        .eq('courseId', course.id)
        .eq('status', 'approved'),
    ]);

    if (teacherResult.error) throw teacherResult.error;
    if (instructorsResult.error) throw instructorsResult.error;
    if (enrolledResult.error) throw enrolledResult.error;

    const teacher = teacherResult.data;
    const instructors = instructorsResult.data || [];
    const enrolledCount = enrolledResult.count || 0;

    const rawCurriculum = parseCurriculumJson(course.curriculumJson);
    const curriculum = await populateMediaVaultNodes(rawCurriculum);

    return NextResponse.json({
      course: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        price: formatPrice(course.price),
        salePrice: course.salePrice ? formatPrice(course.salePrice) : null,
        priceValue: course.price,
        duration: course.duration,
        isFeatured: course.isFeatured,
        description: course.overview || course.description,
        overview: course.overview,
        learningOutcomes: course.learningOutcomes,
        language: course.language || 'English / Bengali',
        image: course.imageUrl || '/placeholder.svg',
        status: course.status,
        lastUpdated: formatLastUpdated(course.updatedAt),
        enrolledCount: enrolledCount,
        publishedAt: course.publishedAt,
        instructors: instructors,
        mainInstructor: {
          id: teacher?.id || `teacher-${course.id}`,
          name: teacher?.fullName || course.instructor,
          role: teacher?.designation || 'Course Instructor',
          image: teacher?.profileImage || '/placeholder-square.svg',
        },
      },
      curriculum: curriculum,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
      },
    });
  } catch (error: any) {
    console.error('[Course Dynamic Slug Error]', {
      message: error?.message,
      slug: slug,
    });
    return NextResponse.json(
      { error: 'Failed to load course details.' },
      { status: 500 }
    );
  }
}
