// Accessible tooltip: wraps a single focusable element and associates a
// descriptive label via aria-describedby. The label is shown on hover and focus
// (CSS), and is always available to assistive tech through the description.

import { cloneElement, useId, type ReactElement } from 'react';

export interface TooltipProps {
  readonly label: string;
  readonly children: ReactElement<{ 'aria-describedby'?: string }>;
}

export function Tooltip(props: TooltipProps): JSX.Element {
  const id = useId();
  return (
    <span className="bessel-tooltip-wrap">
      {cloneElement(props.children, { 'aria-describedby': id })}
      <span role="tooltip" id={id} className="bessel-tooltip">
        {props.label}
      </span>
    </span>
  );
}
