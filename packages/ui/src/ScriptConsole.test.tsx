// Saved scripts render as a per-row list (a Load action plus a per-row remove), matching
// BookmarksPanel. Loading is a direct per-row click that fires onLoadSaved(name) every
// time, so the reset-to-saved workflow re-runs without any controlled-select dance, and
// deletion is a per-row remove that fires onDeleteSaved(name) for that row's script.
//
// No DOM here: we render the element, walk it for a row's Load and remove buttons by
// their per-name test ids, invoke their onClick handlers, and assert the right name
// reaches each handler.

import { describe, it, expect, vi } from 'vitest';
import { isValidElement, type ReactElement } from 'react';
import type * as React from 'react';
import type { ScriptConsoleProps } from './ScriptConsole.tsx';

let states: unknown[] = [];
let cursor = 0;

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof React>('react');
  return {
    ...actual,
    useState: <T,>(init: T): [T, (v: T) => void] => {
      const i = cursor++;
      if (i >= states.length) states[i] = init;
      const set = (v: T): void => {
        states[i] = v;
      };
      return [states[i] as T, set];
    },
  };
});

const { ScriptConsole } = await import('./ScriptConsole.tsx');

function findByTestId(node: unknown, id: string): ReactElement | null {
  if (Array.isArray(node)) {
    for (const k of node) {
      const hit = findByTestId(k, id);
      if (hit) return hit;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  const props = node.props as Record<string, unknown>;
  if (props['data-testid'] === id) return node;
  return findByTestId(props.children, id);
}

const base: ScriptConsoleProps = {
  source: 'gotoObject Earth',
  onChange: () => undefined,
  onRun: () => undefined,
  log: [],
  onClearLog: () => undefined,
  verbs: [{ verb: 'gotoObject', arity: 1 }],
  savedScriptNames: ['flyby', 'survey'],
  onSave: () => undefined,
  onLoadSaved: () => undefined,
  onDeleteSaved: () => undefined,
};

function render(props: ScriptConsoleProps): ReactElement {
  cursor = 0;
  return ScriptConsole(props) as ReactElement;
}

describe('@bessel/ui ScriptConsole saved scripts', () => {
  it('loads a saved script from its per-row Load action, re-firing on every click', () => {
    states = [];
    const onLoadSaved = vi.fn();
    const tree = render({ ...base, onLoadSaved });
    const load = findByTestId(tree, 'script-load-flyby')!;
    (load.props as { onClick: () => void }).onClick();
    (load.props as { onClick: () => void }).onClick();
    expect(onLoadSaved).toHaveBeenCalledTimes(2);
    expect(onLoadSaved).toHaveBeenCalledWith('flyby');
  });

  it('shows an empty state when there are no saved scripts', () => {
    states = [];
    const tree = render({ ...base, savedScriptNames: [] });
    expect(findByTestId(tree, 'script-saved-list')).toBeNull();
    expect(JSON.stringify(tree)).toContain('No saved scripts yet');
  });

  it('disables Copy log when the log is empty and enables it with lines', () => {
    states = [];
    const empty = findByTestId(render({ ...base, log: [] }), 'script-copy-log')!;
    expect((empty.props as { disabled: boolean }).disabled).toBe(true);
    states = [];
    const filled = findByTestId(render({ ...base, log: ['ran: gotoObject Earth'] }), 'script-copy-log')!;
    expect((filled.props as { disabled: boolean }).disabled).toBe(false);
  });

  it('defaults the verb reference open so it is visible without an extra click', () => {
    states = [];
    const details = render(base).props.children.find(
      (c: ReactElement | null) =>
        isValidElement(c) && (c.props as { className?: string }).className === 'bessel-script-ref',
    );
    expect((details.props as { open: boolean }).open).toBe(true);
  });

  it('removes a saved script from its per-row delete control', () => {
    states = [];
    const onDeleteSaved = vi.fn();
    const tree = render({ ...base, onDeleteSaved });
    const del = findByTestId(tree, 'script-delete-survey')!;
    (del.props as { onClick: () => void }).onClick();
    expect(onDeleteSaved).toHaveBeenCalledWith('survey');
  });
});
