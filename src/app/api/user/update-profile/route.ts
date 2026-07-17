import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';

export async function POST(request: NextRequest) {
  try {
    const bearerToken = extractBearerToken(request);
    const cookieToken = await extractCookieToken();
    const token = bearerToken || cookieToken;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const payload = await verifyAuthToken(token);
    const { fullName, phone, bmdcNumber, profileImage } = await request.json();

    if (!fullName) {
      return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { error: updateError } = await supabase
      .from('User')
      // @ts-ignore
      .update({
        fullName,
        phone: phone || null,
        bmdcNumber: bmdcNumber || null,
        profileImage: profileImage || null,
      })
      .eq('id', payload.sub);

    if (updateError) throw updateError;

    const { data: user, error: userError } = await supabase
      .from('User')
      .select('id, email, phone, role, fullName, bmdcNumber, profileImage')
      .eq('id', payload.sub)
      .limit(1)
      .maybeSingle();

    if (userError) throw userError;

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: (user as any).id,
        email: (user as any).email,
        phone: (user as any).phone,
        role: (user as any).role,
        user_metadata: {
          full_name: (user as any).fullName,
          phone: (user as any).phone,
          bmdc_number: (user as any).bmdcNumber,
          profile_image: (user as any).profileImage,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
