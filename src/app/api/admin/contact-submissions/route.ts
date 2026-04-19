import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

function normalizeSubmission(submission: any) {
  return {
    ...submission,
    imageUrls: Array.isArray(submission.imageUrls) ? submission.imageUrls : [],
  };
}

export async function GET(request: NextRequest) {
  try {
    const adminCheck = await requireAdmin(request);
    if (!adminCheck.ok) return adminCheck.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;

    const submissions = await prisma.contactSubmission.findMany({
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