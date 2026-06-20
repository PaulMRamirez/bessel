// Scripting console: a small in-app editor that runs Cosmographia-style
// cosmoscripting verbs against the live viewer. Presentational only: the app
// owns the source string, holds the executed-verb log, and wires onRun to the
// line interpreter. The textarea and buttons are labeled so the axe a11y scan
// passes.

export interface ScriptConsoleProps {
  /** The current script source (one `verb arg...` per line; `#` comments). */
  readonly source: string;
  readonly onChange: (source: string) => void;
  readonly onRun: () => void;
  /** Executed-verb echo plus any per-line error, newest run replacing the last. */
  readonly log: readonly string[];
}

const PLACEHOLDER = ['gotoObject Earth', 'setTimeRate 3600', 'show orbits', '# unpause the clock', 'unpause'].join(
  '\n',
);

export function ScriptConsole(props: ScriptConsoleProps): JSX.Element {
  return (
    <section className="bessel-script" aria-label="Scripting console">
      <label className="bessel-script-label" htmlFor="bessel-script-input">
        Script (one verb per line; # for comments)
      </label>
      <textarea
        id="bessel-script-input"
        className="bessel-script-input"
        spellCheck={false}
        rows={8}
        value={props.source}
        placeholder={PLACEHOLDER}
        onChange={(e) => props.onChange(e.target.value)}
        data-testid="script-input"
      />
      <div className="bessel-script-actions" role="group" aria-label="Script actions">
        <button type="button" onClick={props.onRun} data-testid="script-run">
          Run script
        </button>
      </div>
      <pre
        className="bessel-script-output"
        role="log"
        aria-label="Script output"
        aria-live="polite"
        data-testid="script-output"
      >
        {props.log.join('\n')}
      </pre>
    </section>
  );
}
