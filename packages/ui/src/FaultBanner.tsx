// Compact, always-mountable telemetry transport fault banner. Shared by the always-
// mounted canvas chrome (so a fault reaches the operator with no menu open) and the
// TelemetryOverlay Compare tab, so the loud-fault copy and styling have one source.
// Renders nothing when there is no fault, so it is inert in the nominal case.

export interface FaultBannerProps {
  /** Loud transport fault from the telemetry adapter, or null when nominal. */
  readonly fault: string | null;
  /** Test id; defaults to the existing overlay contract id. */
  readonly testId?: string;
}

export function FaultBanner(props: FaultBannerProps): JSX.Element | null {
  if (props.fault == null) return null;
  return (
    <p
      className="bessel-telemetry-fault"
      role="alert"
      data-testid={props.testId ?? 'telemetry-fault-banner'}
    >
      Telemetry fault: {props.fault}
    </p>
  );
}
