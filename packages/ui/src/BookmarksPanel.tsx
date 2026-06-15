// Saved views panel: name and save the current view, then apply or delete saved
// ones. Presentational; the engine encodes and persists the views.

import { useState, type FormEvent } from 'react';

export interface BookmarkItem {
  readonly id: string;
  readonly name: string;
}

export interface BookmarksPanelProps {
  readonly bookmarks: readonly BookmarkItem[];
  readonly onSave: (name: string) => void;
  readonly onApply: (id: string) => void;
  readonly onDelete: (id: string) => void;
}

export function BookmarksPanel(props: BookmarksPanelProps): JSX.Element {
  const [name, setName] = useState('');

  const submit = (ev: FormEvent): void => {
    ev.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    props.onSave(trimmed);
    setName('');
  };

  return (
    <div className="bessel-bookmarks" data-testid="bookmarks">
      <form className="bessel-bookmark-form" onSubmit={submit}>
        <input
          className="bessel-bookmark-input"
          value={name}
          onChange={(ev) => setName(ev.target.value)}
          placeholder="Name this view"
          aria-label="Bookmark name"
          data-testid="bookmark-name"
        />
        <button type="submit" disabled={name.trim() === ''} data-testid="bookmark-save">
          Save view
        </button>
      </form>
      {props.bookmarks.length === 0 ? (
        <p className="bessel-bookmarks-empty">No saved views yet</p>
      ) : (
        <ul className="bessel-bookmarks-list" data-testid="bookmarks-list">
          {props.bookmarks.map((b) => (
            <li key={b.id} className="bessel-bookmark-row">
              <button
                type="button"
                className="bessel-bookmark-apply"
                onClick={() => props.onApply(b.id)}
              >
                {b.name}
              </button>
              <button
                type="button"
                className="bessel-bookmark-delete"
                aria-label={`Delete ${b.name}`}
                onClick={() => props.onDelete(b.id)}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
