import { useModal } from './useModal';

export function useModalLock(isOpen: boolean, onClose?: () => void) {
  useModal(isOpen, onClose);
}
