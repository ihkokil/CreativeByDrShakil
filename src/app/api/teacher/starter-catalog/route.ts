import { NextRequest, NextResponse } from 'next/server';
import { requireTeacherPayload } from '@/lib/route-auth';
import { getStarterCatalogFromDB, getStarterCatalogSummary } from '@/lib/starter-catalog';

export async function GET(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const verbose = request.nextUrl.searchParams.get('verbose') === '1';

    if (verbose) {
      const catalog = await getStarterCatalogFromDB();
      return NextResponse.json({ topics: catalog });
    }

    const summary = await getStarterCatalogSummary();
    return NextResponse.json({ topics: summary });
  } catch (error: any) {
    console.error('[StarterCatalog Error]', error?.message || error);
    return NextResponse.json({ error: 'Failed to load starter catalog.' }, { status: 500 });
  }
}
