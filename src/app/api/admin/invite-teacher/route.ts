import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
    try {
        const { fullName, email } = await request.json();

        if (!fullName || !email) {
            return NextResponse.json(
                { error: 'Full name and email are required.' },
                { status: 400 }
            );
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!serviceRoleKey) {
            return NextResponse.json(
                { error: 'Server configuration error: missing service role key.' },
                { status: 500 }
            );
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // Verify the requesting user is an admin
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !requestingUser) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
        }

        // Check if requesting user is admin
        const { data: adminProfile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', requestingUser.id)
            .single();

        if (!adminProfile || adminProfile.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
        }

        // Invite the teacher via email (sends password set link)
        const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: {
                full_name: fullName,
            },
        });

        if (inviteError) {
            return NextResponse.json(
                { error: inviteError.message },
                { status: 400 }
            );
        }

        // Insert teacher profile
        if (inviteData.user) {
            await supabaseAdmin.from('profiles').upsert({
                id: inviteData.user.id,
                full_name: fullName,
                role: 'teacher',
            }, { onConflict: 'id' });
        }

        return NextResponse.json({
            success: true,
            message: `Invitation sent to ${email}. They will receive a link to set their password.`,
        });
    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal server error.' },
            { status: 500 }
        );
    }
}
