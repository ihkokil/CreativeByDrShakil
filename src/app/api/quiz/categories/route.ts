import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quizCategory } from '@/db/schema';
import { eq, desc, asc } from 'drizzle-orm';
import { getAuthPayload, requireTeacherPayload } from '@/lib/route-auth';
import { nanoid } from '@/lib/nanoid';

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request);
    
    const categories = await db.query.quizCategory.findMany({
      orderBy: (c, { asc }) => [asc(c.displayName)],
    });
    
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
    
    const existing = await db.query.quizCategory.findFirst({ where: eq(quizCategory.name, name) });
    if (existing) {
      return NextResponse.json({ error: 'A category with this name already exists.' }, { status: 400 });
    }
    
    const categoryId = nanoid();
    const now = new Date();
    
    const nowStr = now.toISOString();
    const insertValues = {
      id: categoryId,
      name,
      displayName,
      description,
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    await db.insert(quizCategory).values(insertValues);
    
    return NextResponse.json({ category: insertValues }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/quiz/categories error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}