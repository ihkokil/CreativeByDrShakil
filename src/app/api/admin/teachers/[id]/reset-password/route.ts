import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';
import { createTokenPair } from '@/lib/token-utils';
import { sendPasswordResetEmail } from '@/lib/auth-emails';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const bearerToken = extractBearerToken(request);
        const cookieToken = await extractCookieToken();
        const token = bearerToken || cookieToken;

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
        }

        const payload = await verifyAuthToken(token);
        if (payload.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
        }

        const supabase = getSupabase();
        
            const { data: teacher }: { data: any } = await supabase
                .from('User')
                .select('*')
                .eq('id', params.id)
                .limit(1)
                .maybeSingle();

        if (!teacher) {
            return NextResponse.json({ error: 'Teacher not found.' }, { status: 404 });
        }

        const { token: resetToken, tokenHash } = await createTokenPair();
        const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);

        const { error: updateError } = await supabase
            .from('User')
            // @ts-ignore: Supabase types expect never for update on untyped schema
            .update({
                passwordResetTokenHash: tokenHash,
                passwordResetExpires: resetExpiry.toISOString(),
            })
            .eq('id', teacher.id);

        if (updateError) throw updateError;

        await sendPasswordResetEmail({
            email: teacher.email,
            fullName: teacher.fullName,
            token: resetToken,
        });

        return NextResponse.json({ 
            success: true, 
            message: `Password reset email dispatched to ${teacher.email}.` 
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
    }
}
