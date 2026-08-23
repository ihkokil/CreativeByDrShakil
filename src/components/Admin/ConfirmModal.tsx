"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, RotateCcw, Trash2, Lock, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useModal } from "@/hooks/useModal";

export type ConfirmVariant = 'danger' | 'warning' | 'info' | 'primary';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  iconType?: 'reset' | 'delete' | 'lock' | 'ban' | 'warning';
  loading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "warning",
  iconType = "warning",
  loading = false,
}: ConfirmModalProps) {
  useModal(isOpen, onClose);

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          iconBg: 'rgba(239, 68, 68, 0.12)',
          iconBorder: '1px solid rgba(239, 68, 68, 0.3)',
          iconColor: '#ef4444',
          btnBg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          btnHover: '#dc2626',
        };
      case 'warning':
        return {
          iconBg: 'rgba(245, 158, 11, 0.12)',
          iconBorder: '1px solid rgba(245, 158, 11, 0.3)',
          iconColor: '#f59e0b',
          btnBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          btnHover: '#d97706',
        };
      case 'info':
      case 'primary':
      default:
        return {
          iconBg: 'rgba(59, 130, 246, 0.12)',
          iconBorder: '1px solid rgba(59, 130, 246, 0.3)',
          iconColor: '#3b82f6',
          btnBg: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          btnHover: '#2563eb',
        };
    }
  };

  const renderIcon = () => {
    const size = 26;
    switch (iconType) {
      case 'reset':
        return <RotateCcw size={size} />;
      case 'delete':
        return <Trash2 size={size} />;
      case 'lock':
        return <Lock size={size} />;
      case 'ban':
        return <ShieldAlert size={size} />;
      case 'warning':
      default:
        return <AlertTriangle size={size} />;
    }
  };

  const stylesConfig = getVariantStyles();

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '440px',
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '18px',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              disabled={loading}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: 'none',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.color = '#94a3b8';
              }}
            >
              <X size={16} />
            </button>

            {/* Header Icon + Title */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  background: stylesConfig.iconBg,
                  border: stylesConfig.iconBorder,
                  color: stylesConfig.iconColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {renderIcon()}
              </div>
              <div style={{ flex: 1, paddingRight: '20px' }}>
                <h3
                  style={{
                    margin: '0 0 6px 0',
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    color: '#f8fafc',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {title}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.88rem',
                    color: '#94a3b8',
                    lineHeight: 1.5,
                  }}
                >
                  {message}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '1px solid rgba(255, 255, 255, 0.07)',
              }}
            >
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#cbd5e1',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!loading) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  if (!loading) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                }}
              >
                {cancelLabel}
              </button>

              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: stylesConfig.btnBg,
                  border: 'none',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                  opacity: loading ? 0.7 : 1,
                  transition: 'opacity 0.15s ease, transform 0.15s ease',
                }}
              >
                {loading ? (
                  <>
                    <span
                      style={{
                        width: '14px',
                        height: '14px',
                        border: '2px solid rgba(255, 255, 255, 0.3)',
                        borderTopColor: '#fff',
                        borderRadius: '50%',
                        display: 'inline-block',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                    Processing...
                  </>
                ) : (
                  confirmLabel
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
