import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';

async function requireTeacherOrAdmin(request: NextRequest) {
    const bearerToken = extractBearerToken(request);
    const cookieToken = await extractCookieToken();
    const token = bearerToken || cookieToken;

    if (!token) {
        return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) };
    }

    try {
        const payload = await verifyAuthToken(token);
        if (payload.role !== 'teacher' && payload.role !== 'admin') {
            return {
                ok: false as const,
                response: NextResponse.json({ error: 'Forbidden: Teacher or Admin access required.' }, { status: 403 }),
            };
        }
        return { ok: true as const, userId: payload.sub };
    } catch {
        return { ok: false as const, response: NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 }) };
    }
}

// PATCH — Update a node's title, url, duration, or type
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authCheck = await requireTeacherOrAdmin(request);
        if (!authCheck.ok) return authCheck.response;

        const { id } = await params;

        const existing = await db.videoLibraryNode.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: 'Node not found.' }, { status: 404 });
        }

        const body = await request.json();
        const data: Record<string, any> = {};

        if (body.title !== undefined) data.title = String(body.title).trim();
        if (body.url !== undefined) data.url = body.url ? String(body.url).trim() : null;
        if (body.duration !== undefined) data.duration = body.duration ? String(body.duration).trim() : null;
        if (body.type !== undefined) {
            const type = String(body.type).trim();
            if (!['folder', 'youtube', 'vimeo', 'self-hosted', 'document'].includes(type)) {
                return NextResponse.json({ error: 'Invalid type.' }, { status: 400 });
            }
            data.type = type;
        }
        if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);
        if (body.attachments !== undefined) data.attachments = Array.isArray(body.attachments) ? body.attachments : null;

        if (Object.keys(data).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
        }

        const node = await db.videoLibraryNode.update({
            where: { id },
            data
        });

        return NextResponse.json({ node });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
    }
}

// DELETE — Delete a node (cascade deletes children)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authCheck = await requireTeacherOrAdmin(request);
        if (!authCheck.ok) return authCheck.response;

        const { id } = await params;

        const existing = await db.videoLibraryNode.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: 'Node not found.' }, { status: 404 });
        }

        // Prisma cascade handles children deletion via the schema relation
        await db.videoLibraryNode.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
    }
}
