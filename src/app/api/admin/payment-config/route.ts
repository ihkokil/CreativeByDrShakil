import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { getAuthPayload } from '@/lib/route-auth';

async function checkAdminOrTeacher(request: NextRequest) {
  const payload = await getAuthPayload(request);
  if (!payload) {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) };
  }

  if (payload.role !== 'admin' && payload.role !== 'teacher') {
    return { ok: false as const, response: NextResponse.json({ error: 'Forbidden: Admin or Teacher access required.' }, { status: 403 }) };
  }

  return { ok: true as const, payload };
}

export async function GET(request: NextRequest) {
  try {
    const authCheck = await checkAdminOrTeacher(request);
    if (!authCheck.ok) return authCheck.response;

    const supabase = getSupabaseAdmin();
    const { data: config }: { data: any } = await supabase
      .from('PaymentConfig')
      .select('provider, sendMoneyNumber, qrCodeUrl')
      .eq('id', 'default')
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      provider: config?.provider || 'bkash',
      sendMoneyNumber: config?.sendMoneyNumber || '01723084529',
      qrCodeUrl: '',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authCheck = await checkAdminOrTeacher(request);
    if (!authCheck.ok) return authCheck.response;

    const body = await request.json();
    const sendMoneyNumber = String(body?.sendMoneyNumber || '').trim();

    if (!sendMoneyNumber) {
      return NextResponse.json({ error: 'Send money number is required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    
    const { error: upsertError } = await supabase
      .from('PaymentConfig')
      // @ts-ignore
      .upsert({
        id: 'default',
        provider: 'bkash',
        sendMoneyNumber,
        qrCodeUrl: '',
        createdAt: now,
        updatedAt: now,
      }, { onConflict: 'id' });
      
    if (upsertError) throw upsertError;

    const config = {
      provider: 'bkash',
      sendMoneyNumber,
      qrCodeUrl: '',
    };

    return NextResponse.json({ success: true, config });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error.' }, { status: 500 });
  }
}
