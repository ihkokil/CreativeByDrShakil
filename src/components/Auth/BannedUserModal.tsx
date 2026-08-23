'use client';

import React from 'react';
import { ShieldAlert, Mail, X, ArrowLeft } from 'lucide-react';
import styles from '@/components/Admin/AdminModal.module.css';

interface BannedUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string | null;
}

export default function BannedUserModal({
  isOpen,
  onClose,
  message,
}: BannedUserModalProps) {
  if (!isOpen) return null;

  const defaultMessage =
    'Your account has been banned from accessing the platform. Please contact Dr. Nahid Akhter Shakil or email support@creativebydrshakil.com for assistance.';

  return (
    <div className={styles.overlay} onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '480px',
          padding: '28px',
          textAlign: 'center',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          background: 'var(--surface-dialog, rgba(15, 23, 42, 0.95))',
          boxShadow: '0 20px 50px rgba(239, 68, 68, 0.15)',
        }}
      >
        <button
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: '#ef4444',
          }}
        >
          <ShieldAlert size={34} />
        </div>

        <h2
          style={{
            margin: '0 0 12px',
            fontSize: '1.4rem',
            fontWeight: 700,
            color: 'var(--foreground, #ffffff)',
          }}
        >
          Account Suspended
        </h2>

        <p
          style={{
            margin: '0 0 24px',
            fontSize: '0.95rem',
            color: 'var(--text-muted, #94a3b8)',
            lineHeight: 1.6,
          }}
        >
          {message || defaultMessage}
        </p>

        <div
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.08))',
            marginBottom: '24px',
            textAlign: 'left',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Instructor & Administration:</div>
          <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>Dr. Nahid Akhter Shakil</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <a
            href="mailto:support@creativebydrshakil.com?subject=Account%20Suspension%20Inquiry"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 20px',
              borderRadius: '10px',
              background: '#ef4444',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.95rem',
              textDecoration: 'none',
              transition: 'background 0.2s',
            }}
          >
            <Mail size={18} />
            support@creativebydrshakil.com
          </a>

          <button
            onClick={() => {
              onClose();
              if (typeof window !== 'undefined') {
                window.location.href = '/';
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 16px',
              borderRadius: '10px',
              background: 'transparent',
              border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
              color: 'var(--text-muted, #94a3b8)',
              fontWeight: 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={16} />
            Return to Homepage
          </button>
        </div>
      </div>
    </div>
  );
}
