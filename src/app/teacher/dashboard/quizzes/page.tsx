'use client';


import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Copy,
  Eye,
  ExternalLink,
  MoreVertical,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Download,
  Upload,
  BarChart2,
  Link as LinkIcon,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  BookOpen,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import styles from './TeacherQuizzesPage.module.css';
import ConfirmModal from '@/components/UI/ConfirmModal';
import AlertModal from '@/components/UI/AlertModal';

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  numQuestionsToServe: number;
  status: 'draft' | 'published' | 'archived';
  category: { displayName: string } | null;
  courseId?: string | null;
  courseName?: string | null;
  courseSlug?: string | null;
  curriculumNodeId?: string | null;
  createdAt: string;
  publishedAt: string | null;
  _count: { questions: number };
  attemptsCount: number;
  uniqueUsersCount?: number;
}

interface CourseItem {
  id: string;
  title: string;
  slug?: string;
  curriculumJson?: string;
}

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  }
  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, '...', current - 1, current, current + 1, '...', total];
}

export default function TeacherQuizzesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [courseFilter, setCourseFilter] = useState(searchParams.get('courseId') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [pdfQuizInfo, setPdfQuizInfo] = useState<{ quiz: Quiz, questions: any[] } | null>(null);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  
  // Link to Course modal state
  const [linkModalQuiz, setLinkModalQuiz] = useState<Quiz | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [courseModules, setCourseModules] = useState<Array<{ id: string; title: string }>>([]);
  const [linkingLoading, setLinkingLoading] = useState(false);

  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const limit = 20;

  // Alert & Confirm Modal States
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({ isOpen: false, message: '', type: 'info' });

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title?: string;
    message: React.ReactNode | string;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'info' | 'primary';
    isSubmitting?: boolean;
    onConfirm: () => void | Promise<void>;
  }>({ isOpen: false, message: '', onConfirm: () => {} });

  const showAlert = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', title?: string) => {
    setAlertConfig({ isOpen: true, message, type, title });
  };

  const showConfirm = (options: {
    title?: string;
    message: React.ReactNode | string;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'info' | 'primary';
    onConfirm: () => void | Promise<void>;
  }) => {
    setConfirmConfig({
      isOpen: true,
      title: options.title,
      message: options.message,
      confirmText: options.confirmText || 'Confirm',
      variant: options.variant || 'danger',
      isSubmitting: false,
      onConfirm: options.onConfirm,
    });
  };


  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const res = await fetch('/api/teacher/courses');
      if (res.ok) {
        const data = await res.json();
        setCourses(data.courses || []);
      }
    } catch (e) {
      console.error('Failed to fetch teacher courses', e);
    }
  };

  useEffect(() => {
    const pageParam = parseInt(searchParams.get('page') || '1');
    if (!isNaN(pageParam) && pageParam !== page) {
      setPage(pageParam);
    }
  }, [searchParams]);

  useEffect(() => {
    setActiveDropdownId(null);
    fetchQuizzes();
  }, [search, statusFilter, courseFilter, page]);

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveDropdownId(null);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  const fetchQuizzes = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      
      if (statusFilter) params.set('status', statusFilter);
      if (courseFilter) params.set('courseId', courseFilter);

      const res = await fetch(`/api/quiz?${params.toString()}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to load quizzes');
      
      setQuizzes(data.quizzes || []);
      setTotalCount(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('page', newPage.toString());
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleCourseTabChange = (cId: string) => {
    setCourseFilter(cId);
    setPage(1);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (cId) url.searchParams.set('courseId', cId);
      else url.searchParams.delete('courseId');
      url.searchParams.set('page', '1');
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setPage(1);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (val) url.searchParams.set('status', val);
      else url.searchParams.delete('status');
      url.searchParams.set('page', '1');
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (search) url.searchParams.set('search', search);
      else url.searchParams.delete('search');
      url.searchParams.set('page', '1');
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleOpenLinkModal = async (quiz: Quiz) => {
    setLinkModalQuiz(quiz);
    setSelectedCourseId(quiz.courseId || (courses[0]?.id || ''));
    setSelectedNodeId(quiz.curriculumNodeId || '');

    if (quiz.courseId) {
      await loadCourseModules(quiz.courseId);
    } else if (courses.length > 0) {
      await loadCourseModules(courses[0].id);
    }
  };

  const loadCourseModules = async (courseId: string) => {
    try {
      const res = await fetch(`/api/teacher/courses/${courseId}`);
      if (res.ok) {
        const data = await res.json();
        const modules: Array<{ id: string; title: string }> = [];
        const seenIds = new Set<string>();

        // 1. Prefer server-populated data.curriculum (which already resolves Media Vault folders and normalization)
        let tree: any[] = Array.isArray(data.curriculum) ? data.curriculum : [];

        // 2. Fallback to parsing data.course.curriculumJson if data.curriculum is empty
        if (tree.length === 0 && data.course?.curriculumJson) {
          try {
            const parsed = typeof data.course.curriculumJson === 'string'
              ? JSON.parse(data.course.curriculumJson)
              : data.course.curriculumJson;
            tree = Array.isArray(parsed) ? parsed : (parsed.modules || parsed.topics || parsed.curriculum || []);
          } catch {}
        }

        const extractFolders = (nodes: any[], prefix = '') => {
          if (!Array.isArray(nodes)) return;
          for (const n of nodes) {
            if (!n || !n.id) continue;

            const childrenList = Array.isArray(n.children) ? n.children :
                                 Array.isArray(n.subTopics) ? n.subTopics :
                                 Array.isArray(n.items) ? n.items : [];

            // A node is a folder/module if it's explicitly marked or contains sub-items or is a Media Vault folder
            const isContainer = n.type === 'folder' ||
                                n.type === 'module' ||
                                n.type === 'topic' ||
                                n.type === 'chapter' ||
                                n.type === 'section' ||
                                Boolean(n.mediaVaultFolderId) ||
                                childrenList.length > 0;

            const displayTitle = prefix ? `${prefix} > ${n.title || 'Untitled Module'}` : (n.title || 'Untitled Module');

            if (isContainer && !seenIds.has(n.id)) {
              seenIds.add(n.id);
              modules.push({ id: n.id, title: displayTitle });
            }

            if (childrenList.length > 0) {
              extractFolders(childrenList, displayTitle);
            }
          }
        };

        if (tree.length > 0) {
          extractFolders(tree);
        } else if (Array.isArray(data.groups) && data.groups.length > 0) {
          // 3. Fallback to release groups if curriculum tree was not found
          for (const g of data.groups) {
            const gid = g.nodeId || g.id;
            if (gid && !seenIds.has(gid)) {
              seenIds.add(gid);
              modules.push({ id: gid, title: g.title || g.mainTopicTitle || 'Module' });
            }
          }
        }

        // 4. Merge direct Media Vault module folders if available
        if (Array.isArray(data.mediaVaultFolders) && data.mediaVaultFolders.length > 0) {
          for (const mvf of data.mediaVaultFolders) {
            const mvTitle = String(mvf.title || '').trim();
            const lower = mvTitle.toLowerCase();
            if (lower !== 'all quizes' && lower !== 'all quizzes' && lower !== 'all resources') {
              if (!seenIds.has(mvf.id)) {
                seenIds.add(mvf.id);
                modules.push({ id: mvf.id, title: mvTitle });
              }
            }
          }
        }

        setCourseModules(modules);
        return;
      }
    } catch (err) {
      console.error('Error loading course modules:', err);
    }
    setCourseModules([]);
  };

  const handleSaveCourseLink = async () => {
    if (!linkModalQuiz || !selectedCourseId) return;
    setLinkingLoading(true);
    try {
      const res = await fetch(`/api/teacher/courses/${selectedCourseId}/quizzes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizIds: [linkModalQuiz.id],
          curriculumNodeId: selectedNodeId ? selectedNodeId : null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to link quiz to course');
      }
      setLinkModalQuiz(null);
      showAlert('Quiz placement saved successfully!', 'success');
      await fetchQuizzes();
    } catch (err: any) {
      showAlert(err.message || 'Failed to link quiz', 'error');
    } finally {
      setLinkingLoading(false);
    }
  };

  const handleUnlinkFromCourse = () => {
    if (!linkModalQuiz || !linkModalQuiz.courseId) return;
    showConfirm({
      title: 'Unlink Quiz from Course?',
      message: 'Are you sure you want to unlink this quiz from the course? The quiz will become unassigned.',
      confirmText: 'Unlink Quiz',
      variant: 'danger',
      onConfirm: async () => {
        setLinkingLoading(true);
        try {
          const res = await fetch(`/api/teacher/courses/${linkModalQuiz.courseId}/quizzes?quizId=${linkModalQuiz.id}`, {
            method: 'DELETE',
          });
          if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            throw new Error(d.error || 'Failed to unlink quiz');
          }
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          setLinkModalQuiz(null);
          showAlert('Quiz unlinked from course.', 'success');
          await fetchQuizzes();
        } catch (err: any) {
          showAlert(err.message || 'Failed to unlink quiz', 'error');
        } finally {
          setLinkingLoading(false);
        }
      }
    });
  };

  const handleDelete = (id: string, title?: string) => {
    showConfirm({
      title: 'Delete Quiz?',
      message: `Are you sure you want to delete "${title || 'this quiz'}"? This action cannot be undone.`,
      confirmText: 'Delete Quiz',
      variant: 'danger',
      onConfirm: async () => {
        setDeletingId(id);
        try {
          const res = await fetch(`/api/quiz/${id}`, { method: 'DELETE' });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Failed to delete');
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          setQuizzes(prev => prev.filter(q => q.id !== id));
          setTotalCount(prev => prev - 1);
          showAlert('Quiz deleted successfully.', 'success');
        } catch (err: any) {
          showAlert(err.message || 'Failed to delete quiz.', 'error');
        } finally {
          setDeletingId(null);
        }
      }
    });
  };

  const handleDuplicate = async (id: string) => {
    try {
      const res = await fetch(`/api/quiz/${id}/duplicate`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to duplicate');
      showAlert('Quiz duplicated successfully!', 'success');
      router.push(`/teacher/dashboard/quizzes/${data.quizId}/edit`);
    } catch (err: any) {
      showAlert(err.message || 'Failed to duplicate quiz.', 'error');
    }
  };

  const handleShareLink = (id: string) => {
    const url = `${window.location.origin}/dashboard/quizzes/${id}`;
    navigator.clipboard.writeText(url)
      .then(() => {
        showAlert('Share link copied to clipboard!', 'success');
      })
      .catch(err => {
        showAlert('Failed to copy share link.', 'error');
      });
  };

  const handlePublish = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'published' ? 'draft' : 'published';
    try {
      const res = await fetch(`/api/quiz/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update status');
      setQuizzes(prev => prev.map(q => q.id === id ? { ...q, status: newStatus, publishedAt: newStatus === 'published' ? new Date().toISOString() : null } : q));
      showAlert(`Quiz ${newStatus === 'published' ? 'published' : 'moved to draft'}.`, 'success');
    } catch (err: any) {
      showAlert(err.message || 'Failed to update status.', 'error');
    }
  };


  useEffect(() => {
    if (pdfQuizInfo && pdfContainerRef.current) {
      setTimeout(async () => {
        try {
          const { quiz } = pdfQuizInfo;
          const container = pdfContainerRef.current!;
          
          const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'px',
            format: 'a4'
          });
          
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const paddingX = 20;
          const usableWidth = pdfWidth - (paddingX * 2);
          let currentY = 20;
          
          const bodyBgStyle = window.getComputedStyle(document.body).backgroundColor;
          const rgbMatch = bodyBgStyle.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          const bgColor = rgbMatch ? [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])] : [255, 255, 255];
          
          pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
          
          const cards = container.querySelectorAll('.pdf-question-card');
          
          for (let i = 0; i < cards.length; i++) {
            const el = cards[i] as HTMLElement;
            const canvas = await html2canvas(el, {
              scale: 2,
              useCORS: true,
              logging: false,
              backgroundColor: bodyBgStyle,
              width: el.scrollWidth,
              windowWidth: document.documentElement.scrollWidth,
              scrollX: -window.scrollX,
              scrollY: -window.scrollY
            });
            
            const imgData = canvas.toDataURL('image/png');
            const imgHeight = (canvas.height * usableWidth) / canvas.width;
            
            if (currentY + imgHeight > pdfHeight - 20 && currentY > 20) {
              pdf.addPage();
              pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
              pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
              currentY = 20;
            }
            
            pdf.addImage(imgData, 'PNG', paddingX, currentY, usableWidth, imgHeight);
            currentY += imgHeight + 15;
          }
          
          const safeTitle = quiz.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          pdf.save(`quiz_${safeTitle}_questions.pdf`);
          showAlert('Quiz PDF downloaded successfully!', 'success');
        } catch (err: any) {
          console.error('PDF generation failed:', err);
          showAlert('Failed to generate PDF. Please try again.', 'error');
        } finally {
          setPdfQuizInfo(null);
          setGeneratingPdfId(null);
        }
      }, 500); // Allow DOM to paint
    }
  }, [pdfQuizInfo]);

  const handleDownloadPDF = async (quiz: Quiz) => {
    try {
      setGeneratingPdfId(quiz.id);
      const res = await fetch(`/api/quiz/${quiz.id}/questions`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch questions');
      
      setPdfQuizInfo({ quiz, questions: data.questions });
    } catch (err: any) {
      showAlert('Error generating PDF: ' + err.message, 'error');
      setGeneratingPdfId(null);
    }
  };


  const formatDuration = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins} mins` : `${hours}h`;
    }
    return `${minutes} mins`;
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { class: string; label: string; icon: React.ReactNode }> = {
      draft: { class: styles.draft, label: 'Draft', icon: <FileText className={styles.badgeIcon} /> },
      published: { class: styles.published, label: 'Published', icon: <CheckCircle className={styles.badgeIcon} /> },
      archived: { class: styles.archived, label: 'Archived', icon: <Clock className={styles.badgeIcon} /> },
    };
    const config = configs[status] || configs.draft;
    return (
      <span className={`${styles.statusBadge} ${config.class}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading quizzes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.topBarRow}>
        {courses.length > 0 ? (
          <div className={styles.courseTabs}>
            <button
              type="button"
              onClick={() => handleCourseTabChange('')}
              className={`${styles.courseTab} ${!courseFilter ? styles.courseTabActive : ''}`}
            >
              <BookOpen size={14} /> All Courses
            </button>
            {courses.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleCourseTabChange(c.id)}
                className={`${styles.courseTab} ${courseFilter === c.id ? styles.courseTabActive : ''}`}
              >
                <BookOpen size={14} /> {c.title}
              </button>
            ))}
          </div>
        ) : <div />}

        <Link href="/teacher/dashboard/quizzes/create" className={styles.createBtn}>
          <Plus className={styles.btnIcon} />
          Create New Quiz
        </Link>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.toolbar}>
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <label htmlFor="search" className={styles.visuallyHidden}>Search quizzes</label>
          <div className={styles.searchInputWrapper}>
            <Search className={styles.searchIcon} />
            <input
              id="search"
              type="search"
              placeholder="Search by title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </form>

        <div className={styles.filters}>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <div className={styles.quizzesList}>
        {quizzes.length === 0 ? (
          <div className={styles.emptyState}>
            <FileText className={styles.emptyIcon} />
            <h3>No quizzes found</h3>
            <p>{search || statusFilter || courseFilter ? 'Try adjusting your search or filters' : 'Create your first quiz to get started'}</p>
            {!search && !statusFilter && (
              <Link href="/teacher/dashboard/quizzes/create" className={styles.createBtn}>
                <Plus className={styles.btnIcon} />
                Create Quiz
              </Link>
            )}
          </div>
        ) : (
          quizzes.map((quiz) => (
            <div key={quiz.id} className={styles.quizCardItem}>
              <div className={styles.cardHeaderRow}>
                <div className={styles.quizTitleCol}>
                  <Link href={`/teacher/dashboard/quizzes/${quiz.id}/edit`} className={styles.quizTitle}>
                    {quiz.title}
                  </Link>
                  {quiz.description && (
                    <p className={styles.quizDesc}>{quiz.description}</p>
                  )}
                </div>
                <div className={styles.badgeGroup}>
                  {getStatusBadge(quiz.status)}
                  {quiz.courseName ? (
                    <span className={styles.courseTag}>
                      <BookOpen size={12} /> {quiz.courseName} {quiz.curriculumNodeId ? '• Module Quiz' : ''}
                    </span>
                  ) : (
                    <span className={styles.unlinkedTag}>Unlinked</span>
                  )}
                </div>
              </div>

              <div className={styles.quizMetricsRow}>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Questions</span>
                  <span className={styles.metricValue}>
                    {quiz._count.questions} total ({quiz.numQuestionsToServe} served)
                  </span>
                </div>

                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Duration</span>
                  <span className={styles.metricValue}>
                    {quiz.durationMinutes} mins
                  </span>
                </div>

                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Attempts</span>
                  <span className={styles.metricValue}>
                    {quiz.attemptsCount} attempts ({quiz.uniqueUsersCount || 0} students)
                  </span>
                </div>

                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Created</span>
                  <span className={styles.metricValue}>
                    {new Date(quiz.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className={styles.cardActionsRow}>
                <button
                  onClick={() => handleOpenLinkModal(quiz)}
                  className={`${styles.actionBtn} ${quiz.courseId ? styles.placedActionBtn : ''}`}
                  title={quiz.courseId ? "Change Course Placement" : "Link to Course"}
                >
                  <BookOpen size={15} /> <span>Placement</span>
                </button>
                <Link
                  href={`/teacher/dashboard/quizzes/${quiz.id}/edit`}
                  className={styles.actionBtn}
                  title="Edit Quiz"
                >
                  <Edit size={15} /> <span>Edit</span>
                </Link>
                <Link
                  href={`/teacher/dashboard/quizzes/${quiz.id}/results`}
                  className={styles.actionBtn}
                  title="View Results"
                >
                  <BarChart2 size={15} /> <span>Results</span>
                </Link>
                <button
                  onClick={() => handleDownloadPDF(quiz)}
                  disabled={generatingPdfId === quiz.id}
                  className={styles.actionBtn}
                  title="Download Questions & Answers (PDF)"
                >
                  {generatingPdfId === quiz.id ? (
                    <Loader2 size={15} className={styles.spinnerIcon} />
                  ) : (
                    <Download size={15} />
                  )}
                  <span>{generatingPdfId === quiz.id ? "PDF..." : "PDF"}</span>
                </button>
                <Link
                  href={`/dashboard/quizzes/${quiz.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.actionBtn}
                  title="Preview as Student"
                >
                  <ExternalLink size={15} /> <span>Preview</span>
                </Link>
                <button
                  onClick={() => handleShareLink(quiz.id)}
                  className={styles.actionBtn}
                  title="Share Link"
                >
                  <LinkIcon size={15} /> <span>Share</span>
                </button>
                <button
                  onClick={() => handleDuplicate(quiz.id)}
                  className={styles.actionBtn}
                  title="Duplicate Quiz"
                >
                  <Copy size={15} /> <span>Duplicate</span>
                </button>
                <button
                  onClick={() => handlePublish(quiz.id, quiz.status)}
                  className={styles.actionBtn}
                  title={quiz.status === 'published' ? 'Unpublish Quiz' : 'Publish Quiz'}
                >
                  {quiz.status === 'published' ? (
                    <CheckCircle size={15} style={{ color: 'var(--success-text)' }} />
                  ) : (
                    <FileText size={15} />
                  )}
                  <span>{quiz.status === 'published' ? 'Unpublish' : 'Publish'}</span>
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(quiz.id)}
                  className={`${styles.actionBtn} ${styles.dangerActionBtn}`}
                  title="Delete Quiz"
                >
                  <Trash2 size={15} /> <span>Delete</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {totalCount > 0 && (
        <div className={styles.pagination}>
          <div className={styles.paginationInfo}>
            Showing <span className={styles.highlightText}>{((page - 1) * limit) + 1}</span>–<span className={styles.highlightText}>{Math.min(page * limit, totalCount)}</span> of <span className={styles.highlightText}>{totalCount}</span> quizzes
          </div>
          
          {totalPages > 1 && (
            <div className={styles.paginationControls}>
              <button
                onClick={() => handlePageChange(1)}
                disabled={page === 1}
                className={styles.pageIconBtn}
                title="First Page"
                aria-label="First Page"
              >
                <ChevronsLeft size={16} />
              </button>
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className={styles.pageIconBtn}
                title="Previous Page"
                aria-label="Previous Page"
              >
                <ChevronLeft size={16} />
              </button>

              <div className={styles.pageNumbers}>
                {getPageNumbers(page, totalPages).map((p, idx) => {
                  if (p === '...') {
                    return <span key={`ellipsis-${idx}`} className={styles.pageEllipsis}>...</span>;
                  }
                  const pageNum = Number(p);
                  return (
                    <button
                      key={`page-${pageNum}`}
                      onClick={() => handlePageChange(pageNum)}
                      className={`${styles.pageNumberBtn} ${page === pageNum ? styles.pageNumberActive : ''}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className={styles.pageIconBtn}
                title="Next Page"
                aria-label="Next Page"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={page === totalPages}
                className={styles.pageIconBtn}
                title="Last Page"
                aria-label="Last Page"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Link to Course Modal */}
      {linkModalQuiz && (
        <div className={styles.modalOverlay} onClick={() => setLinkModalQuiz(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Course Placement</h3>
              <button
                type="button"
                onClick={() => setLinkModalQuiz(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Assign <strong>{linkModalQuiz.title}</strong> to a course. A quiz can only belong to one course.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                  Target Course
                </label>
                <select
                  value={selectedCourseId}
                  onChange={async (e) => {
                    const cid = e.target.value;
                    setSelectedCourseId(cid);
                    setSelectedNodeId('');
                    if (cid) await loadCourseModules(cid);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                  }}
                >
                  <option value="">-- Select Course --</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              {selectedCourseId && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                    Folder Placement
                  </label>
                  <select
                    value={selectedNodeId}
                    onChange={(e) => setSelectedNodeId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--card-bg)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                    }}
                  >
                    <option value="">📁 All Quizzes (Always Available)</option>
                    {courseModules.map(m => (
                      <option key={m.id} value={m.id}>📁 {m.title} (Unlocks with Module)</option>
                    ))}
                  </select>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Quizzes in "All Quizzes" are immediately available. Quizzes attached to a module unlock when that module becomes available.
                  </p>
                </div>
              )}
            </div>

            <div className={styles.placementModalActions}>
              {linkModalQuiz.courseId ? (
                <button
                  type="button"
                  onClick={handleUnlinkFromCourse}
                  disabled={linkingLoading}
                  className={styles.unlinkModalBtn}
                >
                  Unlink Quiz
                </button>
              ) : null}
              <div className={styles.placementModalBtns}>
                <button
                  type="button"
                  onClick={() => setLinkModalQuiz(null)}
                  className={styles.placementCancelBtn}
                  disabled={linkingLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCourseLink}
                  disabled={linkingLoading || !selectedCourseId}
                  className={styles.placementSaveBtn}
                >
                  {linkingLoading ? 'Saving...' : 'Save Placement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(null)}>
          <div className={`${styles.modal} ${styles.deleteModal}`} onClick={e => e.stopPropagation()}>
            <h3>Delete Quiz?</h3>
            <p>This action cannot be undone. All questions, attempts, and results will be permanently deleted.</p>
            <div className={styles.modalActions}>
              <button onClick={() => setShowDeleteConfirm(null)} className={styles.modalCancel}>
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={deletingId === showDeleteConfirm}
                className={`${styles.modalConfirm} ${styles.danger}`}
              >
                {deletingId === showDeleteConfirm ? 'Deleting...' : 'Delete Quiz'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden container for PDF rendering */}
      <div 
        ref={pdfContainerRef} 
        style={{ 
          position: 'absolute', 
          top: '-9999px', 
          left: '-9999px', 
          width: '800px',
          opacity: 0,
          pointerEvents: 'none'
        }}
      >
        {pdfQuizInfo && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
            <div style={{ background: 'var(--primary)', color: 'white', padding: '20px', borderRadius: '12px' }} className="pdf-question-card">
              <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>Quiz: {pdfQuizInfo.quiz.title}</h2>
              {pdfQuizInfo.quiz.description && <p style={{ opacity: 0.9 }}>{pdfQuizInfo.quiz.description}</p>}
            </div>
            {pdfQuizInfo.questions.map((question, index) => (
              <article key={question.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }} className="pdf-question-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 'bold' }}>Q{index + 1}.</span>
                  <h3 style={{ fontSize: '18px', fontWeight: '600' }}>{question.questionText}</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginLeft: '32px' }}>
                  {(question.questionType === 'true_false' || question.questionType === 'mcq') ? (
                    [
                      { letter: 'A', text: question.optionA },
                      { letter: 'B', text: question.optionB },
                      { letter: 'C', text: question.optionC },
                      { letter: 'D', text: question.optionD },
                      { letter: 'E', text: question.optionE },
                    ].map((option: any) => {
                      const correctStr = question.correctOption || 'F'.repeat(5);
                      const originalIdx = option.letter.charCodeAt(0) - 65;
                      const isCorrectT = correctStr[originalIdx] === 'T';
                      const isCorrectF = correctStr[originalIdx] === 'F';
                      
                      return (
                        <div key={`${question.id}-${option.letter}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '15px' }}><strong style={{ marginRight: '8px' }}>{option.letter}.</strong> {option.text}</span>
                          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '54px', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: isCorrectT ? 'var(--success, #10b981)' : 'var(--surface-soft, rgba(255,255,255,0.06))', color: isCorrectT ? 'white' : 'var(--text-muted, #888)' }}>
                              True
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '54px', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: isCorrectF ? 'var(--success, #10b981)' : 'var(--surface-soft, rgba(255,255,255,0.06))', color: isCorrectF ? 'white' : 'var(--text-muted, #888)' }}>
                              False
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    [
                      { letter: 'A', text: question.optionA },
                      { letter: 'B', text: question.optionB },
                      { letter: 'C', text: question.optionC },
                      { letter: 'D', text: question.optionD },
                      { letter: 'E', text: question.optionE },
                    ].filter(o => o.text !== null && o.text !== undefined && String(o.text).trim() !== '').map((option: any) => {
                      const isCorrect = question.correctOption === option.letter;
                      return (
                        <div key={`${question.id}-${option.letter}`} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', borderRadius: '8px', border: isCorrect ? '2px solid var(--success)' : '1px solid var(--border)', background: isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'transparent' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', background: isCorrect ? 'var(--success)' : 'var(--surface-soft)', color: isCorrect ? 'white' : 'var(--text-muted)' }}>
                            <Check size={16} />
                          </div>
                          <span style={{ fontSize: '16px', fontWeight: isCorrect ? 600 : 400 }}><strong style={{ marginRight: '8px' }}>{option.letter}.</strong> {option.text}</span>
                        </div>
                      );
                    })
                  )}
                </div>
                {question.explanation && (
                  <div style={{ marginTop: '24px', padding: '16px', background: 'var(--surface-soft)', borderRadius: '8px', borderLeft: '4px solid var(--info)' }}>
                    <h4 style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--info)' }}>Explanation</h4>
                    <p style={{ fontSize: '15px', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{question.explanation}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Reusable Confirm Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        variant={confirmConfig.variant}
        isSubmitting={confirmConfig.isSubmitting}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}