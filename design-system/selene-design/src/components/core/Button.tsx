import type { CSSProperties, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'critical';

interface VariantStyle {
  bg: string;
  fg: string;
  bd: string;
  weight: number;
}

const VARIANTS: Record<ButtonVariant, VariantStyle> = {
  primary: { bg: 'var(--amber)', fg: 'var(--bg-0)', bd: 'transparent', weight: 600 },
  secondary: { bg: 'var(--bg-2)', fg: 'var(--ink-1)', bd: 'var(--line)', weight: 500 },
  ghost: { bg: 'transparent', fg: 'var(--ink-1)', bd: 'transparent', weight: 500 },
  critical: { bg: 'var(--red-hot)', fg: 'var(--bg-0)', bd: 'transparent', weight: 600 },
};

export interface ButtonProps {
  children: ReactNode;
  /** primary=amber CTA, secondary=neutral, ghost=bare, critical=emergency (red). One primary per region. */
  variant?: ButtonVariant;
  /** Stretch to container width. */
  full?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
}

/**
 * Button — the system's action control. Flat, tight-radius. Amber primary,
 * neutral secondary, red critical (emergency only).
 */
export function Button({
  children,
  variant = 'secondary',
  full = false,
  onClick,
  disabled = false,
  style,
}: ButtonProps) {
  const v = VARIANTS[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 'var(--control-lg)',
        padding: '0 14px',
        borderRadius: 'var(--radius-md)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--text-sm)',
        fontWeight: v.weight,
        letterSpacing: '0.02em',
        background: v.bg,
        color: v.fg,
        border: `0.5px solid ${v.bd}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        width: full ? '100%' : 'auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        transition: 'opacity var(--dur) var(--ease), background var(--dur) var(--ease)',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
