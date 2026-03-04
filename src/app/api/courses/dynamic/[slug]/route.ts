import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import prisma from '@/lib/prisma';
import { getAuthPayload } from '@/lib/route-auth';
import {
  collectSecondChildGroups,
  computeReleaseGroupDates,
  ensureGroupInheritance,
  parseCurriculumJson,
  parseReleaseGroupDateMap,
} from '@/lib/teacher-course-builder';
import { formatLastUpdated } from '@/lib/date-format';

const formatPrice = (price: number) => {
  if (price <= 0) {
    return 'Free';
  }
  return `৳${Math.round(price).toLocaleString('en-BD')}`;
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const resolvedParams = await params;
    const payload = await getAuthPayload(request);

    const publishedCourse = await prisma.course.findFirst({
      where: {
        slug: resolvedParams.slug,
        status: 'published',
      },
      include: {
        teacher: {
          select: {
            id: true,
            fullName: true,
            designation: true,
            profileImage: true,
          },
        },
        instructors: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            designation: true,
            sortOrder: true,
          },
        },
        category: {
          select: {
            displayName: true,
          },
        },
        _count: {
          select: { orders: true },
        },
      },
    });

    let course = publishedCourse;

    if (!course && payload && (payload.role === 'teacher' || payload.role === 'admin')) {
      course = await prisma.course.findFirst({
        where: {
          slug: resolvedParams.slug,
          ...(payload.role === 'admin' ? {} : { teacherId: payload.sub }),
        },
        include: {
          teacher: {
            select: {
              id: true,
              fullName: true,
              designation: true,
              profileImage: true,
            },
          },
          instructors: {
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              name: true,
              designation: true,
              sortOrder: true,
            },
          },
          category: {
            select: {
              displayName: true,
            },
          },
          _count: {
            select: { orders: true },
          },
        },
      });
    }

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const curriculum = ensureGroupInheritance(parseCurriculumJson(course.curriculumJson));
    const groups = collectSecondChildGroups(curriculum);
    const releaseGroupDates = parseReleaseGroupDateMap(course.releaseGroupDates);
    const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
      releaseMode: course.releaseMode,
      releaseStartAt: course.releaseStartAt,
      releaseIntervalDays: course.releaseIntervalDays,
      releaseGroupsPerWeek: course.releaseGroupsPerWeek,
      releaseGroupDates,
    });

    const lessonCount = countLessons(curriculum);

    return NextResponse.json({
      course: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        category: course.category?.displayName || 'General',
        price: formatPrice(course.price),
        priceValue: course.price,
        duration: course.duration,
        description: course.overview || course.description,
        overview: course.overview,
        learningOutcomes: course.learningOutcomes,
        language: course.language || 'English / Bengali',
        image: course.imageUrl,
        status: course.status,
        timezone: course.timezone,
        releaseMode: course.releaseMode,
        releaseStartAt: course.releaseStartAt,
        releaseIntervalDays: course.releaseIntervalDays,
        releaseGroupsPerWeek: course.releaseGroupsPerWeek,
        publishedAt: course.publishedAt,
        updatedAt: course.updatedAt,
        lastUpdated: formatLastUpdated(course.updatedAt),
        enrolledCount: course._count?.orders || 0,
        lessonCount,
        instructors: course.instructors,
        mainInstructor: {
          id: course.teacher?.id || `teacher-${course.id}`,
          name: course.teacher?.fullName || course.instructor,
          role: course.teacher?.designation || 'Course Instructor',
          image: course.teacher?.profileImage || '/placeholder.svg',
        },
      },
      curriculum,
      groups,
      releaseGroupDates,
      computedReleaseGroupDates,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

