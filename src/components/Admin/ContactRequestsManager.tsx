"use client";

import { useEffect, useMemo, useState } from 'react';
import Loader from "@/components/UI/Loader";
import { useAuth } from '@/context/AuthContext';
import styles from './ContactRequestsManager.module.css';
import {
  Inbox,
  RefreshCw,
  Search,
  Mail,
  Phone,
  Clock,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  AlertCircle,
  Eye,
} from 'lucide-react';
import ContactRequestModal from './ContactRequestModal';
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

const STATUS_FILTERS: Array<{ value: 'all' | ContactStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_review', label: 'In Review' },
  { value: 'responded', label: 'Responded' },
  { value: 'closed', label: 'Closed' },
];

export default function ContactRequestsManager() {
  const { session } = useAuth();
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | ContactStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<ContactSubmission | null>(null);
  const [showModal, setShowModal] = useState(false);
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
  }, [token]);

  const counts = useMemo(() => {
    return submissions.reduce<Record<string, number>>(
      (acc, sub) => {
        acc.all = (acc.all || 0) + 1;
        acc[sub.status] = (acc[sub.status] || 0) + 1;
        return acc;
      },
      { all: 0, open: 0, in_review: 0, responded: 0, closed: 0 }
    );
  }, [submissions]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
      if (!matchesStatus) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      return (
        sub.fullName.toLowerCase().includes(q) ||
        sub.email.toLowerCase().includes(q) ||
        (sub.phone && sub.phone.toLowerCase().includes(q)) ||
        sub.message.toLowerCase().includes(q) ||
        (sub.subject && sub.subject.toLowerCase().includes(q))
      );
    });
  }, [submissions, statusFilter, searchQuery]);

  const handleOpenDetails = (submission: ContactSubmission) => {
    setSelectedSubmission(submission);
    setShowModal(true);
  };

  const handleUpdate = async (status: ContactStatus, reply: string) => {
    if (!selectedSubmission) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/contact-submissions/${selectedSubmission.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          status,
          adminReply: reply.trim() || undefined,
          sendReplyEmail: Boolean(reply.trim()),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to save response.');
      }

      setMessage({ type: 'success', text: 'Contact request updated and response email sent!' });
      
      const updatedItem = data.submission;
      setSubmissions((current) =>
        current.map((sub) => (sub.id === selectedSubmission.id ? { ...sub, ...updatedItem } : sub))
      );
      setSelectedSubmission((prev) => (prev ? { ...prev, ...updatedItem } : null));
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to update contact request.' });
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: ContactStatus) => {
    switch (status) {
      case 'open':
        return <span className={`${styles.statusBadge} ${styles.badgeOpen}`}>Open</span>;
      case 'in_review':
        return <span className={`${styles.statusBadge} ${styles.badgeReview}`}>In Review</span>;
      case 'responded':
        return <span className={`${styles.statusBadge} ${styles.badgeResponded}`}>Responded</span>;
      case 'closed':
        return <span className={`${styles.statusBadge} ${styles.badgeClosed}`}>Closed</span>;
      default:
        return <span className={styles.statusBadge}>{status}</span>;
    }
  };

  return (
    <div className={styles.container}>
      {/* Top Banner */}
      <div className={styles.header}>
        <div>
          <div className={styles.kicker}>Support Operations</div>
          <h1 className={styles.title}>Messages & Complains</h1>
          <p className={styles.subtitle}>
            Inbound student inquiries, requests, and feedback submitted via the contact form.
          </p>
        </div>
        <button className={styles.refreshBtn} onClick={fetchSubmissions} disabled={loading} title="Refresh submissions">
          <RefreshCw size={16} className={loading ? styles.spin : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {message && (
        <div className={`${styles.alert} ${message.type === 'success' ? styles.alertSuccess : styles.alertError}`}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className={styles.controlsBar}>
        <div className={styles.statusTabs}>
          {STATUS_FILTERS.map((tab) => {
            const count = counts[tab.value] || 0;
            const isActive = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                className={`${styles.tabBtn} ${isActive ? styles.tabBtnActive : ''}`}
                onClick={() => setStatusFilter(tab.value)}
              >
                <span>{tab.label}</span>
                <span className={styles.tabBadge}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by name, email, phone, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main List */}
      <div className={styles.listCard}>
        {loading ? (
          <div className={styles.loadingState}>
            <Loader variant="inline" text="Loading messages..." />
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className={styles.emptyState}>
            <Inbox size={40} className={styles.emptyIcon} />
            <h3>No messages found</h3>
            <p>
              {searchQuery
                ? `No submissions match "${searchQuery}". Try a different search term.`
                : `There are currently no submissions under the "${statusFilter}" filter.`}
            </p>
          </div>
        ) : (
          <div className={styles.submissionsList}>
            {filteredSubmissions.map((sub) => {
              const initials = sub.fullName
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() || 'U';

              return (
                <div
                  key={sub.id}
                  className={styles.listItem}
                  onClick={() => handleOpenDetails(sub)}
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.avatarWrap}>
                    <div className={styles.avatar}>{initials}</div>
                  </div>

                  <div className={styles.itemMain}>
                    <div className={styles.itemHeaderRow}>
                      <div className={styles.senderInfo}>
                        <strong className={styles.senderName}>{sub.fullName}</strong>
                        <span className={styles.senderEmail}>
                          <Mail size={13} /> {sub.email}
                        </span>
                        {sub.phone && (
                          <span className={styles.senderPhone}>
                            <Phone size={13} /> {sub.phone}
                          </span>
                        )}
                      </div>
                      <div className={styles.itemMeta}>
                        <span className={styles.timeTag}>
                          <Clock size={13} /> {formatDateTimeGMT6(sub.createdAt)}
                        </span>
                        {getStatusBadge(sub.status)}
                      </div>
                    </div>

                    <div className={styles.messagePreview}>
                      <p>{sub.message}</p>
                    </div>

                    {sub.adminReply && (
                      <div className={styles.repliedIndicator}>
                        <CheckCircle2 size={13} />
                        <span>Replied by Admin {sub.adminReplySentAt ? `(${formatDateTimeGMT6(sub.adminReplySentAt)})` : ''}</span>
                      </div>
                    )}
                  </div>

                  <div className={styles.itemAction}>
                    <button
                      className={styles.viewBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDetails(sub);
                      }}
                      aria-label="View details"
                    >
                      <span>Details</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedSubmission && (
        <ContactRequestModal
          submission={selectedSubmission}
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setSelectedSubmission(null);
          }}
          onUpdate={handleUpdate}
          isSaving={saving}
        />
      )}
    </div>
  );
}