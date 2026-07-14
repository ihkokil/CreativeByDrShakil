'use client';

import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import styles from './TeacherQuizzesPage.module.css';

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  numQuestionsToServe: number;
  status: 'draft' | 'published' | 'archived';
  category: { displayName: string } | null;
  createdAt: string;
  publishedAt: string | null;
  _count: { questions: number };
  attemptsCount: number;
}

export default function TeacherQuizzesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const limit = 10;

  useEffect(() => {
    setActiveDropdownId(null);
    fetchQuizzes();
  }, [search, statusFilter, page]);

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    if (search) params.set('search', search);
    else params.delete('search');
    router.push(`/teacher/dashboard/quizzes?${params.toString()}`);
  };

  const handleStatusChange = (status: string) => {
    setPage(1);
    setStatusFilter(status);
    const params = new URLSearchParams(searchParams.toString());
    if (status) params.set('status', status);
    else params.delete('status');
    router.push(`/teacher/dashboard/quizzes?${params.toString()}`);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/quiz/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      setQuizzes(prev => prev.filter(q => q.id !== id));
      setTotalCount(prev => prev - 1);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeletingId(null);
      setShowDeleteConfirm(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const res = await fetch(`/api/quiz/${id}/duplicate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to duplicate');
      router.push(`/teacher/dashboard/quizzes/${data.quiz.id}/edit`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleShareLink = (id: string) => {
    const url = `${window.location.origin}/dashboard/quizzes/${id}`;
    navigator.clipboard.writeText(url)
      .then(() => {
        alert('Share link copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy link:', err);
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');
      setQuizzes(prev => prev.map(q => q.id === id ? { ...q, status: newStatus, publishedAt: newStatus === 'published' ? new Date().toISOString() : null } : q));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
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
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Quiz Management</h1>
          <p className={styles.subtitle}>Create, manage, and analyze your quizzes</p>
        </div>
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

      <div className={styles.tableContainer}>
        {quizzes.length === 0 ? (
          <div className={styles.emptyState}>
            <FileText className={styles.emptyIcon} />
            <h3>No quizzes found</h3>
            <p>{search || statusFilter ? 'Try adjusting your search or filters' : 'Create your first quiz to get started'}</p>
            {!search && !statusFilter && (
              <Link href="/teacher/dashboard/quizzes/create" className={styles.createBtn}>
                <Plus className={styles.btnIcon} />
                Create Quiz
              </Link>
            )}
          </div>
        ) : (
          <>
            <table className={styles.table} role="grid">
              <thead>
                <tr>
                  <th scope="col">Quiz</th>
                  <th scope="col">Questions</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Attempts</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                  <th scope="col"><span className={styles.visuallyHidden}>Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {quizzes.map((quiz) => (
                  <tr key={quiz.id}>
                    <td>
                      <div className={styles.quizInfo}>
                        <Link href={`/teacher/dashboard/quizzes/${quiz.id}/edit`} className={styles.quizTitle}>
                          {quiz.title}
                        </Link>
                        {quiz.description && (
                          <p className={styles.quizDesc}>{quiz.description}</p>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={styles.questionCount}>
                        {quiz._count.questions} / {quiz.numQuestionsToServe} served
                      </span>
                    </td>
                    <td>{formatDuration(quiz.durationMinutes)}</td>
                    <td>
                      <span className={styles.attemptsCount}>{quiz.attemptsCount}</span>
                    </td>
                    <td>{getStatusBadge(quiz.status)}</td>
                    <td className={styles.dateCell}>
                      {new Date(quiz.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <Link
                          href={`/teacher/dashboard/quizzes/${quiz.id}/edit`}
                          className={styles.rowActionBtn}
                          title="Edit Quiz"
                        >
                          <Edit className={styles.rowActionIcon} />
                        </Link>
                        <Link
                          href={`/teacher/dashboard/quizzes/${quiz.id}/results`}
                          className={styles.rowActionBtn}
                          title="View Results"
                        >
                          <BarChart2 className={styles.rowActionIcon} />
                        </Link>
                        <Link
                          href={`/dashboard/quizzes/${quiz.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.rowActionBtn}
                          title="Preview as Student"
                        >
                          <ExternalLink className={styles.rowActionIcon} />
                        </Link>
                        <button
                          onClick={() => handleShareLink(quiz.id)}
                          className={styles.rowActionBtn}
                          title="Share Link"
                        >
                          <LinkIcon className={styles.rowActionIcon} />
                        </button>
                        <button
                          onClick={() => handleDuplicate(quiz.id)}
                          className={styles.rowActionBtn}
                          title="Duplicate Quiz"
                        >
                          <Copy className={styles.rowActionIcon} />
                        </button>
                        <button
                          onClick={() => handlePublish(quiz.id, quiz.status)}
                          className={styles.rowActionBtn}
                          title={quiz.status === 'published' ? 'Unpublish Quiz' : 'Publish Quiz'}
                        >
                          {quiz.status === 'published' ? (
                            <CheckCircle className={styles.rowActionIcon} style={{ color: 'var(--success-text)' }} />
                          ) : (
                            <FileText className={styles.rowActionIcon} />
                          )}
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(quiz.id)}
                          className={`${styles.rowActionBtn} ${styles.danger}`}
                          title="Delete Quiz"
                        >
                          <Trash2 className={styles.rowActionIcon} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={styles.pageBtn}
                >
                  Previous
                </button>
                <span className={styles.pageInfo}>
                  Page {page} of {totalPages} ({totalCount} total)
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className={styles.pageBtn}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showDeleteConfirm && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
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
    </div>
  );
}