'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Plus,
  Trash2,
  Copy,
  GripVertical,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Download,
  Upload,
  FileText,
  Save,
  Eye,
  AlertCircle,
  CheckCircle,
  XCircle,
  HelpCircle,
  Settings,
  Shuffle,
  RotateCcw,
  Search,
  Clock,
  Trophy,
  TrendingUp,
  Infinity,
  Hash,
  ChevronRight,
} from 'lucide-react';
import styles from './page.module.css';

interface Question {
  id: string;
  tempId?: string;
  questionText: string;
  questionType: 'mcq' | 'true_false' | 'sba';
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string;
  correctOption: string;
  explanation: string;
  collapsed: boolean;
  displayOrder: number;
}

interface QuizFormData {
  title: string;
  description: string;
  instructions: string;
  categoryId: string;
  durationMinutes: number;
  numQuestionsToServe: number;
  positionType: 'best_attempt' | 'last_attempt' | 'first_attempt' | 'average_attempt';
  allowMultipleAttempts: boolean;
  maxAttempts: number;
  allowNegativeMarking: boolean;
  negativeValue: number;
  marksPerCorrect: number;
  sbaMarks: number;
  sbaNegative: number;
  tfMarks: number;
  tfNegative: number;
  startDatetime: string;
  endDatetime: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  status: 'draft' | 'published';
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Category {
  id: string;
  displayName: string;
}

// Category interface moved above

export default function QuizBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const isEditing = !!params.id;
  const quizId = isEditing ? (params.id as string) : null;
  
  // Categories removed from UI but kept in data model for backward compat
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [questionCounter, setQuestionCounter] = useState(0);

  const [formData, setFormData] = useState<QuizFormData>({
    title: '',
    description: '',
    instructions: '',
    categoryId: '',
    durationMinutes: 30,
    numQuestionsToServe: 10,
    positionType: 'best_attempt',
    allowMultipleAttempts: true,
    maxAttempts: 0,
    allowNegativeMarking: false,
    negativeValue: 0,
    marksPerCorrect: 2,
    sbaMarks: 2,
    sbaNegative: 0,
    tfMarks: 2,
    tfNegative: 0.5,
    startDatetime: '',
    endDatetime: '',
    shuffleQuestions: true,
    shuffleOptions: true,
    status: 'draft',
  });

