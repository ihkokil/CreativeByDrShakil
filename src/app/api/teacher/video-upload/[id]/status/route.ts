import { NextRequest, NextResponse } from 'next/server';
import { getJobProgress } from '@/lib/video-job-store';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const progress = getJobProgress(id);

  if (!progress) {
    return NextResponse.json({
      stage: 'idle',
      progress: 0,
      message: 'No active job found or job completed.',
    });
  }

  return NextResponse.json(progress);
}
