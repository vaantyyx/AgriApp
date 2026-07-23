import { useEffect } from 'react';

// Accepts either a single ref or an array of refs — needed when the "outside"
// check must span multiple disjoint DOM subtrees, e.g. a trigger button plus
// a dropdown rendered through a portal (so it's no longer a DOM descendant
// of the trigger, but a click inside it still shouldn't count as "outside").
export function useClickOutside(refs, isActive, onClose) {
  useEffect(() => {
    if (!isActive) return;
    const list = Array.isArray(refs) ? refs : [refs];
    const handler = (e) => {
      const isInside = list.some(ref => ref.current && ref.current.contains(e.target));
      if (!isInside) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [refs, isActive, onClose]);
}
