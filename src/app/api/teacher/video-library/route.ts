import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
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

        const supabase = getSupabaseAdmin();
        
        const { data: nodes = [], error } = await supabase
            .from('VideoLibraryNode')
            .select('id, title, type, url, duration, parentId, attachments, sortOrder')
            .order('sortOrder', { ascending: true })
            .order('createdAt', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ nodes: nodes || [] });
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

        if (!['folder', 'youtube', 'self-hosted', 'document'].includes(type)) {
            return NextResponse.json({ error: 'Invalid type.' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        if (parentId) {
            const { data: parent } = await supabase
              .from('VideoLibraryNode')
              .select('id')
              .eq('id', parentId)
              .limit(1)
              .maybeSingle();
              
            if (!parent) {
                return NextResponse.json({ error: 'Parent node not found.' }, { status: 404 });
            }
        }

        let query = supabase.from('VideoLibraryNode').select('sortOrder').order('sortOrder', { ascending: false }).limit(1);
        if (parentId) {
            query = query.eq('parentId', parentId);
        } else {
            query = query.is('parentId', null);
        }
        
        const { data: result } = await query.maybeSingle();
        const nextOrder = ((result as any)?.sortOrder ?? -1) + 1;

        const nodeId = crypto.randomUUID();
        const nowStr = new Date().toISOString();
        const insertValues = {
            id: nodeId,
            title,
            type,
            url,
            duration,
            parentId,
            attachments,
            sortOrder: nextOrder,
            createdAt: nowStr,
            updatedAt: nowStr,
        };

        const { error: insertError } = await supabase.from('VideoLibraryNode')
// @ts-ignore
.insert(insertValues as any);
        if (insertError) throw insertError;

        const node = {
            ...insertValues,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        return NextResponse.json({ node }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
    }
}
