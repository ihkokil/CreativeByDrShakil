import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/db'

export async function GET() {
  try {
    const supabase = getSupabase();
    
    const { data: config } = await supabase
      .from('PaymentConfig')
      .select('provider, sendMoneyNumber, qrCodeUrl')
      .eq('id', 'default')
      .limit(1)
      .maybeSingle();

    if (!config) {
      return NextResponse.json({
        provider: 'bkash',
        sendMoneyNumber: '01700000000',
        qrCodeUrl: '/uploads/bkash-qr/bkash-qr.png',
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
        },
      })
    }

    return NextResponse.json(config, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    })
  } catch (error) {
    console.error('Failed to fetch payment configuration:', error);
    return NextResponse.json({
      provider: 'bkash',
      sendMoneyNumber: '01700000000',
      qrCodeUrl: '/uploads/bkash-qr/bkash-qr.png',
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    })
  }
}
