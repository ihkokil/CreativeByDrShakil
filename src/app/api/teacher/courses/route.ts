import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireTeacherPayload } from '@/lib/route-auth';
import { parseCurriculumJson, slugify } from '@/lib/teacher-course-builder';
import { COURSES } from '@/constants/courses';
import { parseDisplayDateToIso } from '@/lib/date-format';

const STATIC_COURSE_SLUGS = new Set(COURSES.map((course) => course.slug));

const buildUniqueSlug = async (title: string) => {
  const base = slugify(title) || `course-${Date.now()}`;
  let slug = base;
  let counter = 2;

  while (STATIC_COURSE_SLUGS.has(slug) || (await prisma.course.findUnique({ where: { slug } }))) {
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
      payload.role === 'admin'
        ? requestedTeacherId
          ? { teacherId: requestedTeacherId }
          : {}
        : { teacherId: payload.sub };

    let courses;
    try {
      courses = await prisma.course.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include: {
          category: true,
          instructors: { orderBy: { sortOrder: 'asc' } },
          _count: {
            select: {
              orders: true,
              lessonProgress: true,
            },
          },
        },
      });
    } catch (prismaError: any) {
      console.error('Prisma query error:', prismaError);
      throw prismaError;
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
    const categoryId = typeof body.categoryId === 'string' ? body.categoryId.trim() : null;
    const duration = typeof body.duration === 'string' ? body.duration.trim() : '';
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : null;
    const courseStartDate = typeof body.courseStartDate === 'string' ? parseDisplayDateToIso(body.courseStartDate) : null;
    const isFeatured = body.isFeatured === true;

    if (!title) {
      return NextResponse.json({ error: 'Course title is required.' }, { status: 400 });
    }

    if (!categoryId) {
      return NextResponse.json({ error: 'Category is required.' }, { status: 400 });
    }

    const numericPrice = Number(body.price);
    const numericSalePrice = body.salePrice ? Number(body.salePrice) : null;

    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return NextResponse.json({ error: 'Price must be a valid positive number.' }, { status: 400 });
    }

    if (numericSalePrice !== null && (Number.isNaN(numericSalePrice) || numericSalePrice < 0)) {
      return NextResponse.json({ error: 'Sale price must be a valid positive number.' }, { status: 400 });
    }

    // Verify category exists
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
    }

    const teacher = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { fullName: true },
    });

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher account not found.' }, { status: 404 });
    }

    const slug = await buildUniqueSlug(title);

    const course = await prisma.course.create({
      data: {
        slug,
        title,
        description: 'Course description will be added soon.',
        categoryId,
        price: numericPrice,
        salePrice: numericSalePrice,
        instructor: teacher.fullName,
        imageUrl,
        duration: duration || 'Self paced',
        courseStartDate: courseStartDate ? new Date(courseStartDate) : null,
        isFeatured,
        teacherId: payload.sub,
        status: 'draft',
        timezone: 'Asia/Dhaka',
        curriculumJson: [] as Prisma.InputJsonValue,
        releaseGroupDates: {} as Prisma.InputJsonValue,
      },
      include: {
        category: true,
        instructors: { orderBy: { sortOrder: 'asc' } },
      },
    });

    return NextResponse.json({
      course,
      curriculum: parseCurriculumJson([]),
    });
  } catch (error: any) {
    console.error('POST /api/teacher/courses error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
