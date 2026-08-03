import { useEffect } from 'react';

let activeModalCount = 0;

export function useModal(isOpen: boolean, onClose?: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    activeModalCount++;
    if (activeModalCount === 1) {
      document.documentElement.classList.add('modal-open');
      document.body.classList.add('modal-open');
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      activeModalCount = Math.max(0, activeModalCount - 1);
      if (activeModalCount === 0) {
        document.documentElement.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);
}
