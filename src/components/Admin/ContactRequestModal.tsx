"use client";

import { useEffect, useState } from 'react';
import Loader from "@/components/UI/Loader";
import { AlertCircle, ArrowRight, CheckCircle2, Send, X, Mail, Phone, Clock, ExternalLink } from 'lucide-react';
import styles from './ContactRequestsManager.module.css';
import { useModal } from '@/hooks/useModal';
import { formatDateTimeGMT6 } from '@/lib/date-format';

export type ContactIssueType = 'query' | 'technical_assistance' | 'billing' | 'course_access' | 'other';
export type ContactStatus = 'open' | 'in_review' | 'responded' | 'closed';

export type ContactSubmission = {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  issueType: ContactIssueType;
  subject: string;
  message: string;
  imageUrls?: string[] | null;
  status: ContactStatus;
  adminReply?: string | null;
  adminReplySentAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_OPTIONS: Array<{ value: ContactStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'in_review', label: 'In Review' },
  { value: 'responded', label: 'Responded' },
  { value: 'closed', label: 'Closed' },
];

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
            <div className={styles.kicker}>Contact Request Details</div>
            <h2 className={styles.modalTitle}>{submission.fullName}</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Metadata Bar */}
          <div className={styles.detailCard}>
            <div className={styles.detailRow}>
              <div className={styles.detailCol}>
                <span className={styles.detailLabel}>Email Address</span>
                <a href={`mailto:${submission.email}`} className={styles.detailValueLink}>
                  <Mail size={14} /> {submission.email}
                </a>
              </div>

              <div className={styles.detailCol}>
                <span className={styles.detailLabel}>Phone Number</span>
                {submission.phone ? (
                  <a href={`tel:${submission.phone}`} className={styles.detailValueLink}>
                    <Phone size={14} /> {submission.phone}
                  </a>
                ) : (
                  <span className={styles.detailValueMuted}>Not provided</span>
                )}
              </div>

              <div className={styles.detailCol}>
                <span className={styles.detailLabel}>Submitted At</span>
                <span className={styles.detailValue}>
                  <Clock size={14} /> {formatDateTimeGMT6(submission.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* User Message */}
          <div className={styles.messageSection}>
            <span className={styles.sectionHeading}>Message / Complain</span>
            <div className={styles.messageBox}>
              <p>{submission.message}</p>
            </div>
          </div>

          {/* Attached Images */}
          {submission.imageUrls && submission.imageUrls.length > 0 && (
            <div className={styles.attachmentsSection}>
              <span className={styles.sectionHeading}>
                Attached Images ({submission.imageUrls.length})
              </span>
              <div className={styles.attachmentGrid}>
                {submission.imageUrls.map((url, idx) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.attachmentCard}
                    title="Click to view full image"
                  >
                    <img src={url} alt={`Attachment ${idx + 1}`} />
                    <span className={styles.attachmentOverlay}>
                      <ExternalLink size={14} /> Open
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Status & Reply Form */}
          <div className={styles.replySection}>
            <div className={styles.statusRow}>
              <label className={styles.statusLabel}>
                <span>Current Status</span>
                <select
                  value={statusDraft}
                  onChange={(e) => setStatusDraft(e.target.value as ContactStatus)}
                  className={styles.statusSelect}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              {submission.adminReplySentAt && (
                <div className={styles.replyHistoryTag}>
                  <CheckCircle2 size={14} />
                  <span>Last replied {formatDateTimeGMT6(submission.adminReplySentAt)}</span>
                </div>
              )}
            </div>

            <label className={styles.replyLabel}>
              <span>Reply to User (Emails user & CCs support@creativebydrshakil.com)</span>
              <textarea
                rows={5}
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                placeholder="Type your official response to the user here..."
                className={styles.replyTextarea}
              />
            </label>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.ghostBtn} onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button className={styles.primaryBtn} onClick={handleUpdate} disabled={isSaving}>
            {isSaving ? <Loader variant="button" /> : <Send size={16} />}
            <span>{replyDraft.trim() ? 'Send Response & Email' : 'Save Status'}</span>
            {!isSaving && <ArrowRight size={16} />}
          </button>
        </div>
      </div>
    </>
  );
}
