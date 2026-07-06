import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';
import { eq, and, or, inArray, desc, asc, isNull, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';

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
                response: NextResponse.json({ error: 'Forbidden: Teacher access required.' }, { status: 403 }),
            };
        }
        return { ok: true as const, userId: payload.sub };
    } catch {
        return { ok: false as const, response: NextResponse.json({ error: 'Invalid token.' }, { status: 401 }) };
    }
}

export async function POST(request: NextRequest) {
    try {
        const authCheck = await requireTeacherOrAdmin(request);
        if (!authCheck.ok) return authCheck.response;

        const body = await request.json();
        const { id, direction } = body;

        if (!id || (direction !== 'up' && direction !== 'down')) {
            return NextResponse.json({ error: 'Invalid parameters.' }, { status: 400 });
        }

        const node = await db.query.videoLibraryNodes.findFirst({ where: eq(schema.videoLibraryNodes.id, id) });
        if (!node) {
            return NextResponse.json({ error: 'Node not found.' }, { status: 404 });
        }

        const siblings = await db.query.videoLibraryNodes.findMany({
            where: node.parentId ? eq(schema.videoLibraryNodes.parentId, node.parentId) : isNull(schema.videoLibraryNodes.parentId),
            orderBy: [
                asc(schema.videoLibraryNodes.sortOrder),
                asc(schema.videoLibraryNodes.createdAt)
            ],
        });

        const index = siblings.findIndex(s => s.id === id);
        if (index === -1) return NextResponse.json({ error: 'Node context missing.' }, { status: 500 });

        const reordered = [...siblings];

        if (direction === 'up' && index > 0) {
            [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
        } else if (direction === 'down' && index < reordered.length - 1) {
            [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
        } else {
            return NextResponse.json({ success: true, changed: false });
        }

        if (reordered.length > 0) {
            await db.transaction(async (tx) => {
                await Promise.all(reordered.map((n, idx) => 
                    tx.update(schema.videoLibraryNodes)
                      .set({ sortOrder: idx })
                      .where(eq(schema.videoLibraryNodes.id, n.id))
                ));
            });
        }

        return NextResponse.json({ success: true, changed: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal error.' }, { status: 500 });
    }
}
