import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { extractCookieToken } from '@/lib/auth-server';
import { requireTeacherPayload } from '@/lib/route-auth';
import { nanoid } from '@/lib/nanoid';

// Simple CSV parser for standard CSV format
function parseCSV(text: string) {
  const result = [];
  let row = [];
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
    const url = new URL(request.url);
    const isPreview = url.searchParams.get('preview') === 'true';

    // Check if formData
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
      
      const validRows = [];
      const invalidRows = [];
      
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
        
        let questionType = 'sba';
        if (correctOption && /^[TF]{5}$/.test(correctOption)) {
          questionType = 'mcq'; // True/False matrix (DB stores as mcq)
        } else if (correctOption && /^[A-E]$/.test(correctOption)) {
          questionType = 'sba'; // MCQ (DB stores as sba)
        }
        
        const errors = [];
        if (!questionText) errors.push('Question text missing');
        if (!correctOption) errors.push('Correct option missing');
        if (!optionA) errors.push('Option A missing');
        if (!optionB) errors.push('Option B missing');
        if (questionType === 'mcq' && correctOption.length !== 5) errors.push('True/False answer must be exactly 5 characters of T and F');
        if (questionType === 'sba' && !/^[A-E]$/.test(correctOption)) errors.push('MCQ answer must be a single letter from A to E');
        
        if (errors.length > 0) {
          invalidRows.push({
            data: row,
            errors
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
            optionE
          });
        }
      }
      
      return NextResponse.json({
        success: true,
        validCount: validRows.length,
        invalidCount: invalidRows.length,
        validRows,
        invalidRows
      });
    }

    const body = await request.json();
    const { questions } = body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'questions array is required.' }, { status: 400 });
    }

    const token = await extractCookieToken();
    const supabase = getSupabase(token);

    if (quizId !== 'new') {
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
    }

    const nowStr = new Date().toISOString();
    let imported = 0;

    for (const q of questions) {
      if (!q.questionText || !q.optionA || !q.optionB || !q.correctOption) {
        continue;
      }

      await supabase.from('Question')
        // @ts-ignore
        .insert({
          id: nanoid(),
          quizId: quizId === 'new' ? null : quizId,
          questionText: q.questionText.trim(),
          questionType: q.questionType || 'sba',
          optionA: q.optionA.trim(),
          optionB: q.optionB.trim(),
          optionC: q.optionC?.trim() || null,
          optionD: q.optionD?.trim() || null,
          optionE: q.optionE?.trim() || null,
          correctOption: q.correctOption.trim(),
          explanation: q.explanation?.trim() || null,
          createdAt: nowStr,
          updatedAt: nowStr,
        } as any);

      imported++;
    }

    if (quizId !== 'new') {
      await supabase
        .from('Quiz')
        // @ts-ignore
        .update({ updatedAt: nowStr })
        .eq('id', quizId);
    }

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
