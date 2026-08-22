import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

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

    const supabase = getSupabaseAdmin();
    let query = supabase.from('ContactSubmission').select('*').order('createdAt', { ascending: false });

    if (status) {
      query = query.eq('status', status as "open" | "in_review" | "responded" | "closed");
    }

    const { data: submissions = [], error } = await query;
    if (error) throw error;

    const adminIds = [...new Set((submissions || []).map((s: any) => s.repliedByAdminId).filter(Boolean))] as string[];
    
    if (adminIds.length > 0) {
      const { data: admins = [] } = await supabase.from('User').select('id, fullName, email').in('id', adminIds);
      const adminMap = new Map((admins || []).map((a: any) => [a.id, a]));
      for (const s of submissions || []) {
        (s as any).repliedByAdmin = (s as any).repliedByAdminId ? adminMap.get((s as any).repliedByAdminId) || null : null;
      }
    }

    return NextResponse.json({ submissions: (submissions || []).map(normalizeSubmission) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}