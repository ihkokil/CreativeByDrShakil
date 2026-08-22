import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';
import { nanoid } from '@/lib/nanoid';
import { recalculateQuizResults, normalizeQuestionType } from '@/lib/quiz-engine';

function parseCSV(text: string) {
  const result: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentVal = '';
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (inQuotes) {
      if (char === '"' && text[i+1] === '"') {
        currentVal += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(currentVal);
        currentVal = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && text[i+1] === '\n') {
          i++; // Skip \n
        }
        row.push(currentVal);
        result.push(row);
        row = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
  }
  
  if (currentVal !== '' || row.length > 0) {
    row.push(currentVal);
    result.push(row);
  }
  
  return result;
}

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
    const supabase = getSupabaseAdmin();

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return NextResponse.json({ error: 'File is required.' }, { status: 400 });
      }
      
      const text = await file.text();
      const parsed = parseCSV(text);
      
      if (parsed.length < 2) {
        return NextResponse.json({ error: 'File is empty or missing data.' }, { status: 400 });
      }
      
      const validRows: any[] = [];
      const invalidRows: any[] = [];
      
      for (let i = 1; i < parsed.length; i++) {
        const row = parsed[i];
        if (!row || row.length < 7 || row.every(c => !c.trim())) continue;
        
        const questionText = row[0]?.trim();
        const optionA = row[1]?.trim();
        const optionB = row[2]?.trim();
        const optionC = row[3]?.trim();
        const optionD = row[4]?.trim();
        const optionE = row[5]?.trim();
        const correctOption = row[6]?.trim()?.toUpperCase();
        const explanation = row[7]?.trim();
        
        let questionType: 'sba' | 'true_false' = 'sba';
        if (correctOption && /^[TF]{5}$/i.test(correctOption)) {
          questionType = 'true_false';
        } else if (correctOption && /^[A-E]$/i.test(correctOption)) {
          questionType = 'sba';
        }
        
        const errors = [];
        if (!questionText) errors.push('Question text missing');
        if (!correctOption) errors.push('Correct option missing');
        if (!optionA) errors.push('Option A missing');
        if (!optionB) errors.push('Option B missing');
        if (questionType === 'true_false' && correctOption.length !== 5) {
          errors.push('TRUE_FALSE answer must be exactly 5 characters of T and F (e.g. TFTFT)');
        }
        if (questionType === 'sba' && !/^[A-E]$/i.test(correctOption)) {
          errors.push('SBA answer must be a single letter from A to E');
        }
        
        if (errors.length > 0) {
          invalidRows.push({
            data: row,
            errors,
          });
        } else {
          validRows.push({
            questionType,
            questionText,
            explanation,
            correctOption,
            optionA,
            optionB,
            optionC,
            optionD,
            optionE,
          });
        }
      }
      
      return NextResponse.json({
        success: true,
        validCount: validRows.length,
        invalidCount: invalidRows.length,
        validRows,
        invalidRows,
      });
    }

    // JSON Body import
    const body = await request.json();
    const { questions } = body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'questions array is required.' }, { status: 400 });
    }

    if (quizId !== 'new') {
      const { data: quiz } = await supabase
        .from('Quiz')
        .select('id, createdBy')
        .eq('id', quizId)
        .limit(1)
        .maybeSingle();

      if (!quiz) {
        return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
      }

      if (payload.role === 'teacher' && (quiz as any).createdBy !== payload.sub) {
        return NextResponse.json({ error: 'Not authorized to import into this quiz.' }, { status: 403 });
      }
    }

    const nowStr = new Date().toISOString();
    let imported = 0;

    for (const q of questions) {
      if (!q.questionText || !q.optionA || !q.optionB || !q.correctOption) {
        continue;
      }

      const qType = normalizeQuestionType(q.questionType);
      let corr = String(q.correctOption).trim().toUpperCase();
      if (qType === 'true_false' && corr.length !== 5) {
        corr = corr.padEnd(5, 'F').slice(0, 5);
      }

      await supabase.from('Question')
        // @ts-ignore
        .insert({
          id: nanoid(),
          quizId: quizId === 'new' ? null : quizId,
          questionText: q.questionText.trim(),
          questionType: qType,
          optionA: q.optionA.trim(),
          optionB: q.optionB.trim(),
          optionC: q.optionC?.trim() || null,
          optionD: q.optionD?.trim() || null,
          optionE: q.optionE?.trim() || null,
          correctOption: corr,
          explanation: q.explanation?.trim() || null,
          createdAt: nowStr,
          updatedAt: nowStr,
        } as any);

      imported++;
    }

    if (quizId !== 'new') {
      try {
        await recalculateQuizResults(quizId, supabase);
      } catch (err) {
        console.warn('Recalculate error after CSV import:', err);
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      message: `Successfully imported ${imported} questions.`,
    });
  } catch (error: any) {
    console.error('POST /api/quiz/[id]/import error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
