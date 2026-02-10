import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireTeacherPayload } from '@/lib/route-auth';
import { parseCurriculumJson, slugify } from '@/lib/teacher-course-builder';

const buildUniqueSlug = async (title: string) => {
  const base = slugify(title) || `course-${Date.now()}`;
  let slug = base;
  let counter = 2;

  while (await prisma.course.findUnique({ where: { slug } })) {
    slug = `${base}-${counter}`;
    counter += 1;
  }

  return slug;
};

export async function GET(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const requestedTeacherId = request.nextUrl.searchParams.get('teacherId');
    const where =
      payload.role === 'admin'
        ? requestedTeacherId
          ? { teacherId: requestedTeacherId }
          : {}
        : { teacherId: payload.sub };

    const courses = await prisma.course.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        description: true,
        imageUrl: true,
        language: true,
        level: true,
        price: true,
        duration: true,
        status: true,
        releaseMode: true,
        releaseStartAt: true,
        releaseIntervalDays: true,
        releaseGroupsPerWeek: true,
        timezone: true,
        publishedAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ courses });
  } catch (error: any) {
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
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const category = typeof body.category === 'string' ? body.category.trim() : null;
    const duration = typeof body.duration === 'string' ? body.duration.trim() : '';
    const language = typeof body.language === 'string' ? body.language.trim() : null;
    const level = typeof body.level === 'string' ? body.level.trim() : null;
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : null;

    if (!title) {
      return NextResponse.json({ error: 'Course title is required.' }, { status: 400 });
    }

    const numericPrice = Number(body.price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return NextResponse.json({ error: 'Price must be a valid positive number.' }, { status: 400 });
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
        description: description || 'Course description will be added soon.',
        category,
        price: numericPrice,
        instructor: teacher.fullName,
        language,
        level,
        imageUrl,
        duration: duration || 'Self paced',
        teacherId: payload.sub,
        status: 'draft',
        timezone: 'Asia/Dhaka',
        curriculumJson: [] as Prisma.InputJsonValue,
        releaseGroupDates: {} as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        description: true,
        price: true,
        duration: true,
        language: true,
        level: true,
        imageUrl: true,
        status: true,
        timezone: true,
      },
    });

    return NextResponse.json({
      course,
      curriculum: parseCurriculumJson([]),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
