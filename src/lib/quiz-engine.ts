import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/db';

export const DEFAULT_SBA_MARKS = 2;
export const DEFAULT_SBA_NEGATIVE = 0;
export const DEFAULT_TF_MARKS = 2; // per correct option
export const DEFAULT_TF_NEGATIVE = 0.5; // per wrong option (subtracted as penalty)

export type QuestionType = 'sba' | 'true_false' | 'mcq';

export interface QuizSettings {
  id?: string;
  sbaMarks?: number | null;
  sbaNegative?: number | null;
  tfMarks?: number | null;
  tfNegative?: number | null;
  marksPerCorrect?: number | null;
  negativeValue?: number | null;
  allowNegativeMarking?: boolean | null;
  numQuestionsToServe?: number | null;
  positionType?: 'best_attempt' | 'last_attempt' | 'first_attempt' | 'average_attempt' | string | null;
  durationMinutes?: number | null;
}

export interface QuestionData {
  id: string;
  quizId?: string;
  questionText: string;
  questionType: string;
  optionA: string;
  optionB: string;
  optionC?: string | null;
  optionD?: string | null;
  optionE?: string | null;
  correctOption: string;
  explanation?: string | null;
}

export interface OptionReviewDetail {
  letter: string;
  text: string;
  studentChoice: 'T' | 'F' | '-' | null;
  correctChoice: 'T' | 'F' | null;
  status: 'correct' | 'wrong' | 'skipped';
  scoreImpact: number;
}

export interface QuestionGradeResult {
  questionId: string;
  questionType: 'sba' | 'true_false';
  status: 'correct' | 'wrong' | 'partial' | 'skipped';
  isCorrect: boolean;
  isPartial: boolean;
  isSkipped: boolean;
  studentAnswer: string | null;
  correctOption: string;
  scoreGained: number;
  penalty: number;
  netScore: number;
  maxScore: number;
  explanation?: string | null;
  optionsReview?: OptionReviewDetail[];
}

export interface AttemptGradeSummary {
  attemptId: string;
  status: 'submitted' | 'auto_submitted';
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  partialCount: number;
  skippedCount: number;
  grossScore: number;
  negativeMarks: number;
  netScore: number;
  maxScore: number;
  percentageScore: number;
  timeTakenSeconds: number;
  questionResults: Record<string, QuestionGradeResult>;
}

/**
 * Normalizes question type into 'sba' or 'true_false'.
 * 'mcq' in legacy DB is mapped to 'true_false' because it represents 5 T/F options.
 */
export function normalizeQuestionType(type: string | undefined | null): 'sba' | 'true_false' {
  if (!type) return 'sba';
  const lower = type.toLowerCase();
  if (lower === 'true_false' || lower === 'mcq' || lower === 't_f' || lower === 'truefalse') {
    return 'true_false';
  }
  return 'sba';
}

/**
 * Extracts scoring rules for SBA and TRUE_FALSE from quiz object with fallback to defaults.
 */
export function getScoringRules(quiz: QuizSettings | null | undefined) {
  const sbaMarks = quiz?.sbaMarks !== undefined && quiz?.sbaMarks !== null
    ? Number(quiz.sbaMarks)
    : (quiz?.marksPerCorrect !== undefined && quiz?.marksPerCorrect !== null ? Number(quiz.marksPerCorrect) : DEFAULT_SBA_MARKS);

  let sbaNegative = quiz?.sbaNegative !== undefined && quiz?.sbaNegative !== null
    ? Number(quiz.sbaNegative)
    : 0;
  
  if (sbaNegative === 0 && quiz?.allowNegativeMarking && quiz?.negativeValue) {
    sbaNegative = Number(quiz.negativeValue);
  }

  const tfMarks = quiz?.tfMarks !== undefined && quiz?.tfMarks !== null
    ? Number(quiz.tfMarks)
    : DEFAULT_TF_MARKS;

  let tfNegative = quiz?.tfNegative !== undefined && quiz?.tfNegative !== null
    ? Number(quiz.tfNegative)
    : DEFAULT_TF_NEGATIVE;

  if (quiz?.allowNegativeMarking === false && quiz?.tfNegative === undefined) {
    tfNegative = 0;
  }

  return {
    sbaMarks: isNaN(sbaMarks) ? DEFAULT_SBA_MARKS : sbaMarks,
    sbaNegative: isNaN(sbaNegative) ? 0 : Math.abs(sbaNegative),
    tfMarks: isNaN(tfMarks) ? DEFAULT_TF_MARKS : tfMarks,
    tfNegative: isNaN(tfNegative) ? DEFAULT_TF_NEGATIVE : Math.abs(tfNegative),
  };
}

