import { NextRequest, NextResponse } from 'next/server';
import { requireTeacherPayload } from '@/lib/route-auth';
import { getStarterCatalogSummary, STARTER_CATALOG } from '@/lib/starter-catalog';

export async function GET(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const verbose = request.nextUrl.searchParams.get('verbose') === '1';

    if (verbose) {
      return NextResponse.json({ topics: STARTER_CATALOG });
    }

    return NextResponse.json({ topics: getStarterCatalogSummary() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