  const updateFormData = useCallback((field: keyof QuizFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Categories no longer loaded in UI

  // Load existing quiz data if editing
  useEffect(() => {
    if (isEditing && quizId) {
      fetchQuizData();
    }
  }, [isEditing, quizId]);

  // fetchCategories removed — no longer needed in the builder UI

  const fetchQuizData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quiz/${quizId}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to load quiz');
      
      // Populate form data
      const newFormData = { ...formData };
      Object.keys(newFormData).forEach(k => {
        const key = k as keyof QuizFormData;
        if (data.quiz[key] !== undefined) {
          if (key === 'startDatetime' || key === 'endDatetime') {
            (newFormData as any)[key] = data.quiz[key] ? new Date(data.quiz[key]).toISOString().slice(0, 16) : '';
          } else if (key === 'maxAttempts' && data.quiz[key] === null) {
            (newFormData as any)[key] = 0;
          } else if (key === 'negativeValue') {
            (newFormData as any)[key] = data.quiz[key] !== undefined && data.quiz[key] !== null ? data.quiz[key] : 0;
          } else if (key === 'sbaMarks') {
            (newFormData as any)[key] = data.quiz[key] !== undefined && data.quiz[key] !== null ? data.quiz[key] : 2;
          } else if (key === 'sbaNegative') {
            (newFormData as any)[key] = data.quiz[key] !== undefined && data.quiz[key] !== null ? data.quiz[key] : 0;
          } else if (key === 'tfMarks') {
            (newFormData as any)[key] = data.quiz[key] !== undefined && data.quiz[key] !== null ? data.quiz[key] : 2;
          } else if (key === 'tfNegative') {
            (newFormData as any)[key] = data.quiz[key] !== undefined && data.quiz[key] !== null ? data.quiz[key] : 0.5;
          } else {
            (newFormData as any)[key] = data.quiz[key];
          }
        }
      });
      setFormData(newFormData);
      
      // Populate questions
      if (data.quiz.questions && data.quiz.questions.length > 0) {
        const loadedQuestions = data.quiz.questions.map((q: any, index: number) => ({
          id: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC || '',
          optionD: q.optionD || '',
          optionE: q.optionE || '',
          correctOption: q.correctOption,
          explanation: q.explanation || '',
          collapsed: false,
          displayOrder: index + 1,
        }));
        setQuestions(loadedQuestions);
        setQuestionCounter(loadedQuestions.length);
      } else {
        addQuestion();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addQuestion = (type: 'sba' | 'true_false' = 'sba') => {
    const newId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newQuestion: Question = {
      id: newId,
      tempId: newId,
      questionText: '',
      questionType: type,
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      optionE: '',
      correctOption: type === 'true_false' ? 'TTTTT' : 'A',
      explanation: '',
      collapsed: false,
      displayOrder: questions.length + 1,
    };
    setQuestions(prev => [...prev, newQuestion]);
    setQuestionCounter(prev => prev + 1);
  };

  const updateQuestion = (id: string, field: keyof Question, value: any) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const deleteQuestion = (id: string) => {
    setQuestions(prev => {
      const filtered = prev.filter(q => q.id !== id);
      return filtered.map((q, index) => ({ ...q, displayOrder: index + 1 }));
    });
  };

  const duplicateQuestion = (id: string) => {
    const question = questions.find(q => q.id === id);
    if (!question) return;
    
    const newId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newQuestion: Question = {
      ...question,
      id: newId,
      tempId: newId,
      displayOrder: questions.length + 1,
    };
    setQuestions(prev => [...prev, newQuestion]);
    setQuestionCounter(prev => prev + 1);
  };

  const toggleCollapse = (id: string) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, collapsed: !q.collapsed } : q));
  };

  const reorderQuestions = (fromIndex: number, toIndex: number) => {
    setQuestions(prev => {
      const newQuestions = [...prev];
      const [removed] = newQuestions.splice(fromIndex, 1);
      newQuestions.splice(toIndex, 0, removed);
      return newQuestions.map((q, index) => ({ ...q, displayOrder: index + 1 }));
    });
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch(`/api/quiz/${quizId || 'new'}/import?preview=true`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Import failed');
      
      const mappedValid = (data.validRows || []).map((r: any) => ({
        questionType: r.questionType || 'sba',
        questionText: r.questionText,
        explanation: r.explanation,
        correctOption: r.correctOption,
        optionA: r.optionA,
        optionB: r.optionB,
        optionC: r.optionC,
        optionD: r.optionD,
        optionE: r.optionE,
        valid: true,
        errors: [],
      }));
      const mappedInvalid = (data.invalidRows || []).map((r: any) => ({
        questionText: r.data?.[0] || 'Empty Question',
        optionA: r.data?.[1] || '',
        optionB: r.data?.[2] || '',
        optionC: r.data?.[3] || '',
        optionD: r.data?.[4] || '',
        optionE: r.data?.[5] || '',
        correctOption: r.data?.[6] || '',
        explanation: r.data?.[7] || '',
        questionType: r.data?.[6] && /^[TF]{5}$/i.test(r.data[6]) ? 'true_false' : 'sba',
        valid: false,
        errors: r.errors || [],
      }));
      
      setImportPreview({
        rows: [...mappedValid, ...mappedInvalid],
        validRows: data.validCount || 0,
        invalidRows: data.invalidCount || 0,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmImport = () => {
    if (!importPreview) return;
    const validQuestionsOnly = importPreview.rows.filter((r: any) => r.valid);
    
    const newQuestions = validQuestionsOnly.map((q: any, idx: number) => {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      return {
        id: tempId,
        tempId,
        questionText: q.questionText,
        questionType: q.questionType || 'sba',
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC || '',
        optionD: q.optionD || '',
        optionE: q.optionE || '',
        correctOption: q.correctOption,
        explanation: q.explanation || '',
        collapsed: false,
        displayOrder: questions.length + idx + 1,
      };
    });
    
    setQuestions(prev => [...prev, ...newQuestions]);
    setQuestionCounter(prev => prev + newQuestions.length);
    setShowImportModal(false);
    setImportPreview(null);
    setSuccess(`Successfully imported ${newQuestions.length} questions`);
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      setError('Quiz title is required');
      return false;
    }
    if (!formData.durationMinutes || formData.durationMinutes < 1) {
      setError('Duration must be at least 1 minute');
      return false;
    }
    if (!formData.numQuestionsToServe || formData.numQuestionsToServe < 1) {
      setError('Number of questions to serve is required');
      return false;
    }
    if (formData.numQuestionsToServe > questions.filter(q => q.questionText.trim()).length) {
      setError('Number of questions to serve cannot exceed total questions in the bank');
      return false;
    }
    
    const validQuestions = questions.filter(q => q.questionText.trim());
    if (validQuestions.length === 0) {
      setError('Please add at least one question to the quiz.');
      return false;
    }

    for (let i = 0; i < validQuestions.length; i++) {
      const q = validQuestions[i];
      const isTF = q.questionType === 'true_false' || q.questionType === 'mcq';
      const qLabel = `Question ${i + 1} ("${q.questionText.slice(0, 25)}...")`;

      if (!q.optionA.trim() || !q.optionB.trim()) {
        setError(`${qLabel} requires at least Options A and B to be filled.`);
        return false;
      }

      if (isTF) {
        if (!q.correctOption || q.correctOption.length !== 5 || !/^[TF]{5}$/i.test(q.correctOption)) {
          setError(`${qLabel} is a True/False Matrix question and requires True/False set for all 5 statements.`);
          return false;
        }
      } else {
        // SBA
        if (!q.correctOption || !/^[A-E]$/i.test(q.correctOption)) {
          setError(`${qLabel} is an SBA question and requires a selected Single Best Answer (A to E).`);
          return false;
        }
        const selectedOptionVal = q[`option${q.correctOption.toUpperCase()}` as keyof typeof q] as string;
        if (!selectedOptionVal || !selectedOptionVal.trim()) {
          setError(`${qLabel}: selected option ${q.correctOption} is empty.`);
          return false;
        }
      }
    }
    
    return true;
  };

  const saveQuiz = async (publish = false) => {
    if (!validateForm()) return;
    
    setSaving(true);
    setError(null);
    
    try {
      const validQuestions = questions.filter(q => q.questionText.trim());
      const payload = {
        ...formData,
        status: publish ? 'published' : formData.status,
        questions: validQuestions.map((q, index) => ({
          id: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC || null,
          optionD: q.optionD || null,
          optionE: q.optionE || null,
          correctOption: q.correctOption,
          explanation: q.explanation || null,
          displayOrder: index + 1,
        })),
      };
      
      const url = isEditing ? `/api/quiz/${quizId}` : '/api/quiz';
      const method = isEditing ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to save quiz');
      
      setSuccess(publish ? 'Quiz published successfully!' : 'Quiz saved as draft');
      
      if (!isEditing) {
        router.push(`/teacher/dashboard/quizzes/${data.quiz.id}/edit`);
      } else {
        // Refresh to get updated data
        fetchQuizData();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.open('/api/quiz/import-template', '_blank');
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading quiz builder...</p>
        </div>
      </div>
    );
  }

  const validQuestionsCount = questions.filter(q => q.questionText.trim()).length;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/teacher/dashboard/quizzes" className={styles.backLink}>
          <ChevronLeft className={styles.backIcon} />
          Back to Quizzes
        </Link>
        <div className={styles.headerActions}>
          <Link href="/teacher/dashboard/quizzes" className={styles.secondaryBtn}>
            Cancel
          </Link>
          <button onClick={() => saveQuiz(false)} disabled={saving} className={styles.saveBtn}>
            <Save className={styles.btnIcon} />
            {saving ? 'Saving...' : 'Save as Draft'}
          </button>
          <button onClick={() => saveQuiz(true)} disabled={saving} className={styles.publishBtn}>
            <Eye className={styles.btnIcon} />
            {saving ? 'Publishing...' : 'Publish Quiz'}
          </button>
        </div>
      </header>

      {error && <div className={styles.errorBanner}><AlertCircle className={styles.errorIcon} />{error}<button onClick={() => setError(null)} className={styles.errorDismiss}>&times;</button></div>}
      {success && <div className={styles.successBanner}><CheckCircle className={styles.successIcon} />{success}<button onClick={() => setSuccess(null)} className={styles.successDismiss}>&times;</button></div>}

      <main className={styles.main}>
        {/* Metadata Section */}
        {/* Modern Vercel-Style Quiz Settings Dashboard */}
        <div style={{ marginBottom: '24px' }}>
          <h2 className={styles.sectionTitle} style={{ fontSize: '24px', marginBottom: '8px' }}>
            <Settings className={styles.sectionIcon} style={{ width: '28px', height: '28px', color: 'var(--primary-color)' }} />
            Quiz Settings
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginLeft: '38px', marginTop: 0 }}>
            Configure the behavior and rules for your quiz.
          </p>
        </div>
        <section className={styles.section} style={{ background: 'transparent', border: 'none', padding: 0 }}>
          <div className={styles.cardSetting}>
            <div className={styles.settingHeader}>
              <h3>Quiz Title <span className={styles.required}>*</span></h3>
              <p>Maximum 200 characters</p>
            </div>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={e => updateFormData('title', e.target.value)}
              placeholder="Enter quiz title"
              className={styles.input}
              maxLength={200}
            />
          </div>

          <div className={styles.settingHeader}>
            <h3>General Configuration</h3>
          </div>
          <div className={styles.grid4}>
            <div className={styles.miniCard}>
              <div className={styles.miniCardHeader}>
                <Clock className={styles.miniCardIcon} />
                Duration (minutes) <span className={styles.required}>*</span>
              </div>
              <input
                type="number"
                min="1"
                max="180"
                value={formData.durationMinutes}
                onChange={e => updateFormData('durationMinutes', parseInt(e.target.value) || 1)}
                className={styles.input}
                style={{ marginBottom: '8px' }}
              />
              <div className={styles.miniCardBody}>Time allowed for the quiz</div>
            </div>

            <div className={styles.miniCard}>
              <div className={styles.miniCardHeader}>
                <HelpCircle className={styles.miniCardIcon} />
                Questions to Serve <span className={styles.required}>*</span>
              </div>
              <input
                type="number"
                min="1"
                max={questions.length}
                value={formData.numQuestionsToServe}
                onChange={e => updateFormData('numQuestionsToServe', parseInt(e.target.value) || 1)}
                className={styles.input}
                style={{ marginBottom: '8px' }}
              />
              <div className={styles.miniCardBody}>Max: {questions.length} available ({validQuestionsCount} valid)</div>
            </div>

            <div className={styles.miniCard}>
              <div className={styles.miniCardHeader}>
                <TrendingUp className={styles.miniCardIcon} />
                Ranking Method
              </div>
              <div className={styles.segmentedControl}>
                {[
                  { value: 'best_attempt', label: 'Best' },
                  { value: 'last_attempt', label: 'Last' },
                  { value: 'first_attempt', label: 'First' },
                  { value: 'average_attempt', label: 'Average' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`${styles.segmentBtn} ${formData.positionType === opt.value ? styles.segmentActive : ''}`}
                    onClick={() => updateFormData('positionType', opt.value as any)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className={styles.miniCardBody}>Tie-breaker: Less time taken ranks higher</div>
            </div>
          </div>

          <div className={styles.settingHeader}>
            <h3>Marking Scheme</h3>
          </div>
          <div className={styles.grid2}>
            {/* SBA Marking Box */}
            <div className={styles.cardSetting} style={{ margin: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontWeight: '600', fontSize: '1.05rem' }}>
                <CheckCircle className={styles.miniCardIcon} />
                SBA Marking Scheme
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label} style={{ display: 'block', marginBottom: '6px' }}>SBA Marks Per Question</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.sbaMarks}
                  onChange={e => updateFormData('sbaMarks', parseFloat(e.target.value) || 0)}
                  className={styles.input}
                />
              </div>

              <div>
                <label className={styles.label} style={{ display: 'block', marginBottom: '6px' }}>SBA Negative Marks (Per Wrong Answer)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={formData.sbaNegative}
                    onChange={e => updateFormData('sbaNegative', parseFloat(e.target.value) || 0)}
                    className={styles.input}
                    placeholder="e.g. 0.25"
                  />
                  <span style={{ fontWeight: '600', color: 'var(--text-muted)', fontSize: '13px' }}>marks</span>
                </div>
              </div>
            </div>

            {/* T/F Marking Box */}
            <div className={styles.cardSetting} style={{ margin: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontWeight: '600', fontSize: '1.05rem' }}>
                <CheckCircle className={styles.miniCardIcon} />
                T/F Marking Scheme
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label} style={{ display: 'block', marginBottom: '6px' }}>T/F Marks Per Option</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  value={formData.tfMarks}
                  onChange={e => updateFormData('tfMarks', parseFloat(e.target.value) || 0)}
                  className={styles.input}
                />
              </div>

              <div>
                <label className={styles.label} style={{ display: 'block', marginBottom: '6px' }}>T/F Negative Marks (Per Wrong Option)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.tfNegative}
                    onChange={e => updateFormData('tfNegative', parseFloat(e.target.value) || 0)}
                    className={styles.input}
                    placeholder="e.g. 0.5"
                  />
                  <span style={{ fontWeight: '600', color: 'var(--text-muted)', fontSize: '13px' }}>marks</span>
                </div>
              </div>
            </div>
          </div>

          {/* Live Total Marks Summary Box */}
          <div style={{ 
            marginTop: '16px', 
            padding: '16px 20px', 
            borderRadius: '12px', 
            background: 'rgba(59, 130, 246, 0.08)', 
            border: '1px solid rgba(59, 130, 246, 0.3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trophy size={18} style={{ color: '#3b82f6' }} />
                <span>Calculated Total Marks: </span>
                <span style={{ color: '#3b82f6', fontSize: '18px' }}>
                  {((questions.filter(q => q.questionType === 'sba' && q.questionText.trim()).length * (formData.sbaMarks || 0)) + 
                    (questions.filter(q => (q.questionType === 'true_false' || q.questionType === 'mcq') && q.questionText.trim()).length * 5 * (formData.tfMarks || 0))).toFixed(1)} Marks
                </span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {questions.filter(q => q.questionType === 'sba' && q.questionText.trim()).length} SBA ({questions.filter(q => q.questionType === 'sba' && q.questionText.trim()).length} × {formData.sbaMarks}m = {questions.filter(q => q.questionType === 'sba' && q.questionText.trim()).length * (formData.sbaMarks || 0)}m) + {questions.filter(q => (q.questionType === 'true_false' || q.questionType === 'mcq') && q.questionText.trim()).length} True/False ({questions.filter(q => (q.questionType === 'true_false' || q.questionType === 'mcq') && q.questionText.trim()).length} × 5 options × {formData.tfMarks}m = {questions.filter(q => (q.questionType === 'true_false' || q.questionType === 'mcq') && q.questionText.trim()).length * 5 * (formData.tfMarks || 0)}m)
              </div>
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
              Serves {formData.numQuestionsToServe} questions per student
            </div>
          </div>

          <div className={styles.settingHeader}>
            <h3>Attempts</h3>
          </div>
          <div className={styles.cardSetting}>
            <label className={styles.checkboxLabel} style={{ marginBottom: formData.allowMultipleAttempts ? '16px' : '0' }}>
              <input
                type="checkbox"
                checked={formData.allowMultipleAttempts}
                onChange={e => updateFormData('allowMultipleAttempts', e.target.checked)}
                className={styles.checkbox}
              />
              <span className={styles.checkmark}></span>
              <div>
                <strong>Allow Multiple Attempts</strong>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Let users retry the quiz</p>
              </div>
            </label>

            {formData.allowMultipleAttempts && (
              <div style={{ animation: 'slideDown 0.2s ease-out' }}>
                <div className={styles.radioCardGrid}>
                  <div 
                    className={`${styles.radioCard} ${formData.maxAttempts === 0 ? styles.radioCardSelected : ''}`}
                    onClick={() => updateFormData('maxAttempts', 0)}
                  >
                    <div className={styles.radioIndicator}>
                      <div className={styles.radioIndicatorInner}></div>
                    </div>
                    <div className={styles.radioContent}>
                      <div className={styles.radioTitle}><Infinity size={16} /> Unlimited Attempts</div>
                      <p className={styles.radioDesc}>Users can attempt unlimited times</p>
                    </div>
                  </div>

                  <div 
                    className={`${styles.radioCard} ${formData.maxAttempts !== 0 ? styles.radioCardSelected : ''}`}
                    onClick={() => updateFormData('maxAttempts', formData.maxAttempts === 0 ? 5 : formData.maxAttempts)}
                  >
                    <div className={styles.radioIndicator}>
                      <div className={styles.radioIndicatorInner}></div>
                    </div>
                    <div className={styles.radioContent}>
                      <div className={styles.radioTitle}><Hash size={16} /> Limited Attempts</div>
                      <p className={styles.radioDesc}>Set a maximum number of attempts</p>
                    </div>
                  </div>
                </div>

                <div style={{ opacity: formData.maxAttempts === 0 ? 0.4 : 1, transition: 'opacity 0.2s', pointerEvents: formData.maxAttempts === 0 ? 'none' : 'auto' }}>
                  <label htmlFor="maxAttempts" className={styles.label}>Maximum Attempts</label>
                  <input
                    id="maxAttempts"
                    type="number"
                    min="2"
                    max="100"
                    value={formData.maxAttempts === 0 ? '' : formData.maxAttempts}
                    onChange={e => updateFormData('maxAttempts', parseInt(e.target.value) || 2)}
                    className={styles.input}
                    disabled={formData.maxAttempts === 0}
                    style={{ background: formData.maxAttempts === 0 ? 'rgba(0,0,0,0.2)' : 'var(--input-bg)' }}
                    placeholder={formData.maxAttempts === 0 ? 'Unlimited' : ''}
                  />
                  <p className={styles.helper} style={{ marginTop: '8px' }}>Number of allowed retries</p>
                </div>
              </div>
            )}
          </div>



        </section>

        {/* Questions Section */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <FileText className={styles.sectionIcon} />
              Questions ({validQuestionsCount} valid)
            </h2>
            <div className={styles.sectionActions}>
              <button
                onClick={handleDownloadTemplate}
                className={styles.iconBtn}
                title="Download CSV Template"
              >
                <Download className={styles.iconBtnIcon} />
                <span className={styles.iconBtnText}>Template</span>
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className={styles.iconBtn}
                title="Import Questions from CSV"
              >
                <Upload className={styles.iconBtnIcon} />
                <span className={styles.iconBtnText}>Import CSV</span>
              </button>
              <button
                onClick={() => addQuestion('sba')}
                className={styles.addQuestionBtn}
              >
                <Plus className={styles.btnIcon} />
                Add Question
              </button>
            </div>
          </div>
          
          {questions.length === 0 ? (
            <div className={styles.emptyQuestions}>
              <FileText className={styles.emptyIcon} />
              <p>No questions added yet</p>
              <button onClick={() => addQuestion('sba')} className={styles.addFirstBtn}>
                <Plus className={styles.btnIcon} />
                Add Your First Question
              </button>
            </div>
          ) : (
            <>
              <div className={styles.questionsList} role="list">
                {questions.map((question, index) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    index={index}
                    total={questions.length}
                    onUpdate={updateQuestion}
                    onDelete={deleteQuestion}
                    onDuplicate={duplicateQuestion}
                    onToggleCollapse={toggleCollapse}
                    onReorder={reorderQuestions}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => addQuestion('sba')}
                className={styles.addQuestionBottomBtn}
              >
                <Plus className={styles.btnIcon} />
                Add Question
              </button>
            </>
          )}
        </section>

        <div className={styles.bottomActions}>
          <Link href="/teacher/dashboard/quizzes" className={styles.secondaryBtn}>
            Cancel
          </Link>
          <button onClick={() => saveQuiz(false)} disabled={saving} className={styles.saveBtn}>
            <Save className={styles.btnIcon} />
            {saving ? 'Saving...' : 'Save as Draft'}
          </button>
          <button onClick={() => saveQuiz(true)} disabled={saving} className={styles.publishBtn}>
            <Eye className={styles.btnIcon} />
            {saving ? 'Publishing...' : 'Publish Quiz'}
          </button>
        </div>
      </main>

      {/* Import Modal */}
      {showImportModal && (
        <div className={styles.modalOverlay} onClick={() => setShowImportModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Import Questions from CSV</h3>
              <button onClick={() => setShowImportModal(false)} className={styles.modalClose}>&times;</button>
            </div>
            <div className={styles.modalBody}>
              <p>Upload a CSV file with your questions. <button onClick={handleDownloadTemplate} className={styles.inlineLink}>Download template</button> to see the required format.</p>
              
              <div className={styles.dropZone}>
                <input
                  type="file"
                  accept=".csv"
                  onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])}
                  className={styles.fileInput}
                  id="csv-upload"
                  disabled={importing}
                />
                <label htmlFor="csv-upload" className={styles.dropZoneLabel}>
                  <FileText className={styles.dropIcon} />
                  <p>Click or drag CSV file here</p>
                  <span className={styles.dropHint}>Supports .csv files</span>
                </label>
              </div>
              
               {importPreview && (
                <div className={styles.importPreview}>
                  <h4>Preview ({importPreview.validRows} valid, {importPreview.invalidRows} invalid)</h4>
                  {importPreview.rows.length > 0 && (
                    <table className={styles.previewTable}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Question</th>
                          <th>Type</th>
                          <th>Correct</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.rows.slice(0, 15).map((row: any, i: number) => (
                          <tr key={i} className={row.valid ? '' : styles.invalidRow}>
                            <td>{i + 1}</td>
                            <td title={row.questionText}>{row.questionText?.slice(0, 45)}{row.questionText?.length > 45 ? '...' : ''}</td>
                            <td>{row.questionType}</td>
                            <td>{row.correctOption}</td>
                            <td>
                              {row.valid ? (
                                <span style={{ color: 'var(--success-color)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <CheckCircle style={{ width: '14px', height: '14px' }} /> Valid
                                </span>
                              ) : (
                                <span style={{ color: 'var(--error-color)', display: 'inline-flex', alignItems: 'center', gap: '4px' }} title={row.errors.join(', ')}>
                                  <XCircle style={{ width: '14px', height: '14px' }} /> {row.errors[0]}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {importPreview.invalidRows > 0 && (
                    <p className={styles.invalidNote} style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '12px' }}>
                      {importPreview.invalidRows} invalid row{importPreview.invalidRows > 1 ? 's' : ''} will be skipped. Fix the CSV file or continue to import only valid questions.
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button onClick={() => setShowImportModal(false)} className={styles.secondaryBtn} disabled={importing}>
                Cancel
              </button>
              {importPreview && importPreview.validRows > 0 && (
                <button
                  onClick={handleConfirmImport}
                  className={styles.saveBtn}
                  disabled={importing}
                >
                  {importing ? 'Importing...' : 'Confirm Import'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// Question Card Component
function QuestionCard({ 
  question, 
  index, 
  total, 
  onUpdate, 
  onDelete, 
  onDuplicate, 
  onToggleCollapse,
  onReorder,
}: any) {
  const [dragging, setDragging] = useState(false);
  
  const isTF = question.questionType === 'true_false' || question.questionType === 'mcq';
  const typeLabel = isTF ? 'True / False Matrix [T_F]' : 'Single Best Answer [SBA]';
  const correctStr = (question.correctOption || (isTF ? 'TTTTT' : 'A')).toUpperCase().padEnd(5, 'T');

  return (
    <article 
      className={`${styles.questionCard} ${question.collapsed ? styles.collapsed : ''} ${dragging ? styles.dragging : ''}`}
      draggable
      onDragStart={e => { setDragging(true); e.dataTransfer.effectAllowed = 'move'; }}
      onDragEnd={() => setDragging(false)}
      onDragOver={e => e.preventDefault()}
    >
      <div className={styles.questionHeader}>
        <div className={styles.dragHandle} title="Drag to reorder">
          <GripVertical className={styles.dragIcon} />
        </div>
        
        <div className={styles.questionInfo}>
          <span className={styles.questionNumber}>Q{index + 1}</span>
          <span className={`${styles.questionTypeBadge} ${isTF ? styles.badgeTF : styles.badgeSBA}`}>
            {typeLabel}
          </span>
        </div>
        
        <div className={styles.questionActions}>
          <button type="button" onClick={() => onToggleCollapse(question.id)} className={styles.actionBtn} title={question.collapsed ? 'Expand' : 'Collapse'}>
            {question.collapsed ? <ChevronDown className={styles.actionIcon} /> : <ChevronUp className={styles.actionIcon} />}
          </button>
          <button type="button" onClick={() => onDuplicate(question.id)} className={styles.actionBtn} title="Duplicate">
            <Copy className={styles.actionIcon} />
          </button>
          <button type="button" onClick={() => onDelete(question.id)} className={`${styles.actionBtn} ${styles.danger}`} title="Delete">
            <Trash2 className={styles.actionIcon} />
          </button>
        </div>
      </div>
      
      {!question.collapsed && (
        <div className={styles.questionBody}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Question / Stem Text <span className={styles.required}>*</span></label>
            <textarea
              value={question.questionText}
              onChange={e => onUpdate(question.id, 'questionText', e.target.value)}
              placeholder={isTF ? "Enter stem (e.g. Regarding cranial nerves, which of the following statements are True or False?)..." : "Enter question text..."}
              className={styles.textarea}
              rows={3}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label className={styles.label}>Question Type</label>
            <select
              value={isTF ? 'true_false' : 'sba'}
              onChange={e => {
                const newType = e.target.value as 'sba' | 'true_false';
                onUpdate(question.id, 'questionType', newType);
                if (newType === 'true_false') {
                  let existing = (question.correctOption || '').toUpperCase();
                  if (existing.length !== 5 || !/^[TF]{5}$/.test(existing)) {
                    existing = 'TTTTT';
                  }
                  onUpdate(question.id, 'correctOption', existing);
                } else {
                  let existing = (question.correctOption || '').toUpperCase();
                  if (!/^[A-E]$/.test(existing)) {
                    existing = 'A';
                  }
                  onUpdate(question.id, 'correctOption', existing);
                }
              }}
              className={styles.select}
            >
              <option value="sba">Single Best Answer [SBA] (1 correct option out of A–E)</option>
              <option value="true_false">True / False Matrix [T_F] (5 options A–E, each True or False)</option>
            </select>
          </div>

          <div style={{ marginBottom: '8px' }}>
            <label className={styles.label}>
              {isTF ? 'Options / Statements (A to E) & Correct T/F Answers:' : 'Options (A to E) & Select Single Best Answer:'}
            </label>
          </div>
          
          <div className={styles.optionsGrid}>
            {['A', 'B', 'C', 'D', 'E'].map((letter, idx) => {
              const optionVal = question[`option${letter}` as keyof typeof question] as string || '';
              const isSelectedSBA = !isTF && question.correctOption === letter;
              const tfStatus = correctStr[idx] === 'F' ? 'F' : 'T';
              
              return (
                <div key={letter} className={`${styles.optionRow} ${isSelectedSBA ? styles.correctOption : ''}`}>
                  {!isTF ? (
                    <label className={styles.tfLabel} title="Select as correct answer">
                      <input
                        type="radio"
                        name={`sba-correct-${question.id}`}
                        checked={question.correctOption === letter}
                        onChange={() => onUpdate(question.id, 'correctOption', letter)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary-color)' }}
                      />
                    </label>
                  ) : null}

                  <span className={styles.optionLetter} style={{ fontWeight: 'bold' }}>{letter}</span>

                  <input
                    type="text"
                    value={optionVal}
                    onChange={e => onUpdate(question.id, `option${letter}`, e.target.value)}
                    placeholder={`Statement / Option ${letter}`}
                    className={styles.optionInput}
                  />

                  {isTF && (
                    <div className={styles.tfButtonGroup} style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const arr = correctStr.split('');
                          arr[idx] = 'T';
                          onUpdate(question.id, 'correctOption', arr.join(''));
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: tfStatus === 'T' ? '2px solid #10b981' : '1px solid var(--border-color)',
                          background: tfStatus === 'T' ? '#10b981' : 'transparent',
                          color: tfStatus === 'T' ? '#ffffff' : 'var(--text-secondary)',
                          fontWeight: '700',
                          cursor: 'pointer',
                          fontSize: '13px',
                          transition: 'all 0.15s ease'
                        }}
                        title="Mark as True"
                      >
                        True
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const arr = correctStr.split('');
                          arr[idx] = 'F';
                          onUpdate(question.id, 'correctOption', arr.join(''));
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: tfStatus === 'F' ? '2px solid #ef4444' : '1px solid var(--border-color)',
                          background: tfStatus === 'F' ? '#ef4444' : 'transparent',
                          color: tfStatus === 'F' ? '#ffffff' : 'var(--text-secondary)',
                          fontWeight: '700',
                          cursor: 'pointer',
                          fontSize: '13px',
                          transition: 'all 0.15s ease'
                        }}
                        title="Mark as False"
                      >
                        False
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className={styles.formGroup} style={{ marginTop: '16px' }}>
            <label className={styles.label}>Explanation (Optional - shown after submission)</label>
            <textarea
              value={question.explanation || ''}
              onChange={e => onUpdate(question.id, 'explanation', e.target.value)}
              placeholder="Explain why the answers are correct..."
              className={styles.textarea}
              rows={2}
            />
          </div>
        </div>
      )}
    </article>
  );
}