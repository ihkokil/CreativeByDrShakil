import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { videoLibraryNode as vlnSchema } from '@/db/schema';
import { eq, max, isNull } from 'drizzle-orm';
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

        const nodes = await db.query.videoLibraryNode.findMany({
            orderBy: (v, { asc }) => [asc(v.sortOrder), asc(v.createdAt)],
            columns: {
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
            const parent = await db.query.videoLibraryNode.findFirst({ where: (v, { eq }) => eq(v.id, parentId) });
            if (!parent) {
                return NextResponse.json({ error: 'Parent node not found.' }, { status: 404 });
            }
        }

        const result = await db.select({ _max: max(vlnSchema.sortOrder) })
            .from(vlnSchema)
            .where(parentId ? eq(vlnSchema.parentId, parentId) : isNull(vlnSchema.parentId));
        const nextOrder = (result[0]?._max ?? -1) + 1;

        const [node] = await db.insert(vlnSchema).values({
            id: crypto.randomUUID(),
            title,
            type,
            url,
            duration,
            parentId,
            attachments,
            sortOrder: nextOrder,
        }).returning();

        return NextResponse.json({ node }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
    }
}
