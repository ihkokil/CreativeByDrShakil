import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { extractCookieToken } from '@/lib/auth-server';
import { requireTeacherPayload } from '@/lib/route-auth';
import { nanoid } from '@/lib/nanoid';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { id: quizId } = await params;
    const body = await request.json();
    const { questions } = body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'questions array is required.' }, { status: 400 });
    }

    const token = await extractCookieToken();


    const supabase = getSupabase(token);

    const { data: quiz }: { data: any } = await supabase
      .from('Quiz')
      .select('id, createdBy')
      .eq('id', quizId)
      .limit(1)
      .maybeSingle();

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    }

    if (payload.role === 'teacher' && quiz.createdBy !== payload.sub) {
      return NextResponse.json({ error: 'Not authorized to import into this quiz.' }, { status: 403 });
    }

    const nowStr = new Date().toISOString();
    let imported = 0;

    for (const q of questions) {
      if (!q.questionText || !q.optionA || !q.optionB || !q.correctOption) {
        continue; // Skip invalid questions
      }

      await supabase.from('Question')
// @ts-ignore
.insert({
        id: nanoid(),
        quizId,
        questionText: q.questionText.trim(),
        questionType: q.questionType === 'true_false' ? 'true_false' : 'mcq',
        optionA: q.optionA.trim(),
        optionB: q.optionB.trim(),
        optionC: q.optionC?.trim() || null,
        optionD: q.optionD?.trim() || null,
        correctOption: q.correctOption.trim(),
        explanation: q.explanation?.trim() || null,
        createdAt: nowStr,
        updatedAt: nowStr,
      } as any);

      imported++;
    }

    // Update quiz updatedAt
    await supabase
      .from('Quiz')
      // @ts-ignore
      .update({ updatedAt: nowStr })
      .eq('id', quizId);

    return NextResponse.json({
      success: true,
      imported,
      message: `Imported ${imported} questions.`,
    });
  } catch (error: any) {
    console.error('[quiz/import] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
