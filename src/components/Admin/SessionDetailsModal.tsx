'use client';

import { useState } from 'react';
import styles from './AdminModal.module.css';
import { useModal } from '@/hooks/useModal';
import { X, Monitor, Smartphone, Tablet, Lock, LogOut, Edit2, Check, RotateCcw } from 'lucide-react';

interface SessionData {
  id: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browserName: string;
  ipAddress: string;
  isLocked: boolean;
  loggedOutAt: string | null;
  createdAt: string;
  lastActivityAt: string;
  lockedByDeviceLabel?: string | null;
  deviceLabel?: string | null;
  osInfo?: string | null;
}

interface SessionDetailsModalProps {
  session: SessionData;
  onClose: () => void;
  onLock: () => void;
  onLogout: () => void;
  onRename?: () => void;
  onResetSlot?: () => void;
}

export default function SessionDetailsModal({
  session,
  onClose,
  onLock,
  onLogout,
  onRename,
  onResetSlot,
}: SessionDetailsModalProps) {
  useModal(true, onClose);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editedLabel, setEditedLabel] = useState(session.deviceLabel || session.browserName || 'Device');
  const [isSavingLabel, setIsSavingLabel] = useState(false);
  const [renameError, setRenameError] = useState('');

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB') + ' ' + date.toLocaleTimeString('en-GB');
  };

  const getStatus = () => {
    if (session.isLocked) {
      const replacedText = session.lockedByDeviceLabel 
        ? ` (Replaced by ${session.lockedByDeviceLabel})` 
        : '';
      return { text: `Locked${replacedText}`, color: '#ef4444' };
    }
    if (session.loggedOutAt) return { text: 'Logged Out', color: '#a0a0a0' };
    return { text: 'Active', color: '#22c55e' };
  };

  const handleSaveLabel = async () => {
    if (!editedLabel.trim()) return;
    setIsSavingLabel(true);
    setRenameError('');
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/admin/sessions/${session.id}/rename`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ deviceLabel: editedLabel.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to rename device');
      }

      session.deviceLabel = editedLabel.trim(); // Update locally
      setIsEditingLabel(false);
      if (onRename) {
        onRename();
      }
    } catch (err: any) {
      setRenameError(err.message || 'Error updating device label');
    } finally {
      setIsSavingLabel(false);
    }
  };

  const status = getStatus();

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={20} />
        </button>

        <h2 style={{ marginBottom: '20px', flexShrink: 0 }}>Session Details</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1, minHeight: 0, overscrollBehavior: 'contain' }}>
          {/* Device Info */}
          <div style={{ padding: '14px', borderRadius: '12px', background: 'var(--surface-soft)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {session.deviceType === 'desktop' ? (
                    <Monitor size={18} />
                  ) : session.deviceType === 'tablet' ? (
                    <Tablet size={18} />
                  ) : (
                    <Smartphone size={18} />
                  )}
                  <span style={{ fontWeight: 600 }}>Device Label</span>
                </div>
                {!isEditingLabel && (
                  <button
                    onClick={() => setIsEditingLabel(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}
                  >
                    <Edit2 size={13} />
                    Rename
                  </button>
                )}
              </div>

              {isEditingLabel ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={editedLabel}
                    onChange={(e) => setEditedLabel(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'var(--surface-strong)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: 'var(--foreground)',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                    placeholder="Enter device name..."
                    disabled={isSavingLabel}
                  />
                  <button
                    onClick={handleSaveLabel}
                    disabled={isSavingLabel || !editedLabel.trim()}
                    style={{
                      background: '#22c55e',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: (isSavingLabel || !editedLabel.trim()) ? 0.6 : 1,
                    }}
                    title="Save"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingLabel(false);
                      setEditedLabel(session.deviceLabel || session.browserName || 'Device');
                    }}
                    disabled={isSavingLabel}
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px',
                      color: 'var(--foreground)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Cancel"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                    {session.deviceLabel || session.browserName || 'Device'}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {session.browserName}{session.osInfo ? ` (${session.osInfo})` : ''}
                  </span>
                </div>
              )}

              {renameError && (
                <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>
                  {renameError}
                </span>
              )}
            </div>
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

          {/* Network & IP Address */}
          <div style={{ padding: '14px', borderRadius: '12px', background: 'var(--surface-soft)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <p style={{ margin: '0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Network & IP Address
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <code style={{ fontFamily: 'monospace', fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground)' }}>
                {session.ipAddress || '127.0.0.1'}
              </code>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--glass)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                {session.browserName} • {session.osInfo || 'Unknown OS'}
              </span>
            </div>
          </div>

          {/* Dates (GMT+6) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ padding: '14px', borderRadius: '12px', background: 'var(--surface-soft)' }}>
              <p style={{ margin: '0 0 6px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                First Connected
              </p>
              <p style={{ margin: '0', fontSize: '0.9rem', fontWeight: 500 }}>{formatDate(session.createdAt)}</p>
            </div>
            <div style={{ padding: '14px', borderRadius: '12px', background: 'var(--surface-soft)' }}>
              <p style={{ margin: '0 0 6px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Last Activity
              </p>
              <p style={{ margin: '0', fontSize: '0.9rem', fontWeight: 500 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {!session.loggedOutAt && !session.isLocked && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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

            {onResetSlot && (
              <button
                style={{
                  padding: '11px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: '#ef4444',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                }}
                onClick={onResetSlot}
              >
                <RotateCcw size={16} />
                Reset & Unbind Device Slot
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
