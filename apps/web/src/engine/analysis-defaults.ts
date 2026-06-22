// Canonical default parameters for the configurable analysis tools, in engine units.
// Single source so the engine's omitted-option fallbacks and the panel's pre-filled form
// values cannot drift. Light module (no heavy @bessel imports) so both the lazy
// analysis-ops chunk and the analysis panel import it without merging chunks.

/** A pointing reference an attitude slew can start from or end at. */
export type SlewPointing = 'nadir' | 'sun';

/** Walker constellation design parameters (shared by the engine op and the panel form). */
export interface ConstellationParams {
  readonly totalSats: number;
  readonly planes: number;
  readonly phasing: number;
  readonly inclinationDeg: number;
  readonly altitudeKm: number;
  readonly pattern: 'delta' | 'star';
}

/** Default downlink radio parameters (engine units: frequency in Hz). */
export const DEFAULT_LINK = { eirpDbW: 90, freqHz: 8.4e9, gOverTDbK: 53, dataRateBps: 14_000 } as const;

/** Default conjunction encounter covariance (per-axis sigma, combined hard-body radius). */
export const DEFAULT_CONJUNCTION = { sigmaKm: 1, radiusKm: 0.1 } as const;

/** Default Walker pattern: the 24/3/1 LEO demo. */
export const DEFAULT_CONSTELLATION: ConstellationParams = {
  totalSats: 24,
  planes: 3,
  phasing: 1,
  inclinationDeg: 53,
  altitudeKm: 700,
  pattern: 'delta',
};

/** Default eigen-axis slew: nadir to Sun at 2 deg/s, 0.5 deg/s^2. */
export const DEFAULT_SLEW = { fromMode: 'nadir', toMode: 'sun', maxRateDeg: 2, maxAccelDeg: 0.5 } as const;

/** The composable access constraint stack the panel assembles and the engine runs. Each
 *  member is an independently toggleable constraint over the same observer/target/span; the
 *  enabled ones are intersected (computeAccess) to form the surviving window. UI/engine units:
 *  range in km, range rate in km/s, the Sun keep-out half-angle in degrees. A facility-bound
 *  az/el mask and a terrain LOS are not part of this spec: they need a ground station and a DEM
 *  (Phase 2), so the panel gates them with a hint rather than fabricating inputs. */
export interface AccessConstraintSpec {
  /** Line-of-sight: the target must not be occulted by the mission center body. */
  readonly losEnabled: boolean;
  /** Range gate: observer-to-target distance within [minKm, maxKm]. */
  readonly rangeEnabled: boolean;
  readonly rangeMinKm: number;
  readonly rangeMaxKm: number;
  /** Range-rate band: observer-to-target range rate within [minKmS, maxKmS]. */
  readonly rangeRateEnabled: boolean;
  readonly rangeRateMinKmS: number;
  readonly rangeRateMaxKmS: number;
  /** Sun-exclusion keep-out: target direction at least this many degrees off the Sun. */
  readonly sunKeepoutEnabled: boolean;
  readonly sunKeepoutDeg: number;
}

/** Default access constraint stack: line-of-sight on, the rest off with representative bands
 *  pre-filled so toggling one on is a single click. */
export const DEFAULT_ACCESS_CONSTRAINTS: AccessConstraintSpec = {
  losEnabled: true,
  rangeEnabled: false,
  rangeMinKm: 0,
  rangeMaxKm: 1_000_000,
  rangeRateEnabled: false,
  rangeRateMinKmS: -10,
  rangeRateMaxKmS: 10,
  sunKeepoutEnabled: false,
  sunKeepoutDeg: 30,
};

/** A selectable sensor boresight pointing mode for the in-FOV sweep. nadir and sun are
 *  computable from sampled geometry; a target-tracking mode is gated to a later phase
 *  (it needs real attitude/CK wiring), so it is not in this union. */
export type FovPointingMode = 'nadir' | 'sun';
