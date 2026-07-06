import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';
import { eq, and, or, inArray, desc, asc, isNull, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { createId } from '@paralleldrive/cuid2';

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

        const nodes = await db.query.videoLibraryNodes.findMany({
            orderBy: [
                asc(schema.videoLibraryNodes.sortOrder),
                asc(schema.videoLibraryNodes.createdAt)
            ],
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
            const parent = await db.query.videoLibraryNodes.findFirst({ where: eq(schema.videoLibraryNodes.id, parentId) });
            if (!parent) {
                return NextResponse.json({ error: 'Parent node not found.' }, { status: 404 });
            }
        }

        const maxOrderResult = await db.select({ maxOrder: sql<number>`max(${schema.videoLibraryNodes.sortOrder})` })
            .from(schema.videoLibraryNodes)
            .where(parentId ? eq(schema.videoLibraryNodes.parentId, parentId) : isNull(schema.videoLibraryNodes.parentId));
        const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

        const id = createId();
        await db.insert(schema.videoLibraryNodes).values({
            id,
            title,
            type,
            url,
            duration,
            parentId,
            attachments: attachments as any,
            sortOrder: nextOrder,
        });

        const node = await db.query.videoLibraryNodes.findFirst({
            where: eq(schema.videoLibraryNodes.id, id)
        });

        return NextResponse.json({ node }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
    }
}
