// Camera target controls (Phase 0): center the view on a body. Phase 1 adds the
// object browser, visualization settings, and the full keyboard shortcut set.

export interface ViewControlsProps {
  readonly bodies: readonly string[];
  readonly focus: string;
  readonly onCenter: (body: string) => void;
}

export function ViewControls(props: ViewControlsProps): JSX.Element {
  return (
    <div className="bessel-viewcontrols" role="group" aria-label="Camera targets">
      <span>Center on:</span>
      {props.bodies.map((body) => (
        <button
          key={body}
          type="button"
          onClick={() => props.onCenter(body)}
          aria-pressed={props.focus === body}
          data-testid={`center-${body}`}
        >
          {body}
        </button>
      ))}
    </div>
  );
}
