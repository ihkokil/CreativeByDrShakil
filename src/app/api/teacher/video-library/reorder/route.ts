import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';

async function requireTeacherOrAdmin(request: NextRequest) {
    const bearerToken = extractBearerToken(request);
    const cookieToken = await extractCookieToken();
    const token = bearerToken || cookieToken;

    if (!token) {
        return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) };
    }

    try {
        const payload = verifyAuthToken(token);
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

        const node = await prisma.videoLibraryNode.findUnique({ where: { id } });
        if (!node) {
            return NextResponse.json({ error: 'Node not found.' }, { status: 404 });
        }

        const siblings = await prisma.videoLibraryNode.findMany({
            where: { parentId: node.parentId },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
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

        const updates = reordered.map((item, idx) => 
            prisma.videoLibraryNode.update({
                where: { id: item.id },
                data: { sortOrder: idx },
            })
        );
        
        await prisma.$transaction(updates);

        return NextResponse.json({ success: true, changed: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal error.' }, { status: 500 });
    }
}
