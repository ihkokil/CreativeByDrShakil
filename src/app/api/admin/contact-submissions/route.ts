import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';
import { Prisma } from '@prisma/client';

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

    const submissions = await db.contactSubmission.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        repliedByAdmin: {
          select: {
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