import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';
import { eq, and, or, inArray, desc, asc, isNull, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';

function normalizeSubmission(submission: any) {
  let parsedImageUrls = [];
  if (typeof submission.imageUrls === 'string') {
    try { parsedImageUrls = JSON.parse(submission.imageUrls); } catch (e) {}
  } else if (Array.isArray(submission.imageUrls)) {
    parsedImageUrls = submission.imageUrls;
  }
  return {
    ...submission,
    imageUrls: parsedImageUrls,
  };
}

export async function GET(request: NextRequest) {
  try {
    const adminCheck = await requireAdmin(request);
    if (!adminCheck.ok) return adminCheck.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;

    const submissions = await db.query.contactSubmissions.findMany({
      where: status ? eq(schema.contactSubmissions.status, status as 'open' | 'in_review' | 'responded' | 'closed') : undefined,
      orderBy: [desc(schema.contactSubmissions.createdAt)],
      with: {
        repliedByAdmin: {
          columns: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ submissions: submissions.map(normalizeSubmission) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}