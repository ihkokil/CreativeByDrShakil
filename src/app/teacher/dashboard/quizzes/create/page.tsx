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
  questionType: 'mcq' | 'true_false';
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
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
  positionType: 'best_attempt' | 'last_attempt' | 'first_attempt';
  allowMultipleAttempts: boolean;
  maxAttempts: number;
  allowNegativeMarking: boolean;
  negativeValue: number;
  marksPerCorrect: number;
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
    negativeValue: 0.25,
    marksPerCorrect: 1,
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
          } else {
            (newFormData as any)[key] = data.quiz[key];
          }
        }
      });
      setFormData(newFormData);
      
      // Populate questions
      if (data.questions && data.questions.length > 0) {
        const loadedQuestions = data.questions.map((q: any, index: number) => ({
          id: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC || '',
          optionD: q.optionD || '',
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

  const addQuestion = () => {
    const newId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newQuestion: Question = {
      id: newId,
      tempId: newId,
      questionText: '',
      questionType: 'mcq',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctOption: '',
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
        questionText: r.questionText,
        explanation: r.explanation,
        correctOption: r.correctOption,
        optionA: r.optionA,
        optionB: r.optionB,
        optionC: r.optionC,
        optionD: r.optionD,
        valid: true,
        errors: [],
      }));
      const mappedInvalid = (data.invalidRows || []).map((r: any) => ({
        questionText: r.data?.[0] || 'Empty Question',
        explanation: r.data?.[1] || '',
        correctOption: r.data?.[2] || '',
        optionA: r.data?.[3] || '',
        optionB: r.data?.[4] || '',
        optionC: r.data?.[5] || '',
        optionD: r.data?.[6] || '',
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
      const isTrueFalse = q.optionC === null || q.optionC === undefined || q.optionC === '';
      return {
        id: tempId,
        tempId,
        questionText: q.questionText,
        questionType: isTrueFalse ? 'true_false' : 'mcq',
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC || '',
        optionD: q.optionD || '',
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
      setError('Number of questions to serve cannot exceed total questions added');
      return false;
    }
    
    const validQuestions = questions.filter(q => q.questionText.trim());
    for (const q of validQuestions) {
      if (!q.optionA.trim() || !q.optionB.trim()) {
        setError(`Question "${q.questionText.slice(0, 30)}..." requires at least 2 options`);
        return false;
      }
      if (!q.correctOption) {
        setError(`Question "${q.questionText.slice(0, 30)}..." requires a correct answer`);
        return false;
      }
      // Check that the selected correctOption letter ('A', 'B', 'C', or 'D') refers to a non-empty option
      const selectedOptionVal = q[`option${q.correctOption}` as keyof typeof q] as string;
      if (!selectedOptionVal || !selectedOptionVal.trim()) {
        setError(`Correct option for "${q.questionText.slice(0, 30)}..." doesn't match any option`);
        return false;
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
                <Trophy className={styles.miniCardIcon} />
                Marks per Correct <span className={styles.required}>*</span>
              </div>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="10"
                value={formData.marksPerCorrect}
                onChange={e => updateFormData('marksPerCorrect', parseFloat(e.target.value) || 1)}
                className={styles.input}
                style={{ marginBottom: '8px' }}
              />
              <div className={styles.miniCardBody}>Points awarded per correct answer</div>
            </div>

            <div className={styles.miniCard}>
              <div className={styles.miniCardHeader}>
                <TrendingUp className={styles.miniCardIcon} />
                Ranking Method
              </div>
              <select
                value={formData.positionType}
                onChange={e => updateFormData('positionType', e.target.value as any)}
                className={styles.select}
                style={{ marginBottom: '8px' }}
              >
                <option value="best_attempt">Best Attempt</option>
                <option value="last_attempt">Last Attempt</option>
                <option value="first_attempt">First Attempt</option>
              </select>
              <div className={styles.miniCardBody}>Tie-breaker: Less time taken ranks higher</div>
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

          <div className={styles.settingHeader}>
            <h3>Scoring</h3>
          </div>
          <div className={styles.cardSetting}>
            <div className={styles.scoringLayout}>
              <div className={styles.scoringMain}>
                <label className={styles.checkboxLabel} style={{ marginBottom: '8px' }}>
                  <input
                    type="checkbox"
                    checked={formData.allowNegativeMarking}
                    onChange={e => updateFormData('allowNegativeMarking', e.target.checked)}
                    className={styles.checkbox}
                  />
                  <span className={styles.checkmark}></span>
                  <div>
                    <strong>Enable Negative Marking</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Deduct marks for wrong answers</p>
                  </div>
                </label>

                <div style={{ opacity: formData.allowNegativeMarking ? 1 : 0.4, transition: 'opacity 0.2s', pointerEvents: formData.allowNegativeMarking ? 'auto' : 'none' }}>
                  <label htmlFor="negativeValue" className={styles.label}>Penalty per Wrong Answer</label>
                  <input
                    id="negativeValue"
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={formData.negativeValue}
                    onChange={e => updateFormData('negativeValue', parseFloat(e.target.value) || 0.25)}
                    className={styles.input}
                    disabled={!formData.allowNegativeMarking}
                    style={{ background: formData.allowNegativeMarking ? 'var(--input-bg)' : 'rgba(0,0,0,0.2)' }}
                  />
                  <p className={styles.helper} style={{ marginTop: '8px' }}>Fraction of marks (e.g., 0.25 = 25%)</p>
                </div>
              </div>

              <div className={styles.scoringInfo}>
                <AlertCircle className={styles.scoringInfoIcon} />
                <div>
                  <h4>How it works</h4>
                  <p>If enabled, marks will be deducted for each incorrect answer based on the penalty value.</p>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.settingHeader}>
            <h3>Randomization</h3>
          </div>
          <div>
            <div 
              className={styles.randomRow} 
              onClick={() => updateFormData('shuffleQuestions', !formData.shuffleQuestions)}
            >
              <div className={styles.randomContent}>
                <label className={styles.checkboxLabel} style={{ margin: 0 }} onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={formData.shuffleQuestions}
                    onChange={e => updateFormData('shuffleQuestions', e.target.checked)}
                    className={styles.checkbox}
                  />
                  <span className={styles.checkmark}></span>
                </label>
                <Shuffle className={styles.randomIcon} />
                <div className={styles.randomText}>
                  <span className={styles.randomTitle}>Shuffle Question Order</span>
                  <span className={styles.randomDesc}>Questions appear in random order for each attempt</span>
                </div>
              </div>
              <ChevronRight className={styles.randomIcon} />
            </div>

            <div 
              className={styles.randomRow}
              onClick={() => updateFormData('shuffleOptions', !formData.shuffleOptions)}
            >
              <div className={styles.randomContent}>
                <label className={styles.checkboxLabel} style={{ margin: 0 }} onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={formData.shuffleOptions}
                    onChange={e => updateFormData('shuffleOptions', e.target.checked)}
                    className={styles.checkbox}
                  />
                  <span className={styles.checkmark}></span>
                </label>
                <Shuffle className={styles.randomIcon} />
                <div className={styles.randomText}>
                  <span className={styles.randomTitle}>Shuffle Option Order</span>
                  <span className={styles.randomDesc}>Options within each question are randomized</span>
                </div>
              </div>
              <ChevronRight className={styles.randomIcon} />
            </div>
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
                onClick={addQuestion}
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
              <button onClick={addQuestion} className={styles.addFirstBtn}>
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
                onClick={addQuestion}
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
                            <td>{row.optionC ? 'MCQ' : 'True/False'}</td>
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
  
  const options = [
    { letter: 'A', value: question.optionA },
    { letter: 'B', value: question.optionB },
    { letter: 'C', value: question.optionC },
    { letter: 'D', value: question.optionD },
  ].filter(o => o.value.trim());
  
  const isTrueFalse = options.length === 2 && 
    options.some(o => o.value.toLowerCase() === 'true') && 
    options.some(o => o.value.toLowerCase() === 'false');
  
  const validOptions = options.filter(o => o.value.trim());
  const hasCorrectOption = validOptions.some(o => o.letter === question.correctOption);

  return (
    <article 
      className={`${styles.questionCard} ${question.collapsed ? styles.collapsed : ''} ${dragging ? styles.dragging : ''}`}
      draggable
      onDragStart={e => { setDragging(true); e.dataTransfer.effectAllowed = 'move'; }}
      onDragEnd={() => setDragging(false)}
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        e.preventDefault();
        // Reorder logic would go here
      }}
    >
      <div className={styles.questionHeader}>
        <div className={styles.dragHandle} title="Drag to reorder">
          <GripVertical className={styles.dragIcon} />
        </div>
        
        <div className={styles.questionInfo}>
          <span className={styles.questionNumber}>Q{index + 1}</span>
          <span className={styles.questionTypeBadge}>{isTrueFalse ? 'True/False' : 'MCQ'}</span>
        </div>
        
        <div className={styles.questionActions}>
          <button onClick={() => onToggleCollapse(question.id)} className={styles.actionBtn} title={question.collapsed ? 'Expand' : 'Collapse'}>
            {question.collapsed ? <ChevronDown className={styles.actionIcon} /> : <ChevronUp className={styles.actionIcon} />}
          </button>
          <button onClick={() => onDuplicate(question.id)} className={styles.actionBtn} title="Duplicate">
            <Copy className={styles.actionIcon} />
          </button>
          <button onClick={() => onDelete(question.id)} className={`${styles.actionBtn} ${styles.danger}`} title="Delete">
            <Trash2 className={styles.actionIcon} />
          </button>
        </div>
      </div>
      
      {!question.collapsed && (
        <div className={styles.questionBody}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Question Text <span className={styles.required}>*</span></label>
            <textarea
              value={question.questionText}
              onChange={e => onUpdate(question.id, 'questionText', e.target.value)}
              placeholder="Enter your question..."
              className={styles.textarea}
              rows={3}
            />
          </div>
          
          <div className={styles.optionsGrid}>
            {['A', 'B', 'C', 'D'].map(letter => {
              const option = question[`option${letter}` as keyof typeof question] as string;
              return (
                <div key={letter} className={`${styles.optionRow} ${question.correctOption === letter ? styles.correctOption : ''}`}>
                  <label className={styles.optionRadio}>
                    <input
                      type="radio"
                      name={`correct-${question.id}`}
                      value={letter}
                      checked={question.correctOption === letter}
                      onChange={() => onUpdate(question.id, 'correctOption', letter)}
                      className={styles.radioInput}
                    />
                    <span className={styles.radioMark}></span>
                  </label>
                  <span className={styles.optionLetter}>{letter}</span>
                  <input
                    type="text"
                    value={option}
                    onChange={e => onUpdate(question.id, `option${letter}`, e.target.value)}
                    placeholder={`Option ${letter}`}
                    className={styles.optionInput}
                  />
                </div>
              );
            })}
          </div>
          
          {validOptions.length < 4 && (
            <p className={styles.addOptionHint}>
              Add options C and D to make this a full MCQ. Leave blank for True/False.
            </p>
          )}
          
          {!hasCorrectOption && validOptions.length > 0 && (
            <p className={styles.warning}>
              <AlertCircle className={styles.warningIcon} />
              Please select a correct answer from the available options
            </p>
          )}
          
          <div className={styles.formGroup}>
            <label className={styles.label}>Explanation (optional)</label>
            <textarea
              value={question.explanation}
              onChange={e => onUpdate(question.id, 'explanation', e.target.value)}
              placeholder="Explanation shown to students after quiz submission"
              className={styles.textarea}
              rows={2}
            />
          </div>
        </div>
      )}
    </article>
  );
}