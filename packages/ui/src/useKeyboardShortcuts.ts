// React hook attaching the keymap to the window. Ignores keydowns from text inputs
// so typing in fields is not hijacked.

import { useEffect } from 'react';
import { isEditableTarget, resolveAction, type KeyboardAction } from './keymap.ts';

export function useKeyboardShortcuts(onAction: (action: KeyboardAction) => void): void {
  useEffect(() => {
    const handler = (ev: KeyboardEvent): void => {
      if (isEditableTarget(ev.target)) return;
      const action = resolveAction(ev.key);
      if (!action) return;
      ev.preventDefault();
      onAction(action);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onAction]);
}
