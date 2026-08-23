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
        
        let { data: nodes = [], error } = await supabase
            .from('VideoLibraryNode')
            .select('id, title, type, url, duration, parentId, attachments, sortOrder')
            .order('sortOrder', { ascending: true })
            .order('createdAt', { ascending: true });

        if (error) throw error;

        // Auto-repair / Migration logic:
        // 1. Ensure every root course folder has an "All Resources" folder at sortOrder: -2
        // 2. Ensure every root course folder has an "All Quizes" folder at sortOrder: -1
        // 3. Wrap any direct non-folder nodes in root course folders into wrapper folders
        let databaseModified = false;
        const allNodes = nodes || [];
        const rootCourseNodes = allNodes.filter((n: any) => n.parentId === null && n.type === 'folder');

        for (const rootNode of rootCourseNodes) {
            const nowStr = new Date().toISOString();

            // 1. Check for "All Resources" folder
            const allResNode = allNodes.find(
                (n: any) => n.parentId === rootNode.id && String(n.title).trim().toLowerCase() === 'all resources'
            );
            if (!allResNode) {
                const allResId = crypto.randomUUID();
                await supabase.from('VideoLibraryNode').insert({
                    id: allResId,
                    title: 'All Resources',
                    type: 'folder',
                    parentId: rootNode.id,
                    sortOrder: -2,
                    createdAt: nowStr,
                    updatedAt: nowStr,
                } as any);
                databaseModified = true;
            } else if (allResNode.sortOrder !== -2) {
                await supabase.from('VideoLibraryNode').update({ sortOrder: -2 } as any).eq('id', allResNode.id);
                databaseModified = true;
            }

            // 2. Check for "All Quizes" folder
            const allQuizNode = allNodes.find(
                (n: any) => n.parentId === rootNode.id && (String(n.title).trim().toLowerCase() === 'all quizes' || String(n.title).trim().toLowerCase() === 'all quizzes')
            );
            if (!allQuizNode) {
                const allQuizId = crypto.randomUUID();
                await supabase.from('VideoLibraryNode').insert({
                    id: allQuizId,
                    title: 'All Quizes',
                    type: 'folder',
                    parentId: rootNode.id,
                    sortOrder: -1,
                    createdAt: nowStr,
                    updatedAt: nowStr,
                } as any);
                databaseModified = true;
            } else if (allQuizNode.sortOrder !== -1) {
                await supabase.from('VideoLibraryNode').update({ sortOrder: -1 } as any).eq('id', allQuizNode.id);
                databaseModified = true;
            }

            // 3. Check for non-folder direct children under root course folder
            const directNonFolderChildren = allNodes.filter(
                (n: any) => n.parentId === rootNode.id && n.type !== 'folder'
            );
            for (const child of directNonFolderChildren) {
                const wrapperId = crypto.randomUUID();
                // Create wrapper folder
                await supabase.from('VideoLibraryNode').insert({
                    id: wrapperId,
                    title: child.title,
                    type: 'folder',
                    parentId: rootNode.id,
                    sortOrder: child.sortOrder,
                    createdAt: nowStr,
                    updatedAt: nowStr,
                } as any);
                // Move child inside wrapper folder
                await supabase.from('VideoLibraryNode').update({
                    parentId: wrapperId,
                } as any).eq('id', child.id);
                databaseModified = true;
            }
        }

        // 4. Verify Quiz nodes against Quiz table (auto-remove orphaned quizzes & sync titles/durations)
        const quizNodes = (allNodes || []).filter((n: any) => n.type === 'quiz');
        if (quizNodes.length > 0) {
            const quizIds = quizNodes.map((n: any) => n.url).filter(Boolean);
            const { data: existingQuizzes } = await supabase
                .from('Quiz')
                .select('id, title, durationMinutes, status')
                .in('id', quizIds);

            const existingQuizMap = new Map((existingQuizzes || []).map((q: any) => [q.id, q]));
            const orphanedQuizNodeIds: string[] = [];

            for (const qNode of quizNodes) {
                const targetQuizId = qNode.url;
                if (!targetQuizId || !existingQuizMap.has(targetQuizId)) {
                    orphanedQuizNodeIds.push(qNode.id);
                } else {

                    const actualQuiz = existingQuizMap.get(targetQuizId)!;
                    const expectedDuration = actualQuiz.durationMinutes ? `${actualQuiz.durationMinutes} min` : null;
                    if (qNode.title !== actualQuiz.title || (qNode.duration || null) !== expectedDuration) {
                        await supabase
                            .from('VideoLibraryNode')
                            .update({
                                title: actualQuiz.title,
                                duration: expectedDuration,
                                updatedAt: new Date().toISOString(),
                            } as any)
                            .eq('id', qNode.id);
                        databaseModified = true;
                    }
                }
            }

            if (orphanedQuizNodeIds.length > 0) {
                await supabase.from('VideoLibraryNode').delete().in('id', orphanedQuizNodeIds);
                databaseModified = true;
            }
        }

        if (databaseModified) {
            const { data: updatedNodes } = await supabase
                .from('VideoLibraryNode')
                .select('id, title, type, url, duration, parentId, attachments, sortOrder')
                .order('sortOrder', { ascending: true })
                .order('createdAt', { ascending: true });
            nodes = updatedNodes || [];
        }


        return NextResponse.json({ nodes: nodes || [] });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
    }
}

