import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { course as courseSchema, user as userSchema, order as orderSchema } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { requireTeacherPayload } from '@/lib/route-auth';
import { parseCurriculumJson, slugify } from '@/lib/teacher-course-builder';
import { parseDisplayDateToIso } from '@/lib/date-format';


const buildUniqueSlug = async (title: string) => {
  const base = slugify(title) || `course-${Date.now()}`;
  let slug = base;
  let counter = 2;

  while (await db.query.course.findFirst({ where: (c, { eq }) => eq(c.slug, slug) })) {
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
      payload.role === 'admin' && requestedTeacherId
        ? { teacherId: requestedTeacherId }
        : {};

    let courses;
    try {
      const [rawCourses, orderCountsData] = await Promise.all([
        db.query.course.findMany({
          where: where.teacherId ? (c, { eq }) => eq(c.teacherId, where.teacherId) : undefined,
          orderBy: (c, { desc }) => [desc(c.updatedAt)],
          with: {
            instructors: { orderBy: (i, { asc }) => [asc(i.sortOrder)] },
          },
        }),
        db.select({
          courseId: orderSchema.courseId,
          count: sql<number>`count(${orderSchema.id})`.mapWith(Number)
        })
        .from(orderSchema)
        .where(eq(orderSchema.status, 'approved'))
        .groupBy(orderSchema.courseId)
      ]);

      const orderCountMap = new Map(orderCountsData.map(row => [row.courseId as string, row.count]));

      courses = rawCourses.map(c => ({
        ...c,
        _count: { orders: orderCountMap.get(c.id) || 0 },
      }));
    } catch (dbError: any) {
      console.error('DB query error:', dbError);
      throw dbError;
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
    const duration = typeof body.duration === 'string' ? body.duration.trim() : '';
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : null;
    const courseStartDate = typeof body.courseStartDate === 'string' ? parseDisplayDateToIso(body.courseStartDate) : null;
    const isFeatured = body.isFeatured === true;

    if (!title) {
      return NextResponse.json({ error: 'Course title is required.' }, { status: 400 });
    }

    const numericPrice = Number(body.price);
    const numericSalePrice = body.salePrice ? Number(body.salePrice) : null;

    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return NextResponse.json({ error: 'Price must be a valid positive number.' }, { status: 400 });
    }

    if (numericSalePrice !== null && (Number.isNaN(numericSalePrice) || numericSalePrice < 0)) {
      return NextResponse.json({ error: 'Sale price must be a valid positive number.' }, { status: 400 });
    }

    const teacher = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, payload.sub),
      columns: { fullName: true },
    });

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher account not found.' }, { status: 404 });
    }

    const slug = await buildUniqueSlug(title);

    const [newCourse] = await db.insert(courseSchema).values({
        id: crypto.randomUUID(),
        slug,
        title,
        description: 'Course description will be added soon.',
        price: numericPrice,
        salePrice: numericSalePrice,
        instructor: teacher.fullName,
        imageUrl,
        duration: duration || '1y',
        courseStartDate: courseStartDate ? new Date(courseStartDate).toISOString() : null,
        isFeatured,
        teacherId: payload.sub,
        status: 'draft',
        timezone: 'Asia/Dhaka',
        curriculumJson: '[]',
        releaseGroupDates: '{}',
    }).returning();

    const course = await db.query.course.findFirst({
      where: (c, { eq }) => eq(c.id, newCourse.id),
      with: { instructors: { orderBy: (i, { asc }) => [asc(i.sortOrder)] } },
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