/**
 * Computes maximum possible marks for a set of questions.
 */
export function computeMaxMarksForQuestions(questions: QuestionData[], quiz: QuizSettings | null | undefined): number {
  const { sbaMarks, tfMarks } = getScoringRules(quiz);
  let total = 0;
  for (const q of questions) {
    const qType = normalizeQuestionType(q.questionType);
    if (qType === 'true_false') {
      total += 5 * tfMarks;
    } else {
      total += sbaMarks;
    }
  }
  return Number(total.toFixed(2));
}

/**
 * Grades a single question based on student answer.
 */
export function gradeSingleQuestion(
  question: QuestionData,
  studentAnswer: string | null | undefined,
  scoring: { sbaMarks: number; sbaNegative: number; tfMarks: number; tfNegative: number }
): QuestionGradeResult {
  const qType = normalizeQuestionType(question.questionType);
  const qId = question.id;
  const correctOption = (question.correctOption || '').trim().toUpperCase();
  const rawAns = (studentAnswer || '').trim().toUpperCase();

  if (qType === 'true_false') {
    // 5 options: A, B, C, D, E.
    // correctOption must be 5 chars like 'TFTFT'.
    const normalizedCorrect = correctOption.padEnd(5, 'F').slice(0, 5);
    const normalizedStudent = rawAns.padEnd(5, '-').slice(0, 5);

    const optionLetters = ['A', 'B', 'C', 'D', 'E'];
    const optionTexts = [
      question.optionA,
      question.optionB,
      question.optionC || '',
      question.optionD || '',
      question.optionE || '',
    ];

    let correctStems = 0;
    let wrongStems = 0;
    let skippedStems = 0;
    const optionsReview: OptionReviewDetail[] = [];

    for (let i = 0; i < 5; i++) {
      const letter = optionLetters[i];
      const text = optionTexts[i];
      const sChar = normalizedStudent[i];
      const cChar = normalizedCorrect[i] as 'T' | 'F';

      let status: 'correct' | 'wrong' | 'skipped' = 'skipped';
      let scoreImpact = 0;

      if (sChar === 'T' || sChar === 'F') {
        if (sChar === cChar) {
          status = 'correct';
          scoreImpact = scoring.tfMarks;
          correctStems++;
        } else {
          status = 'wrong';
          scoreImpact = -scoring.tfNegative;
          wrongStems++;
        }
      } else {
        status = 'skipped';
        scoreImpact = 0;
        skippedStems++;
      }

      optionsReview.push({
        letter,
        text,
        studentChoice: (sChar === 'T' || sChar === 'F') ? sChar : null,
        correctChoice: cChar,
        status,
        scoreImpact,
      });
    }

    const scoreGained = Number((correctStems * scoring.tfMarks).toFixed(2));
    const penalty = Number((wrongStems * scoring.tfNegative).toFixed(2));
    const netScore = Number((scoreGained - penalty).toFixed(2));
    const maxScore = Number((5 * scoring.tfMarks).toFixed(2));

    let qStatus: 'correct' | 'wrong' | 'partial' | 'skipped' = 'skipped';
    if (skippedStems === 5) {
      qStatus = 'skipped';
    } else if (correctStems === 5) {
      qStatus = 'correct';
    } else if (correctStems > 0) {
      qStatus = 'partial';
    } else {
      qStatus = 'wrong';
    }

    return {
      questionId: qId,
      questionType: 'true_false',
      status: qStatus,
      isCorrect: correctStems === 5,
      isPartial: qStatus === 'partial',
      isSkipped: skippedStems === 5,
      studentAnswer: rawAns || null,
      correctOption: normalizedCorrect,
      scoreGained,
      penalty,
      netScore,
      maxScore,
      explanation: question.explanation || null,
      optionsReview,
    };
  } else {
    // SBA (Single Best Answer, A-E)
    const validLetters = ['A', 'B', 'C', 'D', 'E'];
    const maxScore = scoring.sbaMarks;

    if (!rawAns || !validLetters.includes(rawAns)) {
      return {
        questionId: qId,
        questionType: 'sba',
        status: 'skipped',
        isCorrect: false,
        isPartial: false,
        isSkipped: true,
        studentAnswer: null,
        correctOption,
        scoreGained: 0,
        penalty: 0,
        netScore: 0,
        maxScore,
        explanation: question.explanation || null,
      };
    }

    if (rawAns === correctOption) {
      return {
        questionId: qId,
        questionType: 'sba',
        status: 'correct',
        isCorrect: true,
        isPartial: false,
        isSkipped: false,
        studentAnswer: rawAns,
        correctOption,
        scoreGained: scoring.sbaMarks,
        penalty: 0,
        netScore: scoring.sbaMarks,
        maxScore,
        explanation: question.explanation || null,
      };
    } else {
      return {
        questionId: qId,
        questionType: 'sba',
        status: 'wrong',
        isCorrect: false,
        isPartial: false,
        isSkipped: false,
        studentAnswer: rawAns,
        correctOption,
        scoreGained: 0,
        penalty: scoring.sbaNegative,
        netScore: -scoring.sbaNegative,
        maxScore,
        explanation: question.explanation || null,
      };
    }
  }
}

