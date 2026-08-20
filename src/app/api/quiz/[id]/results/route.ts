import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { getAuthPayload } from '@/lib/route-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await getAuthPayload(request);
    const supabase = getSupabaseAdmin();
    const supabaseAdmin = supabase;
    
    const { data: quizData } = await supabase
      .from('Quiz')
      .select('*')
      .eq('id', id)
      .limit(1)
      .maybeSingle();
    
    if (!quizData) {
      return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    }
    
    const isTeacher = payload && (payload.role === 'teacher' || payload.role === 'admin');
    const isStudent = payload && payload.role === 'student';
    
    if (!isTeacher && !isStudent) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    
    if (isTeacher && payload.role === 'teacher' && (quizData as any).createdBy !== payload.sub) {
      return NextResponse.json({ error: 'Not authorized to view results for this quiz.' }, { status: 403 });
    }
    
    if (isStudent) {
      const attemptIdParam = request.nextUrl.searchParams.get('attempt');
      let attemptQuery = supabase
        .from('QuizAttempt')
        .select('*')
        .eq('quizId', id)
        .eq('studentId', payload.sub);

      if (attemptIdParam) {
        attemptQuery = attemptQuery.eq('id', attemptIdParam);
      } else {
        attemptQuery = attemptQuery.in('status', ['submitted', 'auto_submitted']).order('submittedAt', { ascending: false });
      }

      const { data: attempt } = await attemptQuery.limit(1).maybeSingle();
      
      if (!attempt) {
        return NextResponse.json({ error: 'No completed attempt found.' }, { status: 404 });
      }
      
      const { data: attemptAnswers = [] } = await supabase
        .from('AttemptAnswer')
        .select('*')
        .eq('attemptId', (attempt as any).id);
        
      const { data: attemptMappings = [] } = await supabase
        .from('QuizQuestionMapping')
        .select('*')
        .eq('attemptId', (attempt as any).id);
      
      const mappingQuestionIds = (attemptMappings || []).map((m: any) => m.questionId);
      const { data: mappingQuestions = [] } = mappingQuestionIds.length > 0
        ? await supabase.from('Question').select('*').in('id', mappingQuestionIds)
        : { data: [] };
        
      const mappingQuestionMap = new Map((mappingQuestions || []).map((q: any) => [q.id, q]));
      
      let questionMappings = (attemptMappings || []).map((m: any) => ({
        ...m,
        question: mappingQuestionMap.get(m.questionId) || null,
      })).filter((m: any) => m.question !== null);

      // Fallback: If no QuizQuestionMapping was stored, load directly from Question table
      if (questionMappings.length === 0) {
        const { data: fallbackQuestions = [] } = await supabase
          .from('Question')
          .select('*')
          .eq('quizId', id)
          .order('createdAt', { ascending: true });
        
        questionMappings = (fallbackQuestions || []).map((q: any, idx: number) => ({
          id: `fallback-${q.id}`,
          attemptId: (attempt as any).id,
          questionId: q.id,
          displayOrder: idx,
          optionOrder: null,
          question: q,
        }));
      }
      
      const answerMap = new Map((attemptAnswers || []).map((a: any) => [a.questionId, a]));
      
      const questionsReview = questionMappings
        .sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0))
        .map((m: any) => {
          const q = m.question;
          if (!q) return null;
          const answer = answerMap.get(q.id);
          let originalOptions = [
            { letter: 'A', text: q.optionA },
            { letter: 'B', text: q.optionB },
            { letter: 'C', text: q.optionC },
            { letter: 'D', text: q.optionD },
            { letter: 'E', text: q.optionE },
          ];
          if (q.questionType !== 'mcq') {
            originalOptions = originalOptions.filter(o => o.text !== null && o.text !== undefined && String(o.text).trim() !== '');
          }
          
          let options = originalOptions;
          if (m.optionOrder && Array.isArray(m.optionOrder)) {
            options = m.optionOrder.map((key: any) => {
              if (typeof key === 'number') {
                const letters = ['A', 'B', 'C', 'D', 'E'];
                const letter = letters[key];
                return originalOptions.find(o => o.letter === letter);
              } else if (typeof key === 'string') {
                return originalOptions.find(o => o.letter === key);
              }
              return null;
            }).filter(Boolean) as any[];

            const orderedLetters = new Set(options.map(o => o.letter));
            originalOptions.forEach(o => {
              if (!orderedLetters.has(o.letter)) {
                options.push(o);
              }
            });
          }
          
          const studentAns = (answer as any)?.selectedOption || null;
          let isCorrect = false;
          let isPartial = false;
          
          if (studentAns && q.correctOption) {
            if (q.questionType === 'sba') {
              isCorrect = studentAns === q.correctOption;
            } else if (q.questionType === 'true_false') {
              // True_False with 5 options: each correct option = 2 marks, each wrong = -0.5
              const correctOptions = (q.correctOption || '').split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
              const studentOptions = (studentAns || '').split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
              
              let correctCount = 0;
              let wrongCount = 0;
              
              // Count correct and wrong options
              const allOptions = ['A', 'B', 'C', 'D', 'E'];
              allOptions.forEach((letter, idx) => {
                const correctHasOption = correctOptions.some((o: string) => o.toLowerCase().startsWith(letter.toLowerCase()));
                const studentHasOption = studentOptions.some((o: string) => o.toLowerCase().startsWith(letter.toLowerCase()));
                
                if (correctHasOption && studentHasOption) {
                  correctCount++;
                } else if (correctHasOption && !studentHasOption) {
                  // Student skipped this option, but it's correct - no penalty
                  // Actually for true_false, if option is correct and student didn't answer, it's not wrong
                } else if (!correctHasOption && studentHasOption) {
                  wrongCount++;
                }
                // Both wrong or both correct handled elsewhere
              });
              
              // Calculate: correct * 2 - wrong * 0.5
              const score = correctCount * 2 - wrongCount * 0.5;
              isCorrect = score > 0 || (score === 0 && correctCount > 0);
              isPartial = score > 0 && score < (correctCount * 2); // partially correct
            } else if (q.questionType === 'mcq') {
              if (studentAns === q.correctOption) {
                isCorrect = true;
              } else {
                let correctStems = 0;
                let length = options.length;
                for (let i = 0; i < length; i++) {
                  if (studentAns[i] === q.correctOption[i]) {
                    correctStems++;
                  }
                }
                if (correctStems === length) {
                  isCorrect = true;
                } else if (correctStems > 0) {
                  isPartial = true;
                }
              }
            }
          }

          return {
            questionId: q.id,
            questionText: q.questionText || '',
            questionType: q.questionType || 'sba',
            options,
            correctOption: q.correctOption || '',
            explanation: q.explanation || null,
            studentAnswer: studentAns,
            isCorrect: isCorrect,
            isPartial: isPartial,
            isSkipped: !studentAns,
          };
        }).filter(Boolean);
      
      const { data: allAttempts = [] } = await supabase
        .from('QuizAttempt')
        .select('*')
        .eq('quizId', id)
        .in('status', ['submitted', 'auto_submitted']);
      
      const allAttemptStudentIds = [...new Set((allAttempts || []).map((a: any) => a.studentId))];
      const { data: allAttemptStudents = [] } = allAttemptStudentIds.length > 0
        ? await supabaseAdmin.from('User').select('id, fullName').in('id', allAttemptStudentIds)
        : { data: [] };
        
      const allAttemptStudentMap = new Map((allAttemptStudents || []).map((s: any) => [s.id, s]));
      const allAttemptsWithStudent = (allAttempts || []).map((a: any) => ({
        ...a,
        student: allAttemptStudentMap.get(a.studentId) || null,
      }));
      
      const attemptsByStudent = new Map<string, any[]>();
      for (const att of allAttemptsWithStudent) {
        if (!attemptsByStudent.has(att.studentId)) {
          attemptsByStudent.set(att.studentId, []);
        }
        attemptsByStudent.get(att.studentId)!.push(att);
      }
      
      const filteredAttempts: any[] = [];
      const rankingType = (quizData as any).positionType || 'best_attempt';
      
      attemptsByStudent.forEach((studentAttempts) => {
        if (rankingType === 'average_attempt') {
          const totalScore = studentAttempts.reduce((sum, a) => sum + Number(a.netScore || 0), 0);
          const totalTime = studentAttempts.reduce((sum, a) => sum + (a.timeTakenSeconds || 0), 0);
          const avgScore = totalScore / studentAttempts.length;
          const avgTime = Math.round(totalTime / studentAttempts.length);
          
          const syntheticAttempt = {
            ...studentAttempts[studentAttempts.length - 1],
            netScore: avgScore,
            timeTakenSeconds: avgTime,
          };
          filteredAttempts.push(syntheticAttempt);
        } else {
          studentAttempts.sort((a, b) => {
            if (rankingType === 'first_attempt') {
              return new Date(a.createdAt || a.submittedAt || 0).getTime() - new Date(b.createdAt || b.submittedAt || 0).getTime();
            }
            if (rankingType === 'last_attempt') {
              return new Date(b.createdAt || b.submittedAt || 0).getTime() - new Date(a.createdAt || a.submittedAt || 0).getTime();
            }
            if (rankingType === 'best_attempt') {
              return (b.netScore || 0) - (a.netScore || 0);
            }
            // default: best attempt (highest score)
            return (b.netScore || 0) - (a.netScore || 0);
          });
          filteredAttempts.push(studentAttempts[0]);
        }
      });
      
      filteredAttempts.sort((a, b) => {
        if (b.netScore !== a.netScore) {
          return b.netScore - a.netScore;
        }
        return (a.timeTakenSeconds || 0) - (b.timeTakenSeconds || 0);
      });
      
      const studentAttemptIndex = filteredAttempts.findIndex(a => a.studentId === payload.sub);
      const rank = studentAttemptIndex >= 0 ? studentAttemptIndex + 1 : null;
      
      const leaderboard = filteredAttempts.slice(0, 20).map((a, idx) => ({
        rank: idx + 1,
        studentName: a.student?.fullName || 'Unknown',
        netScore: a.netScore,
        timeTakenSeconds: a.timeTakenSeconds,
        attemptNumber: a.attemptNumber,
        isCurrentUser: a.studentId === payload.sub,
      }));
      
      return NextResponse.json({
        attempt: {
          id: (attempt as any).id,
          netScore: (attempt as any).netScore,
          percentageScore: (attempt as any).percentageScore,
          correctCount: (attempt as any).correctCount,
          wrongCount: (attempt as any).wrongCount,
          skippedCount: (attempt as any).skippedCount,
          negativeMarks: (attempt as any).negativeMarks,
          timeTakenSeconds: (attempt as any).timeTakenSeconds,
          submittedAt: (attempt as any).submittedAt,
          attemptNumber: (attempt as any).attemptNumber,
          rank,
        },
        quiz: {
          id: (quizData as any).id,
          title: (quizData as any).title,
          marksPerCorrect: (quizData as any).marksPerCorrect,
          allowNegativeMarking: (quizData as any).allowNegativeMarking,
          negativeValue: (quizData as any).negativeValue,
          allowMultipleAttempts: (quizData as any).allowMultipleAttempts,
          maxAttempts: (quizData as any).maxAttempts,
          durationMinutes: (quizData as any).durationMinutes,
        },
        questionsReview,
        leaderboard,
      });
    }
    
    const { data: attempts = [] } = await supabase
      .from('QuizAttempt')
      .select('*')
      .eq('quizId', id)
      .in('status', ['submitted', 'auto_submitted']);
    
    const attemptIds = (attempts || []).map((a: any) => a.id);
    const attemptStudentIds = [...new Set((attempts || []).map((a: any) => a.studentId))];
    
    const [{ data: attemptStudents = [] }, { data: attemptAnswers = [] }, { data: attemptMappings = [] }] = await Promise.all([
      attemptStudentIds.length > 0
        ? supabaseAdmin.from('User').select('id, fullName').in('id', attemptStudentIds)
        : Promise.resolve({ data: [] }),
      attemptIds.length > 0
        ? supabase.from('AttemptAnswer').select('*').in('attemptId', attemptIds)
        : Promise.resolve({ data: [] }),
      attemptIds.length > 0
        ? supabase.from('QuizQuestionMapping').select('*').in('attemptId', attemptIds)
        : Promise.resolve({ data: [] }),
    ]);
    
    const attemptStudentMap = new Map((attemptStudents || []).map((s: any) => [
      s.id,
      {
        ...s,
      }
    ]));
    
    const mappingQuestionIds = [...new Set((attemptMappings || []).map((m: any) => m.questionId))];
    const { data: mappingQuestions = [] } = mappingQuestionIds.length > 0
      ? await supabase.from('Question').select('*').in('id', mappingQuestionIds)
      : { data: [] };
    const mappingQuestionMap = new Map((mappingQuestions || []).map((q: any) => [q.id, q]));
    
    const attemptsAnswerMap = new Map<string, any[]>();
    for (const a of (attemptAnswers || [])) {
      const list = attemptsAnswerMap.get((a as any).attemptId) || [];
      list.push(a);
      attemptsAnswerMap.set((a as any).attemptId, list);
    }
    
    const attemptsMappingMap = new Map<string, any[]>();
    for (const m of (attemptMappings || [])) {
      const list = attemptsMappingMap.get((m as any).attemptId) || [];
      list.push({ ...(m as any), question: mappingQuestionMap.get((m as any).questionId)! });
      attemptsMappingMap.set((m as any).attemptId, list);
    }
    
    const attemptsWithRelations = (attempts || []).map((a: any) => ({
      ...a,
      student: attemptStudentMap.get(a.studentId) || null,
      answers: attemptsAnswerMap.get(a.id) || [],
      questionMappings: attemptsMappingMap.get(a.id) || [],
    }));
    
    const teacherAttemptsByStudent = new Map<string, any[]>();
    for (const att of attemptsWithRelations) {
      if (!teacherAttemptsByStudent.has(att.studentId)) {
        teacherAttemptsByStudent.set(att.studentId, []);
      }
      teacherAttemptsByStudent.get(att.studentId)!.push(att);
    }
    
    const teacherFilteredAttempts: any[] = [];
    const teacherRankingType = (quizData as any).positionType || 'best_attempt';
    
    teacherAttemptsByStudent.forEach((studentAttempts) => {
      if (teacherRankingType === 'average_attempt') {
        const totalScore = studentAttempts.reduce((sum, a) => sum + Number(a.netScore || 0), 0);
        const totalTime = studentAttempts.reduce((sum, a) => sum + (a.timeTakenSeconds || 0), 0);
        const avgScore = totalScore / studentAttempts.length;
        const avgTime = Math.round(totalTime / studentAttempts.length);
        
        const syntheticAttempt = {
          ...studentAttempts[studentAttempts.length - 1],
          netScore: avgScore,
          timeTakenSeconds: avgTime,
        };
        teacherFilteredAttempts.push(syntheticAttempt);
      } else {
        studentAttempts.sort((a, b) => {
          if (teacherRankingType === 'first_attempt') {
            return new Date(a.createdAt || a.submittedAt || 0).getTime() - new Date(b.createdAt || b.submittedAt || 0).getTime();
          }
          if (teacherRankingType === 'last_attempt') {
            return new Date(b.createdAt || b.submittedAt || 0).getTime() - new Date(a.createdAt || a.submittedAt || 0).getTime();
          }
          if (b.netScore !== a.netScore) {
            return (b.netScore || 0) - (a.netScore || 0);
          }
          return (a.timeTakenSeconds || 0) - (b.timeTakenSeconds || 0);
        });
        teacherFilteredAttempts.push(studentAttempts[0]);
      }
    });
    
    teacherFilteredAttempts.sort((a, b) => {
      if (b.netScore !== a.netScore) {
        return b.netScore - a.netScore;
      }
      return (a.timeTakenSeconds || 0) - (b.timeTakenSeconds || 0);
    });
    
    const leaderboard = teacherFilteredAttempts.map((a, idx) => ({
      rank: idx + 1,
      attemptId: a.id,
      studentId: a.studentId,
      studentName: a.student?.fullName || 'Unknown',
      batchId: a.student?.batchId || null,
      batchName: a.student?.batchName || 'No Batch',
      netScore: a.netScore,
      percentageScore: a.percentageScore,
      correctCount: a.correctCount,
      wrongCount: a.wrongCount,
      skippedCount: a.skippedCount,
      timeTakenSeconds: a.timeTakenSeconds,
      submittedAt: a.submittedAt,
      attemptNumber: a.attemptNumber,
      isAutoSubmitted: a.status === 'auto_submitted',
    }));
    
    const totalAttempts = attemptsWithRelations.length;
    const avgScore = totalAttempts > 0 
      ? attemptsWithRelations.reduce((sum, a) => sum + a.netScore, 0) / totalAttempts 
      : 0;
    const highestScore = totalAttempts > 0 ? Math.max(...attemptsWithRelations.map(a => a.netScore)) : 0;
    const lowestScore = totalAttempts > 0 ? Math.min(...attemptsWithRelations.map(a => a.netScore)) : 0;
    const avgTime = totalAttempts > 0 
      ? attemptsWithRelations.reduce((sum, a) => sum + (a.timeTakenSeconds || 0), 0) / totalAttempts 
      : 0;
    
    const { data: questionStats = [] } = attemptsWithRelations.length > 0
      ? await supabase.from('Question').select('*').eq('quizId', id)
      : { data: [] };
    const questionStatIds = (questionStats || []).map((q: any) => q.id);
    const questionStatAttemptIds = attemptsWithRelations.map(a => a.id);
    
    // Build query for answers using a simpler approach since there's no native composite 'in'
    let questionStatAnswers: any[] = [];
    if (questionStatIds.length > 0 && questionStatAttemptIds.length > 0) {
      const { data } = await supabase
        .from('AttemptAnswer')
        .select('*')
        .in('questionId', questionStatIds)
        .in('attemptId', questionStatAttemptIds);
      questionStatAnswers = data || [];
    }
    
    const questionStatAnswerMap = new Map<string, any[]>();
    for (const a of questionStatAnswers) {
      const list = questionStatAnswerMap.get(a.questionId) || [];
      list.push(a);
      questionStatAnswerMap.set(a.questionId, list);
    }
    const questionStatsWithAnswers = (questionStats || []).map((q: any) => ({
      ...q,
      attemptAnswers: questionStatAnswerMap.get(q.id) || [],
    }));
    
    const perQuestionAnalytics = questionStatsWithAnswers.map(q => {
      const answers = q.attemptAnswers;
      const total = answers.length;
      
      let correct = 0;
      for (const a of answers) {
        const studentAns = a.selectedOption;
        if (studentAns && q.correctOption) {
          if (q.questionType === 'sba') {
            if (studentAns === q.correctOption) correct++;
          } else if (q.questionType === 'mcq') {
            if (studentAns === q.correctOption) {
              correct++;
            } else {
              let correctStems = 0;
              let length = [q.optionA, q.optionB, q.optionC, q.optionD, q.optionE]
                .filter(o => o !== null && o !== undefined && String(o).trim() !== '').length || 5;
              for (let i = 0; i < length; i++) {
                if (studentAns[i] === q.correctOption[i]) {
                  correctStems++;
                }
              }
              if (correctStems === length) {
                correct++;
              }
            }
          }
        } else if (a.isCorrect === true || a.isCorrect === 'true') {
          correct++;
        }
      }
      
      let optionDistribution: any = {};
      let mostCommonWrongOption: string | null = null;
      
      if (q.questionType === 'mcq') {
        optionDistribution = {
          A: { T: 0, F: 0, S: 0 },
          B: { T: 0, F: 0, S: 0 },
          C: { T: 0, F: 0, S: 0 },
          D: { T: 0, F: 0, S: 0 },
          E: { T: 0, F: 0, S: 0 }
        };
        const stems = ['A', 'B', 'C', 'D', 'E'];
        for (const a of answers) {
          const answerString = (a.selectedOption || '').padEnd(5, '-');
          for (let i = 0; i < 5; i++) {
            const char = answerString[i];
            const stem = stems[i];
            if (char === 'T') optionDistribution[stem].T++;
            else if (char === 'F') optionDistribution[stem].F++;
            else optionDistribution[stem].S++;
          }
        }
      } else if (q.questionType === 'true_false') {
        // True_False: count correct vs wrong options per question
        const correctOptions = (q.correctOption || '').split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
        optionDistribution = { A: 0, B: 0, C: 0, D: 0, E: 0 };
        let correctCount = 0;
        let wrongCount = 0;
        
        const allOptions = ['A', 'B', 'C', 'D', 'E'];
        for (const a of answers) {
          const studentOptions = (a.selectedOption || '').split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
          allOptions.forEach((letter, idx) => {
            const correctHasOption = correctOptions.some((o: string) => o.toLowerCase().startsWith(letter.toLowerCase()));
            const studentHasOption = studentOptions.some((o: string) => o.toLowerCase().startsWith(letter.toLowerCase()));
            
            if (correctHasOption && studentHasOption) {
              optionDistribution[letter]++;
              correctCount++;
            } else if (!correctHasOption && studentHasOption) {
              optionDistribution[letter]++;
              wrongCount++;
            } else if (correctHasOption && !studentHasOption) {
              // Option is correct but student skipped - don't count in distribution
            }
          });
        }
        
        mostCommonWrongOption = wrongCount > 0 ? 
          Object.entries(optionDistribution).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || null 
          : null;
      } else {
        optionDistribution = { A: 0, B: 0, C: 0, D: 0, E: 0 };
        for (const a of answers) {
          if (a.selectedOption) {
            optionDistribution[a.selectedOption] = (optionDistribution[a.selectedOption] || 0) + 1;
          }
        }
        mostCommonWrongOption = Object.entries(optionDistribution)
          .filter(([opt]) => opt !== q.correctOption)
          .sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || null;
      }
      
      return {
        questionId: q.id,
        questionType: q.questionType,
        questionText: q.questionText,
        totalAttempts: total,
        correctCount: correct,
        correctPercentage: total > 0 ? (correct / total) * 100 : 0,
        optionDistribution,
        mostCommonWrongOption,
        options: [
          { letter: 'A', text: q.optionA },
          { letter: 'B', text: q.optionB },
          { letter: 'C', text: q.optionC },
          { letter: 'D', text: q.optionD },
          { letter: 'E', text: q.optionE },
        ].filter(o => o.text !== null && o.text !== undefined && o.text !== ''),
        correctOption: q.correctOption,
      };
    });
    
    const requestedAttemptId = request.nextUrl.searchParams.get('attempt');
    let requestedAttemptDetails: any = null;
    
    if (requestedAttemptId) {
      const targetAttempt = attemptsWithRelations.find((a: any) => a.id === requestedAttemptId);
      if (targetAttempt) {
        const answerMap = new Map(targetAttempt.answers.map((a: any) => [a.questionId, a]));
        const questionsReview = targetAttempt.questionMappings
          .sort((a: any, b: any) => a.displayOrder - b.displayOrder)
          .map((m: any) => {
            const q = m.question!;
            const answer = answerMap.get(q.id);
            let options = [
              { letter: 'A', text: q.optionA },
              { letter: 'B', text: q.optionB },
              { letter: 'C', text: q.optionC },
              { letter: 'D', text: q.optionD },
              { letter: 'E', text: q.optionE },
            ].filter(o => o.text !== null && o.text !== undefined && o.text !== '');
            
            if (m.optionOrder && Array.isArray(m.optionOrder)) {
              options = m.optionOrder.map((idx: number) => options[idx]).filter(Boolean);
            }
            
            const studentAns = (answer as any)?.selectedOption || null;
            let isCorrect = false;
            let isPartial = false;
            
            if (studentAns && q.correctOption) {
              if (q.questionType === 'sba') {
                isCorrect = studentAns === q.correctOption;
              } else if (q.questionType === 'true_false') {
                // True_False with 5 options: each correct option = 2 marks, each wrong = -0.5
                const correctOptions = (q.correctOption || '').split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
                const studentOptions = (studentAns || '').split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
                
                let correctCount = 0;
                let wrongCount = 0;
                
                const allOptions = ['A', 'B', 'C', 'D', 'E'];
                allOptions.forEach((letter, idx) => {
                  const correctHasOption = correctOptions.some((o: string) => o.toLowerCase().startsWith(letter.toLowerCase()));
                  const studentHasOption = studentOptions.some((o: string) => o.toLowerCase().startsWith(letter.toLowerCase()));
                  
                  if (correctHasOption && studentHasOption) {
                    correctCount++;
                  } else if (!correctHasOption && studentHasOption) {
                    wrongCount++;
                  }
                });
                
                const score = correctCount * 2 - wrongCount * 0.5;
                isCorrect = score > 0 || (score === 0 && correctCount > 0);
                isPartial = score > 0 && score < (correctCount * 2);
              } else if (q.questionType === 'mcq') {
                if (studentAns === q.correctOption) {
                  isCorrect = true;
                } else {
                  let correctStems = 0;
                  let length = options.length;
                  for (let i = 0; i < length; i++) {
                    if (studentAns[i] === q.correctOption[i]) {
                      correctStems++;
                    }
                  }
                  if (correctStems === length) {
                    isCorrect = true;
                  } else if (correctStems > 0) {
                    isPartial = true;
                  }
                }
              }
            }

            return {
              questionId: q.id,
              questionText: q.questionText,
              questionType: q.questionType,
              options,
              correctOption: q.correctOption,
              explanation: q.explanation,
              studentAnswer: studentAns,
              isCorrect: isCorrect,
              isPartial: isPartial,
              isSkipped: !studentAns,
            };
          });
          
        requestedAttemptDetails = {
          id: targetAttempt.id,
          netScore: targetAttempt.netScore,
          percentageScore: targetAttempt.percentageScore,
          correctCount: targetAttempt.correctCount,
          wrongCount: targetAttempt.wrongCount,
          skippedCount: targetAttempt.skippedCount,
          negativeMarks: targetAttempt.negativeMarks,
          timeTakenSeconds: targetAttempt.timeTakenSeconds,
          submittedAt: targetAttempt.submittedAt,
          attemptNumber: targetAttempt.attemptNumber,
          isAutoSubmitted: targetAttempt.status === 'auto_submitted',
          questionsReview,
        };
      }
    }
    
    const allSubmissions = attemptsWithRelations.map((a: any) => ({
      attemptId: a.id,
      studentId: a.studentId,
      studentName: a.student?.fullName || 'Unknown',
      batchId: a.student?.batchId || null,
      batchName: a.student?.batchName || 'No Batch',
      netScore: a.netScore,
      percentageScore: a.percentageScore,
      correctCount: a.correctCount,
      wrongCount: a.wrongCount,
      skippedCount: a.skippedCount,
      timeTakenSeconds: a.timeTakenSeconds,
      submittedAt: a.submittedAt,
      attemptNumber: a.attemptNumber,
      isAutoSubmitted: a.status === 'auto_submitted',
    }));

    return NextResponse.json({
      quiz: {
        id: (quizData as any).id,
        title: (quizData as any).title,
        totalQuestions: (quizData as any).numQuestionsToServe,
        durationMinutes: (quizData as any).durationMinutes,
      },
      summary: {
        totalAttempts,
        averageScore: avgScore,
        highestScore,
        lowestScore,
        averageTimeSeconds: avgTime,
      },
      leaderboard,
      allSubmissions,
      perQuestionAnalytics,
      attempt: requestedAttemptDetails,
    });
  } catch (error: any) {
    console.error('GET /api/quiz/[id]/results error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}