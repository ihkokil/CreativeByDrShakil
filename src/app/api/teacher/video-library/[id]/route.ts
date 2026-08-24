import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';
import { cleanupDeletedVideoLibraryNode } from '@/lib/curriculum-cleanup';
import { findCourseForMediaVaultFolder } from '@/lib/course-media-vault-sync';

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
        const supabase = getSupabaseAdmin();

        const { data: existing } = await supabase
            .from('VideoLibraryNode')
            .select('id, type, url, parentId')
            .eq('id', id)
            .limit(1)
            .maybeSingle();
            
        if (!existing) {
            return NextResponse.json({ error: 'Node not found.' }, { status: 404 });
        }

        const body = await request.json();
        const data: Record<string, any> = {};

        const targetQuizId = body.quizId || (body.type === 'quiz' && body.url ? body.url : null);
        if (targetQuizId || body.type === 'quiz') {
            const quizIdToLookup = targetQuizId || existing.url;
            if (quizIdToLookup) {
                const { data: targetQuiz } = await supabase
                    .from('Quiz')
                    .select('id, title, durationMinutes, status')
                    .eq('id', quizIdToLookup)
                    .limit(1)
                    .maybeSingle();

                if (!targetQuiz) {
                    return NextResponse.json({ error: 'Selected quiz not found in records.' }, { status: 404 });
                }

                data.type = 'quiz';
                data.url = targetQuiz.id;
                data.title = body.title !== undefined ? String(body.title).trim() : targetQuiz.title;
                data.duration = targetQuiz.durationMinutes ? `${targetQuiz.durationMinutes} min` : null;

                // Sync CourseQuiz if this node resides in a course structure
                try {
                    let currParentId = existing.parentId;
                    let rootCourseFolder: any = null;
                    while (currParentId) {
                        const { data: pNode } = await supabase
                            .from('VideoLibraryNode')
                            .select('id, title, parentId')
                            .eq('id', currParentId)
                            .maybeSingle();
                        if (!pNode) break;
                        if (!pNode.parentId) {
                            rootCourseFolder = pNode;
                            break;
                        }
                        currParentId = pNode.parentId;
                    }

                    if (rootCourseFolder) {
                        const course = await findCourseForMediaVaultFolder(supabase, rootCourseFolder);

                        if (course) {
                            // If old quiz was linked, update or insert new CourseQuiz
                            const oldQuizId = existing.url;
                            if (oldQuizId && oldQuizId !== targetQuiz.id) {
                                await supabase
                                    .from('CourseQuiz')
                                    .delete()
                                    .eq('courseId', course.id)
                                    .eq('quizId', oldQuizId);
                            }

                            const { data: existingCq } = await supabase
                                .from('CourseQuiz')
                                .select('id')
                                .eq('courseId', course.id)
                                .eq('quizId', targetQuiz.id)
                                .maybeSingle();

                            if (existingCq) {
                                await supabase
                                    .from('CourseQuiz')
                                    .update({
                                        curriculumNodeId: existing.parentId,
                                        updatedAt: new Date().toISOString(),
                                    } as any)
                                    .eq('id', existingCq.id);
                            } else {
                                await supabase.from('CourseQuiz').insert({
                                    id: crypto.randomUUID(),
                                    courseId: course.id,
                                    quizId: targetQuiz.id,
                                    curriculumNodeId: existing.parentId,
                                } as any);
                            }
                        }
                    }
                } catch (linkErr) {
                    console.warn('CourseQuiz sync warning during quiz node update:', linkErr);
                }
            }
        }

        if (body.title !== undefined && data.title === undefined) data.title = String(body.title).trim();
        if (body.url !== undefined && data.url === undefined) data.url = body.url ? String(body.url).trim() : null;
        if (body.duration !== undefined && data.duration === undefined) data.duration = body.duration ? String(body.duration).trim() : null;
        if (body.type !== undefined && data.type === undefined) {
            const type = String(body.type).trim();
            if (!['folder', 'youtube', 'self-hosted', 'document', 'quiz'].includes(type)) {
                return NextResponse.json({ error: 'Invalid type.' }, { status: 400 });
            }
            data.type = type;
        }
        if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);
        if (body.attachments !== undefined) data.attachments = Array.isArray(body.attachments) ? body.attachments : null;

        if (Object.keys(data).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
        }

        data.updatedAt = new Date().toISOString();

        // @ts-ignore
        const { error: updateError } = await supabase.from('VideoLibraryNode').update(data).eq('id', id);
        if (updateError) throw updateError;
        
        const { data: node } = await supabase
            .from('VideoLibraryNode')
            .select('*')
            .eq('id', id)
            .limit(1)
            .maybeSingle();

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
        const supabase = getSupabaseAdmin();

        const { data: existing } = await supabase
            .from('VideoLibraryNode')
            .select('id, type, url, parentId')
            .eq('id', id)
            .limit(1)
            .maybeSingle();
            
        if (!existing) {
            return NextResponse.json({ error: 'Node not found.' }, { status: 404 });
        }

        // Cascade delete descendant nodes, CourseQuiz records, Course curriculumJson, and progress
        await cleanupDeletedVideoLibraryNode(supabase, id);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
    }
}
