import { Course, Instructor } from '@/constants/courses';

interface DynamicInstructorPayload {
  id: string;
  name: string;
  role?: string;
  designation?: string;
  image?: string;
  imageUrl?: string;
  sortOrder?: number;
}

interface DynamicCoursePayload {
  id: string;
  slug: string;
  title: string;
  price: string;
  salePrice?: string | null;
  rating?: number;
  duration: string;
  description?: string;
  overview?: string | null;
  learningOutcomes?: string | null;
  instructors?: DynamicInstructorPayload[];
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
  image: payload.imageUrl || payload.image || '/placeholder.svg',
});

export const mapDynamicCourseToCourse = (payload: DynamicCoursePayload): Course => {
  const mainInstructor = normalizeInstructor(payload.mainInstructor);
  const additionalInstructors = (payload.instructors || [])
    .map((instructor) => ({
      id: instructor.id,
      name: instructor.name,
      role: instructor.designation || instructor.role || 'Course Instructor',
      image: instructor.imageUrl || instructor.image || '/placeholder-square.svg',
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
    price: payload.salePrice ? payload.salePrice : (payload.price || 'Free'),
    originalPrice: payload.salePrice ? payload.price : undefined,
    rating: payload.rating || 4.9,
    duration: payload.duration || 'Self paced',
    description: payload.overview || payload.description,
    learningObjectives,
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
