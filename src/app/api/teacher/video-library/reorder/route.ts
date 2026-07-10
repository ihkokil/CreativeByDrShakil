import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { videoLibraryNode as vlnSchema } from '@/db/schema';
import { eq, isNull } from 'drizzle-orm';
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
        const { id, direction, targetIndex } = body;

        if (!id || (direction !== 'up' && direction !== 'down' && typeof targetIndex !== 'number')) {
            return NextResponse.json({ error: 'Invalid parameters. Provide id + direction or id + targetIndex.' }, { status: 400 });
        }

        const node = await db.query.videoLibraryNode.findFirst({ where: (v, { eq }) => eq(v.id, id) });
        if (!node) {
            return NextResponse.json({ error: 'Node not found.' }, { status: 404 });
        }

        const siblings = await db.query.videoLibraryNode.findMany({
            where: (v, { eq, isNull }) => node.parentId ? eq(v.parentId, node.parentId) : isNull(v.parentId),
            orderBy: (v, { asc }) => [asc(v.sortOrder), asc(v.createdAt)],
        });

        const index = siblings.findIndex(s => s.id === id);
        if (index === -1) return NextResponse.json({ error: 'Node context missing.' }, { status: 500 });

        let reordered: typeof siblings;

        if (typeof targetIndex === 'number') {
            reordered = siblings.filter(s => s.id !== id);
            const insertAt = Math.min(targetIndex, reordered.length);
            const moved = siblings[index];
            reordered.splice(insertAt, 0, moved);

            if (insertAt === index) {
                return NextResponse.json({ success: true, changed: false });
            }
        } else {
            reordered = [...siblings];

            if (direction === 'up' && index > 0) {
                [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
            } else if (direction === 'down' && index < reordered.length - 1) {
                [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
            } else {
                return NextResponse.json({ success: true, changed: false });
            }
        }

        await db.transaction(async (tx) => {
            for (let idx = 0; idx < reordered.length; idx++) {
                await tx.update(vlnSchema)
                  .set({ sortOrder: idx })
                  .where(eq(vlnSchema.id, reordered[idx].id));
            }
        });

        return NextResponse.json({ success: true, changed: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal error.' }, { status: 500 });
    }
}
