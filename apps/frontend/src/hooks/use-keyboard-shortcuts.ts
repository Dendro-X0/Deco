import { useEffect } from 'react';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

export type KeyboardShortcutHandlers = {
  onFocusSearch?: () => void;
  onStartScan?: () => void;
  onShowShortcuts?: () => void;
  onClearFilters?: () => void;
  enabled?: boolean;
};

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  const {
    onFocusSearch,
    onStartScan,
    onShowShortcuts,
    onClearFilters,
    enabled = true,
  } = handlers;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key;

      if (key === '?' || (mod && key === '/')) {
        e.preventDefault();
        onShowShortcuts?.();
        return;
      }

      if (isEditableTarget(e.target) && !mod) return;

      if (mod && key.toLowerCase() === 'f') {
        e.preventDefault();
        onFocusSearch?.();
        return;
      }

      if (mod && key === 'Enter') {
        e.preventDefault();
        onStartScan?.();
        return;
      }

      if (mod && e.shiftKey && key.toLowerCase() === 'l') {
        e.preventDefault();
        onClearFilters?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, onFocusSearch, onStartScan, onShowShortcuts, onClearFilters]);
}
