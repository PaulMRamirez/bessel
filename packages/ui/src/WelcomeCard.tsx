// First-run welcome card shown on the empty canvas. Three large actions: load the
// bundled sample mission, take the guided tour, or just explore. Any action (and the
// close button) dismisses it. Eager and presentational (no heavy deps), so it does not
// grow the first-paint shell. The backdrop is pointer-transparent so it never blocks
// the scene; only the card itself is interactive.

import { Button } from '@bessel/selene-design';

export interface WelcomeCardProps {
  readonly onLoadSample: () => void;
  readonly onTour: () => void;
  readonly onExplore: () => void;
  readonly onClose: () => void;
}

export function WelcomeCard(props: WelcomeCardProps): JSX.Element {
  return (
    <div className="bessel-welcome-backdrop" data-testid="welcome-card">
      <section
        className="bessel-welcome"
        role="dialog"
        aria-modal="false"
        aria-labelledby="bessel-welcome-title"
      >
        <button
          type="button"
          className="bessel-welcome-close"
          onClick={props.onClose}
          aria-label="Dismiss welcome"
          data-testid="welcome-close"
        >
          <span aria-hidden="true">✕</span>
        </button>
        <h2 id="bessel-welcome-title" className="bessel-welcome-title">
          Welcome to Bessel
        </h2>
        <p className="bessel-welcome-lede">
          A SPICE-aware mission viewer. Start with the bundled mission, take a short tour,
          or just explore the solar system.
        </p>
        <div className="bessel-welcome-actions">
          <Button variant="primary" full onClick={props.onLoadSample} testId="welcome-load-sample">
            Load the sample mission
          </Button>
          <Button variant="secondary" full onClick={props.onTour} testId="welcome-tour">
            Take the guided tour
          </Button>
          <Button variant="ghost" full onClick={props.onExplore} testId="welcome-explore">
            Explore the solar system
          </Button>
        </div>
      </section>
    </div>
  );
}