// POST — Create a new node (folder, video, document, or quiz)
export async function POST(request: NextRequest) {
    try {
        const authCheck = await requireTeacherOrAdmin(request);
        if (!authCheck.ok) return authCheck.response;

        const body = await request.json();
        const type = String(body?.type || 'folder').trim();
        let parentId = body?.parentId || null;

        if (!['folder', 'youtube', 'self-hosted', 'document', 'quiz'].includes(type)) {
            return NextResponse.json({ error: 'Invalid type.' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();
        const nowStr = new Date().toISOString();

        // Find parent node if exists
        let parentNode: any = null;
        let rootCourseFolder: any = null;

        if (parentId) {
            const { data: parent } = await supabase
              .from('VideoLibraryNode')
              .select('*')
              .eq('id', parentId)
              .limit(1)
              .maybeSingle();
              
            if (!parent) {
                return NextResponse.json({ error: 'Parent node not found.' }, { status: 404 });
            }
            parentNode = parent;

            // Traverse up to find root course folder
            let current: any = parent;
            while (current && current.parentId !== null) {
                const { data: ancestor } = await supabase
                    .from('VideoLibraryNode')
                    .select('*')
                    .eq('id', current.parentId)
                    .limit(1)
                    .maybeSingle();
                current = ancestor;
            }
            rootCourseFolder = current;
        }

        // Handle Quizzes
        if (type === 'quiz') {
            const quizIds: string[] = Array.isArray(body?.quizIds) && body.quizIds.length > 0
                ? body.quizIds
                : (body?.quizId ? [body.quizId] : (body?.url ? [body.url] : []));

            if (quizIds.length === 0) {
                return NextResponse.json({ error: 'At least one quiz ID is required.' }, { status: 400 });
            }

            // Fetch quiz details
            const { data: quizzes = [] } = await supabase
                .from('Quiz')
                .select('id, title, durationMinutes')
                .in('id', quizIds);

            if (!quizzes || quizzes.length === 0) {
                return NextResponse.json({ error: 'Selected quiz(zes) not found.' }, { status: 404 });
            }

            // Match root course folder to Course table
            let course: any = null;
            if (rootCourseFolder) {
                const { data: courseData } = await supabase
                    .from('Course')
                    .select('id, title')
                    .ilike('title', rootCourseFolder.title)
                    .limit(1)
                    .maybeSingle();
                course = courseData;
            }

            const isAllQuizzesFolder = parentNode && (
                String(parentNode.title).trim().toLowerCase() === 'all quizes' ||
                String(parentNode.title).trim().toLowerCase() === 'all quizzes'
            );

            // Check if any quizzes are already linked to another course
            if (course) {
                const { data: existingLinks = [] } = await supabase
                    .from('CourseQuiz')
                    .select('quizId, courseId')
                    .in('quizId', quizIds);

                const conflicting = (existingLinks || []).filter((l: any) => l.courseId !== course.id);
                if (conflicting.length > 0) {
                    return NextResponse.json(
                        { error: 'One or more selected quizzes are already linked to another course.' },
                        { status: 400 }
                    );
                }
            }

            let query = supabase.from('VideoLibraryNode').select('sortOrder').order('sortOrder', { ascending: false }).limit(1);
            if (parentId) {
                query = query.eq('parentId', parentId);
            } else {
                query = query.is('parentId', null);
            }
            const { data: result } = await query.maybeSingle();
            let nextOrder = ((result as any)?.sortOrder ?? -1) + 1;

            const insertedNodes: any[] = [];
            for (const q of quizzes) {
                // Check if already in this folder
                const { data: alreadyInFolder } = await supabase
                    .from('VideoLibraryNode')
                    .select('id')
                    .eq('parentId', parentId)
                    .eq('type', 'quiz')
                    .eq('url', q.id)
                    .limit(1)
                    .maybeSingle();

                if (!alreadyInFolder) {
                    const nodeId = crypto.randomUUID();
                    const insertValues = {
                        id: nodeId,
                        title: q.title,
                        type: 'quiz',
                        url: q.id,
                        duration: q.durationMinutes ? `${q.durationMinutes} min` : null,
                        parentId,
                        sortOrder: nextOrder++,
                        createdAt: nowStr,
                        updatedAt: nowStr,
                    };
                    await supabase.from('VideoLibraryNode').insert(insertValues as any);
                    insertedNodes.push(insertValues);
                }

                // Link CourseQuiz if course exists
                if (course) {
                    const { data: existingCq } = await supabase
                        .from('CourseQuiz')
                        .select('id')
                        .eq('courseId', course.id)
                        .eq('quizId', q.id)
                        .limit(1)
                        .maybeSingle();

                    const targetCurriculumNodeId = isAllQuizzesFolder ? null : parentId;

                    if (existingCq) {
                        await supabase
                            .from('CourseQuiz')
                            .update({
                                curriculumNodeId: targetCurriculumNodeId,
                                updatedAt: nowStr,
                            } as any)
                            .eq('id', existingCq.id);
                    } else {
                        await supabase.from('CourseQuiz').insert({
                            id: crypto.randomUUID(),
                            courseId: course.id,
                            quizId: q.id,
                            curriculumNodeId: targetCurriculumNodeId,
                            sortOrder: nextOrder,
                            createdAt: nowStr,
                            updatedAt: nowStr,
                        } as any);
                    }
                }
            }

            return NextResponse.json({ success: true, nodes: insertedNodes, count: insertedNodes.length }, { status: 201 });
        }

        // Standard Folder / Video / Document node creation
        const title = String(body?.title || '').trim();
        const url = body?.url ? String(body.url).trim() : null;
        const duration = body?.duration ? String(body.duration).trim() : null;
        const attachments = Array.isArray(body?.attachments) ? body.attachments : null;

        if (!title) {
            return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
        }

        // If trying to add a video/document directly in a root course folder, auto-create wrapper folder
        const isParentRootCourseFolder = parentNode && parentNode.parentId === null;
        if (isParentRootCourseFolder && type !== 'folder') {
            let queryFolder = supabase.from('VideoLibraryNode').select('sortOrder').eq('parentId', parentId).order('sortOrder', { ascending: false }).limit(1);
            const { data: folderOrderRes } = await queryFolder.maybeSingle();
            const wrapperOrder = ((folderOrderRes as any)?.sortOrder ?? -1) + 1;
            
            const wrapperFolderId = crypto.randomUUID();

            await supabase.from('VideoLibraryNode').insert({
                id: wrapperFolderId,
                title,
                type: 'folder',
                parentId,
                sortOrder: wrapperOrder,
                createdAt: nowStr,
                updatedAt: nowStr,
            } as any);

            parentId = wrapperFolderId;
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
            createdAt: nowStr,
            updatedAt: nowStr,
        };

        return NextResponse.json({ node }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
    }
}
