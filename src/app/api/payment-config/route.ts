import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data: config } = await supabase
      .from('PaymentConfig')
      .select('provider, sendMoneyNumber, qrCodeUrl')
      .eq('id', 'default')
      .limit(1)
      .maybeSingle();

    if (!config) {
      return NextResponse.json({
        provider: 'bkash',
        sendMoneyNumber: '01723084529',
        qrCodeUrl: '',
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
        },
      });
    }

    return NextResponse.json({
      provider: config.provider || 'bkash',
      sendMoneyNumber: config.sendMoneyNumber || '01723084529',
      qrCodeUrl: '',
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    console.error('Failed to fetch payment configuration:', error);
    return NextResponse.json({
      provider: 'bkash',
      sendMoneyNumber: '01723084529',
      qrCodeUrl: '',
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    });
  }
}
