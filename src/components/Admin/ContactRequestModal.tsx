"use client";

import { useEffect, useState } from 'react';
import Loader from "@/components/UI/Loader";
import { AlertCircle, ArrowRight, CheckCircle2, Send, X } from 'lucide-react';
import styles from './ContactRequestsManager.module.css';
import { useModal } from '@/hooks/useModal';

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

interface ContactRequestModalProps {
  submission: ContactSubmission | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (status: ContactStatus, reply: string) => Promise<void>;
  isSaving: boolean;
  token?: string;
}

export default function ContactRequestModal({
  submission,
  isOpen,
  onClose,
  onUpdate,
  isSaving,
}: ContactRequestModalProps) {
  useModal(isOpen, onClose);
  const [statusDraft, setStatusDraft] = useState<ContactStatus>('open');
  const [replyDraft, setReplyDraft] = useState('');

  useEffect(() => {
    if (submission) {
      setStatusDraft(submission.status);
      setReplyDraft(submission.adminReply || '');
    }
  }, [submission?.id]);

  if (!isOpen || !submission) {
    return null;
  }

  const handleUpdate = async () => {
    await onUpdate(statusDraft, replyDraft);
  };

  return (
    <>
      {/* Backdrop */}
      <div className={styles.modalBackdrop} onClick={onClose} />
      
      {/* Modal */}
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div>
            <h2>{submission.subject}</h2>
            <p className={styles.kicker}>{submission.fullName}</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalContent}>
          <div className={styles.detailGrid}>
            <div><span>Email</span><strong>{submission.email}</strong></div>
            <div><span>Phone</span><strong>{submission.phone}</strong></div>
            <div><span>Issue type</span><strong>{ISSUE_LABELS[submission.issueType]}</strong></div>
            <div><span>Status</span><strong>{STATUS_OPTIONS.find(o => o.value === submission.status)?.label}</strong></div>
          </div>

          <div className={styles.messageBlock}>
            <span>Message</span>
            <p>{submission.message}</p>
          </div>

          {submission.imageUrls.length > 0 && (
            <div className={styles.imageGrid}>
              {submission.imageUrls.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className={styles.imageCard}>
                  <img src={url} alt="Attachment" />
                </a>
              ))}
            </div>
          )}

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Update status</span>
              <select value={statusDraft} onChange={(e) => setStatusDraft(e.target.value as ContactStatus)}>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>

            <label className={`${styles.field} ${styles.fullWidth}`}>
              <span>Reply to requester</span>
              <textarea
                rows={6}
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                placeholder="Type your response (will be emailed to the requester)"
              />
            </label>
          </div>

          {submission.adminReplySentAt && (
            <div className={styles.replyMeta}>
              <CheckCircle2 size={14} />
              Last replied {new Date(submission.adminReplySentAt).toLocaleString('en-GB')}
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.ghostBtn} onClick={onClose} disabled={isSaving}>
            Close
          </button>
          <button className={styles.primaryBtn} onClick={handleUpdate} disabled={isSaving}>
            {isSaving ? <Loader variant="button" /> : <Send size={16} />}
            {replyDraft.trim() ? 'Send reply' : 'Save status'}
            {!isSaving ? <ArrowRight size={16} /> : null}
          </button>
        </div>
      </div>
    </>
  );
}
