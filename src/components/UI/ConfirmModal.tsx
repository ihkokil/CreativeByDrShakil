'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Info, AlertCircle, Trash2 } from 'lucide-react';
import Loader from '@/components/UI/Loader';
import styles from './ConfirmModal.module.css';

export interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: React.ReactNode | string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'primary';
  isSubmitting?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  icon?: React.ReactNode;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isSubmitting = false,
  onConfirm,
  onCancel,
  icon,
}: ConfirmModalProps) {
  // Keyboard navigation & body scroll locking
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isSubmitting) {
          onCancel();
        }
      };
      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onCancel, isSubmitting]);

  const getDefaultIcon = () => {
    if (icon) return icon;
    switch (variant) {
      case 'danger':
        return <Trash2 size={26} className={styles.dangerIcon} />;
      case 'warning':
        return <AlertTriangle size={26} className={styles.warningIcon} />;
      case 'info':
      case 'primary':
      default:
        return <Info size={26} className={styles.infoIcon} />;
    }
  };

  const getDefaultTitle = () => {
    if (title) return title;
    switch (variant) {
      case 'danger':
        return 'Are you sure?';
      case 'warning':
        return 'Warning';
      case 'info':
      case 'primary':
      default:
        return 'Confirmation Required';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={styles.overlay} onClick={() => !isSubmitting && onCancel()} role="dialog" aria-modal="true">
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={styles.closeBtn}
              onClick={onCancel}
              disabled={isSubmitting}
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className={styles.header}>
              <div className={`${styles.iconWrapper} ${styles[`icon_${variant}`]}`}>
                {getDefaultIcon()}
              </div>
              <div className={styles.headerText}>
                <h3 className={styles.title}>{getDefaultTitle()}</h3>
              </div>
            </div>

            <div className={styles.body}>
              {typeof message === 'string' ? (
                <p className={styles.messageText}>{message}</p>
              ) : (
                message
              )}
            </div>

            <div className={styles.footer}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={onCancel}
                disabled={isSubmitting}
              >
                {cancelText}
              </button>
              <button
                type="button"
                className={`${styles.confirmBtn} ${styles[`confirm_${variant}`]}`}
                onClick={onConfirm}
                disabled={isSubmitting}
                autoFocus
              >
                {isSubmitting ? (
                  <span className={styles.buttonLoader}>
                    <Loader variant="button" />
                    <span>Processing...</span>
                  </span>
                ) : (
                  confirmText
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