/**
 * Grades an entire attempt against its mapped questions and answers.
 */
export function gradeAttemptData(
  attemptId: string,
  quiz: QuizSettings,
  mappedQuestions: QuestionData[],
  answers: Array<{ questionId: string; selectedOption: string | null }>,
  submissionStatus: 'submitted' | 'auto_submitted' = 'submitted',
  timeTakenSeconds: number = 0
): AttemptGradeSummary {
  const scoring = getScoringRules(quiz);
  const answerMap = new Map(answers.map(a => [a.questionId, a.selectedOption]));

  let correctCount = 0;
  let wrongCount = 0;
  let partialCount = 0;
  let skippedCount = 0;

  let grossScore = 0;
  let negativeMarks = 0;
  let maxScore = 0;

  const questionResults: Record<string, QuestionGradeResult> = {};

  for (const q of mappedQuestions) {
    const studentAns = answerMap.get(q.id);
    const result = gradeSingleQuestion(q, studentAns, scoring);
    questionResults[q.id] = result;

    grossScore += result.scoreGained;
    negativeMarks += result.penalty;
    maxScore += result.maxScore;

    if (result.status === 'correct') {
      correctCount++;
    } else if (result.status === 'partial') {
      partialCount++;
    } else if (result.status === 'wrong') {
      wrongCount++;
    } else {
      skippedCount++;
    }
  }

  grossScore = Number(grossScore.toFixed(2));
  negativeMarks = Number(negativeMarks.toFixed(2));
  const netScore = Number((grossScore - negativeMarks).toFixed(2));
  maxScore = Number(maxScore.toFixed(2));

  const percentageScore = maxScore > 0 ? Math.max(0, Math.round((netScore / maxScore) * 100)) : 0;

  return {
    attemptId,
    status: submissionStatus,
    totalQuestions: mappedQuestions.length,
    correctCount,
    wrongCount,
    partialCount,
    skippedCount,
    grossScore,
    negativeMarks,
    netScore,
    maxScore,
    percentageScore,
    timeTakenSeconds,
    questionResults,
  };
}

/**
 * Grades an attempt and saves the results to the Supabase database.
 */
