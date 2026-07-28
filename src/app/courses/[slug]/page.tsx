import { Metadata } from 'next';
import { mapDynamicCourseToCourse } from '@/lib/dynamic-course-client';
import CourseDetailClient from './CourseDetailClient';
import { Course } from '@/constants/courses';
import { PublicTeacher } from '@/lib/teacher-directory';

import { getSupabaseAdmin } from '@/lib/db';
import { parseCurriculumJson } from '@/lib/teacher-course-builder';
import { populateMediaVaultNodes } from '@/lib/media-vault-populator';
import { formatLastUpdated } from '@/lib/date-format';

interface Props {
  params: Promise<{ slug: string }>;
}

async function getCourseData(slug: string) {
  const supabase = getSupabaseAdmin();
  
  const { data: course, error: courseError } = await supabase
    .from('Course')
    .select('*')
    .eq('slug', slug)
    .limit(1)
    .maybeSingle();

  if (courseError || !course) return null;

  const [teacherResult, instructorsResult, enrolledResult] = await Promise.all([
    course.teacherId
      ? supabase.from('User').select('id, fullName, designation, profileImage').eq('id', course.teacherId).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('CourseInstructor').select('*').eq('courseId', course.id).order('sortOrder', { ascending: true }),
    supabase.from('Order').select('*', { count: 'exact', head: true }).eq('courseId', course.id).eq('status', 'approved'),
  ]);

  const teacher = teacherResult.data;
  const instructors = instructorsResult.data || [];
  const enrolledCount = enrolledResult.count || 0;

  const rawCurriculum = parseCurriculumJson(course.curriculumJson);
  const curriculum = await populateMediaVaultNodes(rawCurriculum);

  return {
    course: {
      id: course.id,
      slug: course.slug,
      title: course.title,
      price: course.price <= 0 ? 'Free' : `৳${Math.round(course.price).toLocaleString('en-BD')}`,
      salePrice: course.salePrice ? (course.salePrice <= 0 ? 'Free' : `৳${Math.round(course.salePrice).toLocaleString('en-BD')}`) : null,
      priceValue: course.price,
      duration: course.duration,
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
    curriculum
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  
  try {
    const data = await getCourseData(slug);
    if (!data) return { title: 'Course Not Found' };
    const course = data.course;
    
    return {
      title: `${course?.title || 'Course'} | Creative By Dr. Shakil`,
      description: course?.description || 'Course details',
      openGraph: {
        title: `${course?.title || 'Course'} | Creative By Dr. Shakil`,
        description: course?.description || 'Course details',
        images: [{ url: course?.image || '/placeholder.svg' }],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${course?.title || 'Course'} | Creative By Dr. Shakil`,
        description: course?.description || 'Course details',
        images: [course?.image || '/placeholder.svg'],
      }
    };
  } catch (e) {
    return { title: 'Course | Creative By Dr. Shakil' };
  }
}

export default async function CourseDetailPage({ params }: Props) {
  const { slug } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://creativebydrshakil.com';
  
  let initialCourse: Course | null = null;
  let initialCurriculum: any[] = [];
  let initialTeachers: PublicTeacher[] = [];

  try {
    const supabase = getSupabaseAdmin();
    // Fetch teachers
    const { data: teachersData } = await supabase
      .from('User')
      .select('id, fullName, designation, profileImage, degrees, institution, bmdcNumber')
      .in('role', ['teacher', 'admin'])
      .order('createdAt', { ascending: true });

    if (teachersData) {
      initialTeachers = teachersData.map((t: any) => ({
        id: t.id,
        full_name: t.fullName,
        designation: t.designation || 'Instructor',
        profile_image: t.profileImage || '/placeholder-square.svg',
        institution: t.institution,
      }));
    }

    // Fetch course
    const data = await getCourseData(slug);
    if (data) {
      initialCourse = mapDynamicCourseToCourse(data.course as any);
      initialCurriculum = Array.isArray(data.curriculum) ? data.curriculum : [];
    }
  } catch (error) {
    console.error('Error fetching course for SSR', error);
  }

  return (
    <CourseDetailClient 
      initialCourse={initialCourse} 
      initialTeachers={initialTeachers} 
      initialCurriculum={initialCurriculum}
      slug={slug}
    />
  );
}
