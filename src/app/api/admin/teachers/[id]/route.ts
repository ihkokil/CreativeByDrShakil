import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
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

        const updatedTeacher = await db.user.update({
            where: { id: params.id },
            data: {
                fullName,
                email,
                designation: designation || null,
                institution: institution || null,
                degrees: degrees || null,
                profileImage: profileImage || null
            }
        });

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

        const teacherToDelete = await db.user.findUnique({ where: { id: params.id } });
        if (!teacherToDelete) {
            return NextResponse.json({ error: 'Teacher not found.' }, { status: 404 });
        }

        if (reassignToId) {
            const replacementTeacher = await db.user.findUnique({ where: { id: reassignToId } });
            if (!replacementTeacher) {
                return NextResponse.json({ error: 'Replacement teacher not found.' }, { status: 404 });
            }

            await db.course.updateMany({
                where: { instructor: teacherToDelete.id },
                data: { instructor: replacementTeacher.id }
            });

            if (teacherToDelete.fullName && replacementTeacher.fullName) {
                await db.course.updateMany({
                    where: { instructor: teacherToDelete.fullName },
                    data: { instructor: replacementTeacher.fullName }
                });
            }
        }

        await db.user.delete({ where: { id: params.id } });

        return NextResponse.json({ success: true, message: 'Teacher deleted successfully.' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
    }
}