export async function gradeAndPersistAttempt(
  attemptId: string,
  quizId: string,
  submissionStatus: 'submitted' | 'auto_submitted',
  supabase: SupabaseClient<any>,
  overrideTimeTakenSeconds?: number
): Promise<AttemptGradeSummary> {
  // 1. Fetch Quiz
  const { data: quiz, error: quizError } = await supabase
    .from('Quiz')
    .select('*')
    .eq('id', quizId)
    .limit(1)
    .maybeSingle();

  if (quizError || !quiz) throw new Error(quizError?.message || 'Quiz not found');

  // 2. Fetch Attempt
  const { data: attempt, error: attemptError } = await supabase
    .from('QuizAttempt')
    .select('*')
    .eq('id', attemptId)
    .limit(1)
    .maybeSingle();

  if (attemptError || !attempt) throw new Error(attemptError?.message || 'Attempt not found');

  // 3. Fetch mapped questions for this attempt
  const { data: mappings = [] } = await supabase
    .from('QuizQuestionMapping')
    .select('*')
    .eq('attemptId', attemptId)
    .order('displayOrder', { ascending: true });

  let questionIds = (mappings || []).map((m: any) => m.questionId);
  let mappedQuestions: QuestionData[] = [];

  if (questionIds.length > 0) {
    const { data: questions = [] } = await supabase
      .from('Question')
      .select('*')
      .in('id', questionIds);

    const qMap = new Map((questions || []).map((q: any) => [q.id, q]));
    mappedQuestions = questionIds.map(id => qMap.get(id)).filter(Boolean) as QuestionData[];
  }

  // Fallback: If no QuizQuestionMapping exists (legacy attempt), fetch quiz questions directly
  if (mappedQuestions.length === 0) {
    const { data: fallbackQuestions = [] } = await supabase
      .from('Question')
      .select('*')
      .eq('quizId', quizId)
      .order('createdAt', { ascending: true });
    mappedQuestions = fallbackQuestions as QuestionData[];
  }

  // 4. Fetch answers
  const { data: answers = [] } = await supabase
    .from('AttemptAnswer')
    .select('questionId, selectedOption')
    .eq('attemptId', attemptId);

  // 5. Calculate time taken
  let timeTaken = 0;
  if (overrideTimeTakenSeconds !== undefined && overrideTimeTakenSeconds !== null) {
    timeTaken = overrideTimeTakenSeconds;
  } else if (attempt.startedAt) {
    const startMs = new Date(attempt.startedAt).getTime();
    timeTaken = Math.max(0, Math.round((Date.now() - startMs) / 1000));
    if (quiz.durationMinutes && quiz.durationMinutes > 0) {
      timeTaken = Math.min(timeTaken, quiz.durationMinutes * 60);
    }
  }

  // 6. Grade attempt
  const gradeSummary = gradeAttemptData(
    attemptId,
    quiz,
    mappedQuestions,
    answers || [],
    submissionStatus,
    timeTaken
  );

  const nowStr = new Date().toISOString();

    // 7. Update QuizAttempt in DB
    const { error: updateAttemptError } = await supabase
      .from('QuizAttempt')
      .update({
        status: submissionStatus,
        submittedAt: nowStr,
        correctCount: gradeSummary.correctCount,
        wrongCount: gradeSummary.wrongCount,
        skippedCount: gradeSummary.skippedCount,
        netScore: gradeSummary.netScore,
        negativeMarks: gradeSummary.negativeMarks,
        percentageScore: gradeSummary.percentageScore,
        timeTakenSeconds: timeTaken,
        updatedAt: nowStr,
      } as any)
      .eq('id', attemptId);

  if (updateAttemptError) throw updateAttemptError;

  // 8. Update AttemptAnswer isCorrect values in DB
  for (const q of mappedQuestions) {
    const res = gradeSummary.questionResults[q.id];
    if (res) {
      await supabase
        .from('AttemptAnswer')
        .update({ isCorrect: res.isCorrect })
        .eq('attemptId', attemptId)
        .eq('questionId', q.id);
    }
  }

  return gradeSummary;
}

/**
 * Re-grades ALL completed attempts for a quiz.
 * Triggered when a teacher updates question answers, options, or quiz scoring.
 */
