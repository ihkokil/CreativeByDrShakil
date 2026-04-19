import { Course, Instructor } from '@/constants/courses';

interface DynamicInstructorPayload {
  id: string;
  name: string;
  role?: string;
  designation?: string;
  image?: string;
  sortOrder?: number;
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
  overview?: string | null;
  learningOutcomes?: string | null;
  instructors?: DynamicInstructorPayload[];
  level?: string;
  language?: string;
  image?: string | null;
  mainInstructor: DynamicInstructorPayload;
  enrolledCount?: number;
  lastUpdated?: string | null;
  lessonCount?: number;
}

const normalizeInstructor = (payload: DynamicInstructorPayload): Instructor => ({
  id: payload.id,
  name: payload.name,
  role: payload.role || payload.designation || 'Course Instructor',
  image: payload.image || '/placeholder.svg',
});

export const mapDynamicCourseToCourse = (payload: DynamicCoursePayload): Course => {
  const mainInstructor = normalizeInstructor(payload.mainInstructor);
  const additionalInstructors = (payload.instructors || [])
    .map((instructor) => ({
      id: instructor.id,
      name: instructor.name,
      role: instructor.designation || instructor.role || 'Course Instructor',
      image: '/placeholder.svg',
    }))
    .filter((instructor) => instructor.name && instructor.name !== mainInstructor.name);

  const learningObjectives = typeof payload.learningOutcomes === 'string'
    ? payload.learningOutcomes
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
    : undefined;

  return {
    id: payload.id,
    slug: payload.slug,
    title: payload.title,
    category: payload.category || 'General',
    price: payload.price || 'Free',
    rating: payload.rating || 4.9,
    duration: payload.duration || 'Self paced',
    description: payload.overview || payload.description,
    learningObjectives,
    level: payload.level,
    language: payload.language,
    lastUpdated: payload.lastUpdated || undefined,
    enrolledCount: payload.enrolledCount,
    lessonCount: payload.lessonCount,
    image: payload.image || '/placeholder.svg',
    mainInstructor,
    subInstructors: additionalInstructors.length ? additionalInstructors : undefined,
    dynamicSource: true,
  };
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
