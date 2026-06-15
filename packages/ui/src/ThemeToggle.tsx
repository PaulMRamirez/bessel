// Theme toggle: flips between the dark and light design-token themes. The viewer
// owns the theme state (store) and applies it to the document via data-theme.

export type ThemeName = 'dark' | 'light';

export interface ThemeToggleProps {
  readonly theme: ThemeName;
  readonly onToggle: () => void;
}

export function ThemeToggle(props: ThemeToggleProps): JSX.Element {
  const next = props.theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="bessel-theme-toggle"
      onClick={props.onToggle}
      aria-label={`Switch to ${next} theme`}
      data-testid="theme-toggle"
    >
      <span aria-hidden="true">{props.theme === 'dark' ? '☀' : '☾'}</span>
    </button>
  );
}
