import { Course, Instructor } from '@/constants/courses';

interface DynamicInstructorPayload {
  id: string;
  name: string;
  role: string;
  image: string;
}

interface DynamicCoursePayload {
  id: string;
  slug: string;
  title: string;
  category: string;
  price: string;
  rating?: number;
  duration: string;
  description?: string;
  level?: string;
  language?: string;
  image?: string | null;
  mainInstructor: DynamicInstructorPayload;
}

const normalizeInstructor = (payload: DynamicInstructorPayload): Instructor => ({
  id: payload.id,
  name: payload.name,
  role: payload.role,
  image: payload.image || '/placeholder.svg',
});

export const mapDynamicCourseToCourse = (payload: DynamicCoursePayload): Course => ({
  id: payload.id,
  slug: payload.slug,
  title: payload.title,
  category: payload.category || 'General',
  price: payload.price || 'Free',
  rating: payload.rating || 4.9,
  duration: payload.duration || 'Self paced',
  description: payload.description,
  level: payload.level,
  language: payload.language,
  image: payload.image || '/placeholder.svg',
  mainInstructor: normalizeInstructor(payload.mainInstructor),
  dynamicSource: true,
});

export const mergeStaticAndDynamicCourses = (staticCourses: Course[], dynamicCourses: Course[]) => {
  const merged = [...staticCourses];
  dynamicCourses.forEach((course) => {
    if (!merged.some((existing) => existing.slug === course.slug)) {
      merged.push(course);
    }
  });

  return merged;
};

export async function fetchPublishedDynamicCourses(): Promise<Course[]> {
  const response = await fetch('/api/courses/dynamic', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to fetch published courses.');
  }

  const data = await response.json();
  const dynamicCourses = Array.isArray(data.courses) ? data.courses : [];
  return dynamicCourses.map(mapDynamicCourseToCourse);
}
