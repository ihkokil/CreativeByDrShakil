import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';

export async function GET() {
    try {
        const supabase = getSupabaseAdmin();
        
        // 1. Find the course
        const { data: courses, error: courseError } = await supabase
            .from('Course')
            .select('id, title')
            .limit(1);

        if (courseError) throw courseError;
        if (!courses || courses.length === 0) {
            return NextResponse.json({ error: 'No course found!' }, { status: 404 });
        }
        
        const courseTitle = courses[0].title;

        // 2. Create the folder in VideoLibraryNode
        const { data: existingFolder } = await supabase
            .from('VideoLibraryNode')
            .select('id')
            .eq('title', courseTitle)
            .is('parentId', null)
            .eq('type', 'folder')
            .limit(1)
            .maybeSingle();

        let folderId;
        
        if (existingFolder) {
            folderId = existingFolder.id;
        } else {
            folderId = crypto.randomUUID();
            const nowStr = new Date().toISOString();
            
            const { data: maxSort } = await supabase
                .from('VideoLibraryNode')
                .select('sortOrder')
                .is('parentId', null)
                .order('sortOrder', { ascending: false })
                .limit(1)
                .maybeSingle();
                
            const nextOrder = maxSort?.sortOrder !== undefined ? maxSort.sortOrder + 1 : 0;
            
            const { error: insertError } = await supabase
                .from('VideoLibraryNode')
// @ts-ignore
                .insert({
                    id: folderId,
                    title: courseTitle,
                    type: 'folder',
                    parentId: null,
                    sortOrder: nextOrder,
                    createdAt: nowStr,
                    updatedAt: nowStr
                });
                
            if (insertError) throw insertError;
        }

        // 3. Move all root modules (except the folder itself) into this new folder
        const { data: rootNodes } = await supabase
            .from('VideoLibraryNode')
            .select('id')
            .is('parentId', null)
            .neq('id', folderId);
            
        if (rootNodes && rootNodes.length > 0) {
            for (const node of rootNodes) {
                await supabase
                    .from('VideoLibraryNode')
                    .update({ parentId: folderId, updatedAt: new Date().toISOString() })
                    .eq('id', node.id);
            }
        }
        
        return NextResponse.json({ 
            success: true, 
            course: courseTitle, 
            folderId, 
            movedNodes: rootNodes?.length || 0 
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
