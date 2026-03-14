"use client";

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './ContactRequestsManager.module.css';
import { AlertCircle, Inbox, Loader2, RefreshCw, ArrowRight, CheckCircle2, Send } from 'lucide-react';
import ContactRequestModal from './ContactRequestModal';

type ContactIssueType = 'query' | 'technical_assistance' | 'billing' | 'course_access' | 'other';
type ContactStatus = 'open' | 'in_review' | 'responded' | 'closed';

type ContactSubmission = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  issueType: ContactIssueType;
  subject: string;
  message: string;
  imageUrls: string[];
  status: ContactStatus;
  adminReply?: string | null;
  adminReplySentAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_OPTIONS: Array<{ value: ContactStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'in_review', label: 'In review' },
  { value: 'responded', label: 'Responded' },
  { value: 'closed', label: 'Closed' },
];

const ISSUE_LABELS: Record<ContactIssueType, string> = {
  query: 'Query',
  technical_assistance: 'Technical assistance',
  billing: 'Billing',
  course_access: 'Course access',
  other: 'Other',
};

export default function ContactRequestsManager() {
  const { session } = useAuth();
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | ContactStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState<ContactStatus>('open');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const token = session?.access_token;

  const fetchSubmissions = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/contact-submissions', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load contact submissions.');
      }

      const normalized = Array.isArray(data?.submissions) ? data.submissions : [];
      setSubmissions(normalized);

      if (!selectedId && normalized.length > 0) {
        setSelectedId(normalized[0].id);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to load contact submissions.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchSubmissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const visibleSubmissions = useMemo(() => {
    return submissions.filter((submission) => statusFilter === 'all' || submission.status === statusFilter);
  }, [submissions, statusFilter]);

  const selectedSubmission = useMemo(
    () => submissions.find((submission) => submission.id === selectedId) || null,
    [submissions, selectedId]
  );

  useEffect(() => {
    if (selectedSubmission) {
      setSelectedId(selectedSubmission.id);
      setReplyDraft(selectedSubmission.adminReply || '');
      setStatusDraft(selectedSubmission.status);
    }
  }, [selectedSubmission?.id]);

  const updateSubmission = async (status?: ContactStatus, reply?: string) => {
    if (!selectedSubmission) return;

    setSaving(true);
    setMessage(null);

    // Use provided values or current drafts
    const finalStatus = status !== undefined ? status : statusDraft;
    const finalReply = reply !== undefined ? reply : replyDraft;

    try {
      const response = await fetch(`/api/admin/contact-submissions/${selectedSubmission.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          status: finalStatus,
          adminReply: finalReply.trim() || undefined,
          sendReplyEmail: Boolean(finalReply.trim()),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to save response.');
      }

      setMessage({ type: 'success', text: 'Contact request updated successfully.' });
      setSubmissions((current) =>
        current.map((submission) =>
          submission.id === selectedSubmission.id
            ? {
                ...submission,
                ...data.submission,
                imageUrls: Array.isArray(data?.submission?.imageUrls) ? data.submission.imageUrls : submission.imageUrls,
              }
            : submission
        )
      );
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to save response.' });
    } finally {
      setSaving(false);
    }
  };

  const counts = useMemo(() => {
    return submissions.reduce<Record<ContactStatus, number>>(
      (accumulator, submission) => {
        accumulator[submission.status] += 1;
        return accumulator;
      },
      { open: 0, in_review: 0, responded: 0, closed: 0 }
    );
  }, [submissions]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerRow}>
        <div>
          <p className={styles.kicker}>Support inbox</p>
          <h2>Contact requests</h2>
        </div>
        <div className={styles.headerActions}>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button className={styles.ghostBtn} onClick={fetchSubmissions} disabled={loading}>
            {loading ? <Loader2 size={16} className={styles.spin} /> : <RefreshCw size={16} />}
            Refresh
          </button>
        </div>
      </div>

      <div className={styles.countRow}>
        <span>Open {counts.open}</span>
        <span>In review {counts.in_review}</span>
        <span>Responded {counts.responded}</span>
        <span>Closed {counts.closed}</span>
      </div>

      {message && <div className={`${styles.alert} ${styles[message.type]}`}>{message.text}</div>}

      <div className={styles.layout}>
        <div className={styles.listPane}>
          {loading ? (
            <div className={styles.emptyState}>
              <Loader2 size={18} className={styles.spin} /> Loading contact requests...
            </div>
          ) : visibleSubmissions.length === 0 ? (
            <div className={styles.emptyState}>
              <Inbox size={18} /> No contact requests found.
            </div>
          ) : (
            visibleSubmissions.map((submission) => {
              const isSelected = submission.id === selectedSubmission?.id;
              return (
                <button
                  key={submission.id}
                  className={`${styles.listItem} ${isSelected ? styles.listItemActive : ''}`}
                  onClick={() => {
                    setSelectedId(submission.id);
                    setShowModal(true);
                  }}
                >
                  <div className={styles.listItemTop}>
                    <strong>{submission.fullName}</strong>
                    <span className={`${styles.statusBadge} ${styles[`status-${submission.status}`]}`}>
                      {STATUS_OPTIONS.find((option) => option.value === submission.status)?.label || submission.status}
                    </span>
                  </div>
                  <p>{submission.subject}</p>
                  <div className={styles.listMeta}>
                    <span>{ISSUE_LABELS[submission.issueType]}</span>
                    <span>{new Date(submission.createdAt).toLocaleString('en-GB')}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className={styles.detailPane}>
          {!selectedSubmission ? (
            <div className={styles.emptyDetail}>
              <AlertCircle size={18} />
              Select a request to view details.
            </div>
          ) : (
            <>
              <div className={styles.detailHeader}>
                <div>
                  <p className={styles.kicker}>Request details</p>
                  <h3>{selectedSubmission.subject}</h3>
                </div>
                <span className={`${styles.statusBadge} ${styles[`status-${selectedSubmission.status}`]}`}>
                  {STATUS_OPTIONS.find((option) => option.value === selectedSubmission.status)?.label || selectedSubmission.status}
                </span>
              </div>

              <div className={styles.detailGrid}>
                <div><span>Full name</span><strong>{selectedSubmission.fullName}</strong></div>
                <div><span>Email</span><strong>{selectedSubmission.email}</strong></div>
                <div><span>Phone</span><strong>{selectedSubmission.phone}</strong></div>
                <div><span>Issue</span><strong>{ISSUE_LABELS[selectedSubmission.issueType]}</strong></div>
              </div>

              <div className={styles.messageBlock}>
                <span>Message</span>
                <p>{selectedSubmission.message}</p>
              </div>

              {selectedSubmission.imageUrls.length > 0 && (
                <div className={styles.imageGrid}>
                  {selectedSubmission.imageUrls.map((imageUrl) => (
                    <a key={imageUrl} href={imageUrl} target="_blank" rel="noreferrer" className={styles.imageCard}>
                      <img src={imageUrl} alt="Contact attachment" />
                    </a>
                  ))}
                </div>
              )}

              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Status</span>
                  <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value as ContactStatus)}>
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={`${styles.field} ${styles.fullWidth}`}>
                  <span>Reply</span>
                  <textarea
                    rows={7}
                    value={replyDraft}
                    onChange={(event) => setReplyDraft(event.target.value)}
                    placeholder="Write the response that will be emailed to the requester."
                  />
                </label>
              </div>

              <div className={styles.detailActions}>
                <button className={styles.ghostBtn} onClick={() => setReplyDraft(selectedSubmission.adminReply || '')} type="button">
                  Reset
                </button>
                <button className={styles.primaryBtn} onClick={() => updateSubmission(statusDraft, replyDraft)} disabled={saving} type="button">
                  {saving ? <Loader2 size={16} className={styles.spin} /> : <Send size={16} />}
                  {replyDraft.trim() ? 'Send reply' : 'Save status'}
                  {!saving ? <ArrowRight size={16} /> : null}
                </button>
              </div>

              {selectedSubmission.adminReplySentAt && (
                <div className={styles.replyMeta}>
                  <CheckCircle2 size={16} />
                  Last replied at {new Date(selectedSubmission.adminReplySentAt).toLocaleString('en-GB')}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ContactRequestModal
        submission={selectedSubmission}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onUpdate={updateSubmission}
        isSaving={saving}
        token={token}
      />
    </div>
  );
}