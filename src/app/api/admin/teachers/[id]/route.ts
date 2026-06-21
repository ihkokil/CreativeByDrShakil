import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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

        const updatedTeacher = await prisma.user.update({
            where: { id: params.id },
            data: {
                fullName,
                email,
                designation: designation || null,
                institution: institution || null,
                degrees: degrees || null,
                profileImage: profileImage || null
            },
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

        const teacherToDelete = await prisma.user.findUnique({ where: { id: params.id } });
        if (!teacherToDelete) {
            return NextResponse.json({ error: 'Teacher not found.' }, { status: 404 });
        }

        if (reassignToId) {
            const replacementTeacher = await prisma.user.findUnique({ where: { id: reassignToId } });
            if (!replacementTeacher) {
                return NextResponse.json({ error: 'Replacement teacher not found.' }, { status: 404 });
            }

            // The instructor field is a string, it might hold name or ID depending on how it was created
            // We update courses matching either the old ID or old full name to the NEW name or ID.
            // Assuming it holds the true name like in INSTRUCTORS list, or maybe ID. We'll update both matches to new teacher ID.
            
            await prisma.course.updateMany({
                where: { instructor: teacherToDelete.id },
                data: { instructor: replacementTeacher.id }
            });

            await prisma.course.updateMany({
                where: { instructor: teacherToDelete.fullName },
                data: { instructor: replacementTeacher.fullName }
            });
        }

        await prisma.user.delete({
            where: { id: params.id },
        });

        return NextResponse.json({ success: true, message: 'Teacher deleted successfully.' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
    }
}
