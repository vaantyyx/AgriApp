import { useEffect } from 'react';

export function useEscapeKey(isActive, onClose) {
  useEffect(() => {
    if (!isActive) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isActive, onClose]);
}