export async function recalculateQuizResults(
  quizId: string,
  supabaseClient?: SupabaseClient<any>
): Promise<{ totalAttemptsUpdated: number }> {
  const supabase = supabaseClient || getSupabaseAdmin();

  // 1. Fetch Quiz
  const { data: quiz, error: quizError } = await supabase
    .from('Quiz')
    .select('*')
    .eq('id', quizId)
    .limit(1)
    .maybeSingle();

  if (quizError || !quiz) throw new Error(quizError?.message || 'Quiz not found');

  // 2. Fetch all questions for this quiz
  const { data: allQuestions = [] } = await supabase
    .from('Question')
    .select('*')
    .eq('quizId', quizId);

  const questionMap = new Map((allQuestions || []).map((q: any) => [q.id, q as QuestionData]));

  // 3. Fetch all completed attempts
  const { data: attempts = [], error: attemptsError } = await supabase
    .from('QuizAttempt')
    .select('*')
    .eq('quizId', quizId)
    .in('status', ['submitted', 'auto_submitted']);

  if (attemptsError) throw attemptsError;
  if (!attempts || attempts.length === 0) return { totalAttemptsUpdated: 0 };

  const attemptIds = attempts.map((a: any) => a.id);

  // 4. Batch fetch mappings & answers
  const [{ data: allMappings = [] }, { data: allAnswers = [] }] = await Promise.all([
    supabase.from('QuizQuestionMapping').select('*').in('attemptId', attemptIds).order('displayOrder', { ascending: true }),
    supabase.from('AttemptAnswer').select('*').in('attemptId', attemptIds),
  ]);

  const mappingsByAttempt = new Map<string, any[]>();
  for (const m of allMappings || []) {
    const list = mappingsByAttempt.get((m as any).attemptId) || [];
    list.push(m);
    mappingsByAttempt.set((m as any).attemptId, list);
  }

  const answersByAttempt = new Map<string, any[]>();
  for (const a of allAnswers || []) {
    const list = answersByAttempt.get((a as any).attemptId) || [];
    list.push(a);
    answersByAttempt.set((a as any).attemptId, list);
  }

  const nowStr = new Date().toISOString();

  // 5. Re-grade each attempt
  for (const attempt of attempts) {
    const attMappings = mappingsByAttempt.get(attempt.id) || [];
    let mappedQuestions: QuestionData[] = [];

    if (attMappings.length > 0) {
      mappedQuestions = attMappings
        .map((m: any) => questionMap.get(m.questionId))
        .filter(Boolean) as QuestionData[];
    }

    if (mappedQuestions.length === 0) {
      mappedQuestions = (allQuestions || []) as QuestionData[];
    }

    const attAnswers = answersByAttempt.get(attempt.id) || [];

    const gradeSummary = gradeAttemptData(
      attempt.id,
      quiz,
      mappedQuestions,
      attAnswers,
      attempt.status as 'submitted' | 'auto_submitted',
      attempt.timeTakenSeconds || 0
    );

    // Update QuizAttempt record
    await supabase
      .from('QuizAttempt')
      .update({
        correctCount: gradeSummary.correctCount,
        wrongCount: gradeSummary.wrongCount,
        skippedCount: gradeSummary.skippedCount,
        netScore: gradeSummary.netScore,
        negativeMarks: gradeSummary.negativeMarks,
        percentageScore: gradeSummary.percentageScore,
        updatedAt: nowStr,
      } as any)
      .eq('id', attempt.id);

    // Update individual answers isCorrect
    for (const q of mappedQuestions) {
      const qRes = gradeSummary.questionResults[q.id];
      if (qRes) {
        await supabase
          .from('AttemptAnswer')
          .update({ isCorrect: qRes.isCorrect })
          .eq('attemptId', attempt.id)
          .eq('questionId', q.id);
      }
    }
  }

  return { totalAttemptsUpdated: attempts.length };
}

/**
 * Calculates dynamic leaderboard across all student attempts based on quiz positionType.
 */
