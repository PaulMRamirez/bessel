// Timeline annotations: event markers on the mission timeline. The data model and
// its pure helpers live in core (no UI import); @bessel/ui renders the markers.

export interface TimelineAnnotation {
  readonly id: string;
  /** Ephemeris time of the event. */
  readonly et: number;
  readonly label: string;
  readonly kind?: 'event' | 'maneuver' | 'observation';
}

/** Sort annotations by ascending ephemeris time (stable, non-mutating). */
export function sortByEt(annotations: readonly TimelineAnnotation[]): TimelineAnnotation[] {
  return [...annotations].sort((a, b) => a.et - b.et);
}

/** Fractional position (0..1) of an et within [min, max], clamped to the ends. */
export function markerFraction(et: number, min: number, max: number): number {
  if (max <= min) return 0;
  const f = (et - min) / (max - min);
  return f < 0 ? 0 : f > 1 ? 1 : f;
}
