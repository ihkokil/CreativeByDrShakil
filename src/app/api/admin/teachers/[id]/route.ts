import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
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

        const { fullName, email, designation, institution, degrees, profileImage } = await request.json();

        const supabase = getSupabaseAdmin();
        
        const { error: updateError } = await supabase
            .from('User')
            // @ts-ignore: Supabase types expect never for update on untyped schema
            .update({
                fullName,
                email,
                designation: designation || null,
                institution: institution || null,
                degrees: degrees || null,
                profileImage: profileImage || null
            })
            .eq('id', params.id);
            
        if (updateError) throw updateError;

        const { data: updatedTeacher } = await supabase
            .from('User')
            .select('*')
            .eq('id', params.id)
            .limit(1)
            .maybeSingle();

        return NextResponse.json({ success: true, teacher: updatedTeacher });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
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

        const { reassignToId } = await request.json();
        const supabase = getSupabaseAdmin();

        const { data: teacherToDelete }: { data: any } = await supabase
            .from('User')
            .select('*')
            .eq('id', params.id)
            .limit(1)
            .maybeSingle();
            
        if (!teacherToDelete) {
            return NextResponse.json({ error: 'Teacher not found.' }, { status: 404 });
        }

        if (reassignToId) {
            const { data: replacementTeacher }: { data: any } = await supabase
                .from('User')
                .select('*')
                .eq('id', reassignToId)
                .limit(1)
                .maybeSingle();
                
            if (!replacementTeacher) {
                return NextResponse.json({ error: 'Replacement teacher not found.' }, { status: 404 });
            }

            await supabase
                .from('Course')
                // @ts-ignore: Supabase types expect never for update on untyped schema
                .update({ instructor: replacementTeacher.id })
                .eq('instructor', teacherToDelete.id);

            if (teacherToDelete.fullName && replacementTeacher.fullName) {
                await supabase
                    .from('Course')
                    // @ts-ignore: Supabase types expect never for update on untyped schema
                    .update({ instructor: replacementTeacher.fullName })
                    .eq('instructor', teacherToDelete.fullName);
            }
        }

        const { error: deleteError } = await supabase.from('User').delete().eq('id', params.id);
        if (deleteError) throw deleteError;

        return NextResponse.json({ success: true, message: 'Teacher deleted successfully.' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
    }
}