export function calculateDynamicLeaderboard(
  quiz: QuizSettings,
  attemptsWithStudent: Array<{
    id: string;
    studentId: string;
    studentName?: string;
    student?: { id: string; fullName: string } | null;
    netScore: number;
    percentageScore?: number;
    correctCount?: number;
    wrongCount?: number;
    skippedCount?: number;
    timeTakenSeconds: number | null;
    attemptNumber: number;
    submittedAt: string | null;
    createdAt?: string;
  }>,
  currentUserId?: string | null
) {
  const rankingType = quiz.positionType || 'best_attempt';

  // Group attempts by student
  const attemptsByStudent = new Map<string, any[]>();
  for (const att of attemptsWithStudent) {
    if (!att.studentId) continue;
    if (!attemptsByStudent.has(att.studentId)) {
      attemptsByStudent.set(att.studentId, []);
    }
    attemptsByStudent.get(att.studentId)!.push(att);
  }

  const qualifyingAttempts: any[] = [];

  attemptsByStudent.forEach((studentAttempts) => {
    if (studentAttempts.length === 0) return;

    if (rankingType === 'average_attempt') {
      const totalScore = studentAttempts.reduce((sum, a) => sum + Number(a.netScore || 0), 0);
      const totalTime = studentAttempts.reduce((sum, a) => sum + Number(a.timeTakenSeconds || 0), 0);
      const avgScore = Number((totalScore / studentAttempts.length).toFixed(2));
      const avgTime = Math.round(totalTime / studentAttempts.length);
      const latest = studentAttempts[studentAttempts.length - 1];

      qualifyingAttempts.push({
        ...latest,
        netScore: avgScore,
        timeTakenSeconds: avgTime,
      });
    } else if (rankingType === 'first_attempt') {
      const first = studentAttempts.find(a => a.attemptNumber === 1) || studentAttempts[0];
      qualifyingAttempts.push(first);
    } else if (rankingType === 'last_attempt') {
      studentAttempts.sort((a, b) => {
        return new Date(b.submittedAt || b.createdAt || 0).getTime() - new Date(a.submittedAt || a.createdAt || 0).getTime();
      });
      qualifyingAttempts.push(studentAttempts[0]);
    } else {
      // 'best_attempt' (default)
      studentAttempts.sort((a, b) => {
        const scoreDiff = Number(b.netScore || 0) - Number(a.netScore || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return Number(a.timeTakenSeconds || 0) - Number(b.timeTakenSeconds || 0);
      });
      qualifyingAttempts.push(studentAttempts[0]);
    }
  });

  // Sort qualifying attempts across all students: Highest score first, tiebreaker: lowest time, then earlier submitted
  qualifyingAttempts.sort((a, b) => {
    const scoreDiff = Number(b.netScore || 0) - Number(a.netScore || 0);
    if (scoreDiff !== 0) return scoreDiff;
    const timeDiff = Number(a.timeTakenSeconds || 0) - Number(b.timeTakenSeconds || 0);
    if (timeDiff !== 0) return timeDiff;
    return new Date(a.submittedAt || a.createdAt || 0).getTime() - new Date(b.submittedAt || b.createdAt || 0).getTime();
  });

  // Assign ranks
  const leaderboard = qualifyingAttempts.map((entry, index) => {
    const studentName = entry.student?.fullName || (entry as any).User?.fullName || entry.studentName || 'Student';
    return {
      rank: index + 1,
      attemptId: entry.id,
      studentId: entry.studentId,
      studentName,
      netScore: Number(entry.netScore || 0),
      score: Number(entry.netScore || 0),
      percentageScore: entry.percentageScore || 0,
      correctCount: entry.correctCount || 0,
      wrongCount: entry.wrongCount || 0,
      skippedCount: entry.skippedCount || 0,
      timeTakenSeconds: entry.timeTakenSeconds,
      attemptNumber: entry.attemptNumber,
      submittedAt: entry.submittedAt,
      isCurrentUser: currentUserId ? entry.studentId === currentUserId : false,
    };
  });

  const currentUserIndex = currentUserId
    ? qualifyingAttempts.findIndex(a => a.studentId === currentUserId)
    : -1;
  const userRank = currentUserIndex >= 0 ? currentUserIndex + 1 : null;

  return {
    leaderboard,
    userRank,
    totalParticipants: qualifyingAttempts.length,
  };
}
