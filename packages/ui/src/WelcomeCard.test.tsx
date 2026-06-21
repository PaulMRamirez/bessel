import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { WelcomeCard } from './WelcomeCard.tsx';

const html = (): string =>
  renderToStaticMarkup(
    createElement(WelcomeCard, {
      onLoadSample: () => {},
      onTour: () => {},
      onExplore: () => {},
      onClose: () => {},
    }),
  );

describe('@bessel/ui WelcomeCard', () => {
  it('renders a labelled dialog with three actions and a close control', () => {
    const out = html();
    expect(out).toContain('role="dialog"');
    expect(out).toContain('aria-labelledby="bessel-welcome-title"');
    expect(out).toContain('Welcome to Bessel');
    expect(out).toContain('data-testid="welcome-load-sample"');
    expect(out).toContain('data-testid="welcome-tour"');
    expect(out).toContain('data-testid="welcome-explore"');
    expect(out).toContain('aria-label="Dismiss welcome"');
  });
});
