'use client';

import styles from './AdminModal.module.css';
import { X, Monitor, Smartphone, Lock, LogOut } from 'lucide-react';

interface SessionData {
  id: string;
  deviceType: 'desktop' | 'mobile';
  browserName: string;
  ipAddress: string;
  isLocked: boolean;
  loggedOutAt: string | null;
  createdAt: string;
  lastActivityAt: string;
}

interface SessionDetailsModalProps {
  session: SessionData;
  onClose: () => void;
  onLock: () => void;
  onLogout: () => void;
}

export default function SessionDetailsModal({
  session,
  onClose,
  onLock,
  onLogout,
}: SessionDetailsModalProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getStatus = () => {
    if (session.isLocked) return { text: 'Locked', color: '#ef4444' };
    if (session.loggedOutAt) return { text: 'Logged Out', color: '#a0a0a0' };
    return { text: 'Active', color: '#22c55e' };
  };

  const status = getStatus();

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={20} />
        </button>

        <h2 style={{ marginBottom: '20px' }}>Session Details</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Device Info */}
          <div style={{ padding: '14px', borderRadius: '12px', background: 'var(--surface-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              {session.deviceType === 'desktop' ? (
                <Monitor size={18} />
              ) : (
                <Smartphone size={18} />
              )}
              <span style={{ fontWeight: 600 }}>
                {session.deviceType === 'desktop' ? 'Desktop' : 'Mobile'}
              </span>
            </div>
            <p style={{ margin: '0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {session.browserName}
            </p>
          </div>

          {/* Status */}
          <div style={{ padding: '14px', borderRadius: '12px', background: 'var(--surface-soft)' }}>
            <p style={{ margin: '0 0 6px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Status
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: status.color,
                }}
              />
              <span style={{ fontWeight: 600 }}>{status.text}</span>
            </div>
          </div>

          {/* IP Address */}
          <div style={{ padding: '14px', borderRadius: '12px', background: 'var(--surface-soft)' }}>
            <p style={{ margin: '0 0 6px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              IP Address
            </p>
            <code style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{session.ipAddress}</code>
          </div>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ padding: '14px', borderRadius: '12px', background: 'var(--surface-soft)' }}>
              <p style={{ margin: '0 0 6px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Created
              </p>
              <p style={{ margin: '0', fontSize: '0.9rem' }}>{formatDate(session.createdAt)}</p>
            </div>
            <div style={{ padding: '14px', borderRadius: '12px', background: 'var(--surface-soft)' }}>
              <p style={{ margin: '0 0 6px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Last Activity
              </p>
              <p style={{ margin: '0', fontSize: '0.9rem' }}>
                {formatDate(session.lastActivityAt)}
              </p>
            </div>
          </div>

          {/* Logged Out Date (if applicable) */}
          {session.loggedOutAt && (
            <div style={{ padding: '14px', borderRadius: '12px', background: 'var(--surface-soft)' }}>
              <p style={{ margin: '0 0 6px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Logged Out
              </p>
              <p style={{ margin: '0', fontSize: '0.9rem' }}>{formatDate(session.loggedOutAt)}</p>
            </div>
          )}

          {/* Actions */}
          {!session.loggedOutAt && !session.isLocked && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
              <button
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#ef4444',
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                onClick={onLock}
              >
                <Lock size={16} />
                Lock Device
              </button>
              <button
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'var(--accent)',
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                onClick={onLogout}
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
