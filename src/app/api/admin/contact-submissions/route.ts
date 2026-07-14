import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { contactSubmission as csSchema, user as userSchema } from '@/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';

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

    const submissions = status
      ? await db.select().from(csSchema).where(eq(csSchema.status, status as any)).orderBy(desc(csSchema.createdAt))
      : await db.select().from(csSchema).orderBy(desc(csSchema.createdAt));

    const adminIds = [...new Set(submissions.map(s => s.repliedByAdminId).filter(Boolean))] as string[];
    if (adminIds.length > 0) {
      const admins = await db.select({ id: userSchema.id, fullName: userSchema.fullName, email: userSchema.email }).from(userSchema).where(inArray(userSchema.id, adminIds));
      const adminMap = new Map(admins.map(a => [a.id, a]));
      for (const s of submissions) {
        (s as any).repliedByAdmin = s.repliedByAdminId ? adminMap.get(s.repliedByAdminId) || null : null;
      }
    }

    return NextResponse.json({ submissions: submissions.map(normalizeSubmission) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}