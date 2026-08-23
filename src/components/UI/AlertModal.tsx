import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import styles from './AlertModal.module.css';

interface AlertModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
  autoClose?: boolean;
  duration?: number;
}

export default function AlertModal({ 
  isOpen, 
  title, 
  message, 
  type = 'info', 
  onClose,
  autoClose = true,
  duration = 5000 
}: AlertModalProps) {
  const [isPaused, setIsPaused] = useState(false);
  const remainingTimeRef = useRef(duration);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={32} className={styles.successIcon} />;
      case 'error':
        return <AlertTriangle size={32} className={styles.errorIcon} />;
      case 'warning':
        return <AlertTriangle size={32} className={styles.warningIcon} />;
      case 'info':
      default:
        return <Info size={32} className={styles.infoIcon} />;
    }
  };

  const getTitle = () => {
    if (title) return title;
    switch (type) {
      case 'success': return 'Success';
      case 'error': return 'Error';
      case 'warning': return 'Warning';
      case 'info': default: return 'Information';
    }
  };

  // Keyboard accessibility and body lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  // 5-second Auto-close timer with pause/resume support
  useEffect(() => {
    if (!isOpen || !autoClose) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    remainingTimeRef.current = duration;
    startTimeRef.current = Date.now();

    const startTimer = () => {
      timerRef.current = setTimeout(() => {
        onClose();
      }, remainingTimeRef.current);
    };

    if (!isPaused) {
      startTimer();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen, autoClose, duration, onClose, isPaused]);

  const handleMouseEnter = () => {
    if (!autoClose) return;
    setIsPaused(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    const elapsed = Date.now() - startTimeRef.current;
    remainingTimeRef.current = Math.max(500, remainingTimeRef.current - elapsed);
  };

  const handleMouseLeave = () => {
    if (!autoClose) return;
    startTimeRef.current = Date.now();
    setIsPaused(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={styles.overlay} onClick={onClose}>
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {autoClose && (
              <div 
                className={`${styles.progressBar} ${styles[`progress_${type}`] || styles.progress_info}`} 
                style={{ 
                  animationDuration: `${duration}ms`,
                  animationPlayState: isPaused ? 'paused' : 'running'
                }} 
              />
            )}

            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>

            <div className={styles.header}>
              <div className={`${styles.iconContainer} ${styles[`iconContainer_${type}`] || styles.iconContainer_info}`}>
                {getIcon()}
              </div>
              <h2 className={styles.title}>{getTitle()}</h2>
            </div>
            
            <div className={styles.body}>
              <p className={styles.message}>{message}</p>
            </div>

            <div className={styles.footer}>
              <button 
                type="button"
                className={`${styles.actionBtn} ${styles[`btn_${type}`] || styles.btn_info}`} 
                onClick={onClose} 
                autoFocus
              >
                OK
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

