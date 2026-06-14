// Object browser: lists catalog objects with select (multi) and visibility toggles.
// Presentational; the viewer owns the selection set and visibility map and the
// scene wiring.

export interface CatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly kind: 'body' | 'spacecraft' | 'instrument';
}

export interface ObjectBrowserProps {
  readonly entries: readonly CatalogEntry[];
  readonly selection: readonly string[];
  readonly visibility: Readonly<Record<string, boolean>>;
  readonly onToggleSelect: (id: string) => void;
  readonly onToggleVisible: (id: string, visible: boolean) => void;
}

export function ObjectBrowser(props: ObjectBrowserProps): JSX.Element {
  return (
    <section className="bessel-object-browser" aria-label="Object browser">
      <h2 className="bessel-panel-title">Objects</h2>
      <ul>
        {props.entries.map((entry) => {
          const selected = props.selection.includes(entry.id);
          const visible = props.visibility[entry.id] ?? true;
          return (
            <li key={entry.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => props.onToggleSelect(entry.id)}
                data-testid={`select-${entry.id}`}
              >
                {entry.name}
              </button>
              <label>
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(e) => props.onToggleVisible(entry.id, e.target.checked)}
                  data-testid={`visible-${entry.id}`}
                  aria-label={`Show ${entry.name}`}
                />
                Show
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
