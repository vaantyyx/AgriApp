import { useEffect } from 'react';

export function useClickOutside(ref, isActive, onClose) {
  useEffect(() => {
    if (!isActive) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, isActive, onClose]);
}
