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
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        user_metadata: {
          full_name: user.fullName,
          phone: user.phone,
          bmdc_number: user.bmdcNumber,
          profile_image: user.profileImage,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
