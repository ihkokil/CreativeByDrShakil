import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { extractCookieToken } from '@/lib/auth-server';
import { requireTeacherPayload } from '@/lib/route-auth';

function escapeCSV(field: string | null | undefined): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  // If the field contains a comma, quote, or newline, it must be enclosed in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { id: quizId } = await params;
    const token = await extractCookieToken();
    const supabase = getSupabase(token);

    // Verify ownership
    const { data: quiz }: { data: any } = await supabase
      .from('Quiz')
      .select('id, title, createdBy')
      .eq('id', quizId)
      .limit(1)
      .maybeSingle();

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    }

    if (payload.role === 'teacher' && quiz.createdBy !== payload.sub) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
    }

    const { data: questions, error } = await supabase
      .from('Question')
      .select('*')
      .eq('quizId', quizId)
      .order('createdAt', { ascending: true });

    if (error) throw error;
    if (!questions) throw new Error('No questions found');

    const csvRows = [];
    // Header row mapping the expected import format
    csvRows.push(['Question Text', 'Option A', 'Option B', 'Option C', 'Option D', 'Option E', 'Correct Answer', 'Explanation'].map(escapeCSV).join(','));

    for (const q of questions) {
      const row = [
        q.questionText,
        q.optionA,
        q.optionB,
        q.optionC || '',
        q.optionD || '',
        q.optionE || '',
        q.correctOption,
        q.explanation || ''
      ];
      csvRows.push(row.map(escapeCSV).join(','));
    }

    const csvString = csvRows.join('\n');
    const safeTitle = quiz.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    return new NextResponse(csvString, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="quiz_${safeTitle}_questions.csv"`,
      },
    });

  } catch (error: any) {
    console.error('[quiz/export] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
