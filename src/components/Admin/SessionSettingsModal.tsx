'use client';

import { useEffect, useState } from 'react';
import styles from './AdminModal.module.css';
import { X } from 'lucide-react';

import { useModal } from '@/hooks/useModal';

interface SessionSettingsModalProps {
  userId: string;
  onClose: () => void;
  onSave: () => void;
}

export default function SessionSettingsModal({
  userId,
  onClose,
  onSave,
}: SessionSettingsModalProps) {
  useModal(true, onClose);
  const [autoLockEnabled, setAutoLockEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const token = localStorage.getItem('auth_token');

  useEffect(() => {
    // Fetch current setting
    const fetchSetting = async () => {
      try {
        const response = await fetch(`/api/admin/user-session-settings/${userId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (response.ok) {
          const data = await response.json();
          setAutoLockEnabled(data.autoLockFirstBrowser);
        }
      } catch {
        // Use default
      } finally {
        setLoading(false);
      }
    };

    fetchSetting();
  }, [userId, token]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/user-session-settings/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ autoLockFirstBrowser: autoLockEnabled }),
      });

      if (response.ok) {
        onSave();
      }
    } catch {
      // Error handling
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={20} />
        </button>

        <h2 style={{ marginBottom: '20px', flexShrink: 0 }}>Override Auto-Lock Setting</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1, minHeight: 0, overscrollBehavior: 'contain' }}>
          <p style={{ color: 'var(--text-muted)', margin: '0' }}>
            Customize the auto-lock behavior for this user. This setting overrides the global default.
          </p>

          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              background: 'var(--surface-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <p style={{ margin: '0 0 6px 0', fontWeight: 600 }}>Auto-Lock First Device</p>
              <p style={{ margin: '0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Block new logins from same device type
              </p>
            </div>
            <button
              onClick={() => setAutoLockEnabled(!autoLockEnabled)}
              style={{
                position: 'relative',
                width: '50px',
                height: '28px',
                border: 'none',
                borderRadius: '14px',
                background: autoLockEnabled ? 'var(--primary)' : 'var(--surface-strong)',
                cursor: 'pointer',
                transition: 'background 0.3s',
                padding: '0',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '2px',
                  left: autoLockEnabled ? '26px' : '2px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '12px',
                  background: 'white',
                  transition: 'left 0.3s',
                }}
              />
            </button>
          </div>

          <div
            style={{
              padding: '12px',
              borderRadius: '10px',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
            }}
          >
            <p style={{ margin: '0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Status: <strong>{autoLockEnabled ? 'ENABLED' : 'DISABLED'}</strong>
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid var(--glass-border)',
                background: 'transparent',
                color: 'var(--foreground)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                border: 'none',
                background: 'var(--primary)',
                color: 'white',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
