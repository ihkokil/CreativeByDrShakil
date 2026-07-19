import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { extractCookieToken } from '@/lib/auth-server';
import { getAuthPayload, requireTeacherPayload } from '@/lib/route-auth';
import { nanoid } from '@/lib/nanoid';

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request);
    
    const token = await extractCookieToken();

    
    const supabase = getSupabase(token);
    const { data: categories = [] } = await supabase
      .from('QuizCategory')
      .select('*')
      .order('displayName', { ascending: true });
    
    return NextResponse.json({ categories });
  } catch (error: any) {
    console.error('GET /api/quiz/categories error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized. Teacher or admin access required.' }, { status: 401 });
    }
    
    const body = await request.json();
    const { name, displayName, description } = body;
    
    if (!name || !displayName) {
      return NextResponse.json({ error: 'Name and display name are required.' }, { status: 400 });
    }
    
    const token = await extractCookieToken();

    
    const supabase = getSupabase(token);
    const { data: existing } = await supabase
      .from('QuizCategory')
      .select('id')
      .eq('name', name)
      .limit(1)
      .maybeSingle();
      
    if (existing) {
      return NextResponse.json({ error: 'A category with this name already exists.' }, { status: 400 });
    }
    
    const categoryId = nanoid();
    const nowStr = new Date().toISOString();
    
    const insertValues = {
      id: categoryId,
      name,
      displayName,
      description,
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    const { error: insertError } = await supabase.from('QuizCategory')
// @ts-ignore
.insert(insertValues as any);
    if (insertError) throw insertError;
    
    return NextResponse.json({ category: insertValues }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/quiz/categories error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}