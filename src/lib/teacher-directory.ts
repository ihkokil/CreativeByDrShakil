import { Course } from '@/constants/courses';

export interface PublicTeacher {
  id: string;
  full_name: string;
  profile_image?: string | null;
  designation?: string | null;
  institution?: string | null;
}

const DEFAULT_INSTRUCTOR_IMAGE = '/placeholder.svg';

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .replace(/\b(dr|prof|doctor)\.?\s+/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getNormalizedCandidates = (instructor: Course['mainInstructor']) => {
  const values = [instructor.name, ...(instructor.aliases || [])];
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const item = normalizeName(value);
    if (!item || seen.has(item)) {
      continue;
    }
    seen.add(item);
    normalized.push(item);
  }

  return normalized;
};

const getNormalizedTeacherDirectory = (teachers: PublicTeacher[]) =>
  teachers
    .map((teacher) => ({
      teacher,
      normalizedName: normalizeName(teacher.full_name),
    }))
    .filter((entry) => entry.normalizedName);

const hasStrongTokenMatch = (candidate: string, teacherName: string) => {
  const candidateTokens = candidate.split(' ').filter((token) => token.length > 2);
  const teacherTokens = teacherName.split(' ').filter((token) => token.length > 2);

  if (candidateTokens.length < 2 || teacherTokens.length < 2) {
    return false;
  }

  const candidateInTeacher = candidateTokens.every((token) => teacherTokens.includes(token));
  const teacherInCandidate = teacherTokens.every((token) => candidateTokens.includes(token));

  return candidateInTeacher || teacherInCandidate;
};

const matchTeacher = (instructor: Course['mainInstructor'], teachers: PublicTeacher[]) => {
  const candidates = getNormalizedCandidates(instructor);
  if (candidates.length === 0) {
    return null;
  }

  const normalizedTeachers = getNormalizedTeacherDirectory(teachers);

  // Prefer exact matches from explicit aliases and canonical names first.
  for (const candidate of candidates) {
    const exact = normalizedTeachers.find((entry) => entry.normalizedName === candidate);
    if (exact) {
      return exact.teacher;
    }
  }

  // Fallback only when a single strong token match exists; avoid ambiguous swaps.
  for (const candidate of candidates) {
    const partialMatches = normalizedTeachers.filter((entry) =>
      hasStrongTokenMatch(candidate, entry.normalizedName)
    );

    if (partialMatches.length === 1) {
      return partialMatches[0].teacher;
    }
  }

  return null;
};

const enrichInstructor = (
  instructor: Course['mainInstructor'],
  teachers: PublicTeacher[]
) => {
  const matchedTeacher = matchTeacher(instructor, teachers);
  if (!matchedTeacher) {
    return {
      ...instructor,
      image: instructor.image || DEFAULT_INSTRUCTOR_IMAGE,
    };
  }

  const matchedDesignation = matchedTeacher.designation?.trim() || null;
  const matchedInstitution = matchedTeacher.institution?.trim() || null;
  const matchedProfileImage = matchedTeacher.profile_image?.trim() || null;
  const matchedRole = matchedDesignation || matchedInstitution || instructor.role;

  return {
    ...instructor,
    name: matchedTeacher.full_name,
    role: matchedRole,
    image: matchedProfileImage || instructor.image || DEFAULT_INSTRUCTOR_IMAGE,
  };
};

export const enrichCoursesWithTeachers = (courses: Course[], teachers: PublicTeacher[]): Course[] =>
  courses.map((course) => {
    if (course.dynamicSource) {
      return course;
    }
    return {
      ...course,
      mainInstructor: enrichInstructor(course.mainInstructor, teachers),
      subInstructors: course.subInstructors?.map((instructor) => enrichInstructor(instructor, teachers)),
    };
  });
