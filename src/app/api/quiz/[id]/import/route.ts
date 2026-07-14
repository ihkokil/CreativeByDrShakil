import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quiz, question } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireTeacherPayload } from '@/lib/route-auth';
import { nanoid } from '@/lib/nanoid';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized. Teacher or admin access required.' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const isPreview = searchParams.get('preview') === 'true';

    if (id !== 'new') {
      const existingQuiz = await db.query.quiz.findFirst({ where: eq(quiz.id, id) });
      if (!existingQuiz) {
        return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
      }
      
      if (payload.role === 'teacher' && existingQuiz.createdBy !== payload.sub) {
        return NextResponse.json({ error: 'Not authorized to import questions to this quiz.' }, { status: 403 });
      }
    } else {
      if (!isPreview) {
        return NextResponse.json({ error: 'Cannot import questions to a non-existent quiz without preview mode.' }, { status: 400 });
      }
    }
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }
    
    const text = await file.text();
    const lines = text.trim().split('\n');
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'File is empty or only contains headers.' }, { status: 400 });
    }
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const requiredHeaders = ['Question', 'Correct Option', 'Option A'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      return NextResponse.json({ 
        error: `Missing required columns: ${missingHeaders.join(', ')}` 
      }, { status: 400 });
    }
    
    const questionIndex = headers.indexOf('Question');
    const explanationIndex = headers.indexOf('Explanation');
    const correctOptionIndex = headers.indexOf('Correct Option');
    const optionAIndex = headers.indexOf('Option A');
    const optionBIndex = headers.indexOf('Option B');
    const optionCIndex = headers.indexOf('Option C');
    
    const validRows: any[] = [];
    const invalidRows: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = parseCSVLine(line);
      
      if (values.length < headers.length) {
        while (values.length < headers.length) values.push('');
      }
      
      const questionText = values[questionIndex]?.trim();
      const correctVal = values[correctOptionIndex]?.trim();
      const distractor1 = values[optionAIndex]?.trim();
      const distractor2 = optionBIndex >= 0 ? values[optionBIndex]?.trim() : '';
      const distractor3 = optionCIndex >= 0 ? values[optionCIndex]?.trim() : '';
      const explanation = explanationIndex >= 0 ? values[explanationIndex]?.trim() : '';
      
      const errors: string[] = [];
      
      if (!questionText) errors.push('Question text is required');
      if (!correctVal) errors.push('Correct option is required');
      if (!distractor1) errors.push('Option A (first false option) is required');
      
      if (errors.length > 0) {
        invalidRows.push({ row: i + 1, data: values, errors });
      } else {
        validRows.push({
          questionText,
          explanation,
          correctOption: 'A',
          optionA: correctVal,
          optionB: distractor1,
          optionC: distractor2 || null,
          optionD: distractor3 || null,
        });
      }
    }

    if (isPreview) {
      return NextResponse.json({
        success: true,
        validCount: validRows.length,
        invalidCount: invalidRows.length,
        validRows,
        invalidRows,
      });
    }
    
    if (validRows.length === 0) {
      return NextResponse.json({ 
        error: 'No valid questions found in the file.',
        invalidRows,
      }, { status: 400 });
    }
    
    const importedQuestions = [];
    for (const row of validRows) {
      const questionTypeTyped: 'mcq' | 'true_false' = row.optionC && row.optionC !== '' ? 'mcq' : 'true_false';
      
      const [newQuestion] = await db.insert(question).values({
        id: nanoid(),
        quizId: id,
        questionText: row.questionText,
        questionType: questionTypeTyped,
        optionA: row.optionA,
        optionB: row.optionB,
        optionC: row.optionC,
        optionD: row.optionD,
        correctOption: row.correctOption,
        explanation: row.explanation || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).returning();
      
      importedQuestions.push(newQuestion);
    }
    
    return NextResponse.json({
      success: true,
      importedCount: importedQuestions.length,
      skippedCount: invalidRows.length,
      questions: importedQuestions,
      invalidRows: invalidRows.length > 0 ? invalidRows : undefined,
    }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/quiz/[id]/import error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result.map(v => v.trim().replace(/^"|"$/g, ''));
}