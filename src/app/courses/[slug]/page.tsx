import { Metadata } from 'next';
import { mapDynamicCourseToCourse } from '@/lib/dynamic-course-client';
import CourseDetailClient from './CourseDetailClient';
import { Course } from '@/constants/courses';
import { PublicTeacher } from '@/lib/teacher-directory';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://creativebydrshakil.com';
  
  try {
    const res = await fetch(`${baseUrl}/api/courses/dynamic/${slug}`, { next: { revalidate: 3600 } });
    if (!res.ok) return { title: 'Course Not Found' };
    const data = await res.json();
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
    // Fetch teachers
    const teachersRes = await fetch(`${baseUrl}/api/teachers`, { next: { revalidate: 3600 } });
    if (teachersRes.ok) {
      const teachersData = await teachersRes.json();
      if (Array.isArray(teachersData.teachers)) {
        initialTeachers = teachersData.teachers;
      }
    }

    // Fetch course
    const courseRes = await fetch(`${baseUrl}/api/courses/dynamic/${slug}`, { next: { revalidate: 3600 } });
    if (courseRes.ok) {
      const courseData = await courseRes.json();
      if (courseData.course) {
        initialCourse = mapDynamicCourseToCourse(courseData.course);
        initialCurriculum = Array.isArray(courseData.curriculum) ? courseData.curriculum : [];
      }
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
