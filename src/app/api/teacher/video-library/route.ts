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

// GET — Fetch all library nodes as a flat list (frontend builds the tree)
export async function GET(request: NextRequest) {
    try {
        const authCheck = await requireTeacherOrAdmin(request);
        if (!authCheck.ok) return authCheck.response;

        const nodes = await db.videoLibraryNode.findMany({
            orderBy: [
                { sortOrder: 'asc' },
                { createdAt: 'asc' }
            ],
            select: {
                id: true,
                title: true,
                type: true,
                url: true,
                duration: true,
                parentId: true,
                attachments: true,
                sortOrder: true,
            },
        });

        return NextResponse.json({ nodes });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
    }
}

// POST — Create a new node (folder or video)
export async function POST(request: NextRequest) {
    try {
        const authCheck = await requireTeacherOrAdmin(request);
        if (!authCheck.ok) return authCheck.response;

        const body = await request.json();
        const title = String(body?.title || '').trim();
        const type = String(body?.type || 'folder').trim();
        const url = body?.url ? String(body.url).trim() : null;
        const duration = body?.duration ? String(body.duration).trim() : null;
        const parentId = body?.parentId || null;
        const attachments = Array.isArray(body?.attachments) ? body.attachments : null;

        if (!title) {
            return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
        }

        if (!['folder', 'youtube', 'vimeo', 'self-hosted', 'document'].includes(type)) {
            return NextResponse.json({ error: 'Invalid type.' }, { status: 400 });
        }

        if (parentId) {
            const parent = await db.videoLibraryNode.findUnique({ where: { id: parentId } });
            if (!parent) {
                return NextResponse.json({ error: 'Parent node not found.' }, { status: 404 });
            }
        }

        const maxOrderResult = await db.videoLibraryNode.aggregate({
            _max: { sortOrder: true },
            where: { parentId: parentId || null }
        });
        const nextOrder = (maxOrderResult._max.sortOrder ?? -1) + 1;

        const node = await db.videoLibraryNode.create({
            data: {
                id: crypto.randomUUID(),
                title,
                type,
                url,
                duration,
                parentId,
                attachments: attachments as any,
                sortOrder: nextOrder,
            }
        });

        return NextResponse.json({ node }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
    }
}
