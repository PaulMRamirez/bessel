// Native Bessel catalog types: a typed mirror of bessel-catalog.schema.json. The
// schema is the source of truth (validation runs against it); these types give
// the parser and scene builder a checked shape to consume.

export interface CssColorObject {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a?: number;
}
export type CssColor = string | CssColorObject;

export interface TimeRange {
  readonly start: string;
  readonly stop: string;
}

export interface Trajectory {
  readonly type: 'Spice' | 'Keplerian' | 'InterpolatedStates' | 'FixedPoint';
  readonly center?: string;
  readonly frame?: string;
}

export interface Orientation {
  readonly type: 'Spice' | 'Fixed' | 'UniformRotation' | 'TwoVector';
  readonly frame?: string;
  readonly quaternion?: readonly [number, number, number, number];
  /** UniformRotation spin axis (body frame). */
  readonly axis?: readonly [number, number, number];
  /** UniformRotation spin rate, radians per second. */
  readonly ratePerSec?: number;
  /** UniformRotation reference epoch (UTC); defaults to the mission start. */
  readonly epoch?: string;
}

export interface Arc {
  readonly timeRange?: TimeRange;
  readonly trajectory: Trajectory;
  readonly orientation?: Orientation;
}

export type Geometry =
  | { readonly type: 'Mesh'; readonly source?: string; readonly scale?: number }
  | { readonly type: 'DSK'; readonly source?: string; readonly scale?: number }
  | {
      readonly type: 'Globe';
      readonly radii?: readonly [number, number, number];
      readonly texture?: string;
      readonly nightTexture?: string;
      readonly normalMap?: string;
      readonly atmosphere?: GlobeAtmosphere;
      readonly rings?: GeometryRings;
    }
  | GeometryRings
  | { readonly type: 'ParticleSystem'; readonly source?: string; readonly particleCount?: number }
  | { readonly type: 'KeplerianSwarm'; readonly source?: string; readonly color?: CssColor }
  | { readonly type: 'TimeSwitched'; readonly segments: readonly TimeSwitchedSegment[] };

export interface GeometryRings {
  readonly type: 'Rings';
  readonly innerRadius?: number;
  readonly outerRadius?: number;
  readonly texture?: string;
}

export interface GlobeAtmosphere {
  /** Inner shell radius (km); defaults to the body mean radius. */
  readonly innerRadius?: number;
  /** Outer shell radius (km); defaults to a small fraction above the surface. */
  readonly outerRadius?: number;
}

export interface TimeSwitchedSegment {
  readonly timeRange: TimeRange;
  readonly geometry: Geometry;
}

export type GeometryType = Geometry['type'];

export const GEOMETRY_TYPES: readonly GeometryType[] = [
  'Mesh',
  'DSK',
  'Globe',
  'Rings',
  'ParticleSystem',
  'KeplerianSwarm',
  'TimeSwitched',
];

export interface CatalogBody {
  readonly id: string;
  readonly name?: string;
  readonly trajectory?: Trajectory;
  readonly orientation?: Orientation;
  readonly geometry?: Geometry;
}

export interface CatalogSpacecraft {
  readonly id: string;
  readonly name?: string;
  readonly trajectory?: Trajectory;
  readonly arcs?: readonly Arc[];
  readonly orientation?: Orientation;
  readonly geometry?: Geometry;
}

export interface FovStyle {
  readonly color?: CssColor;
  readonly opacity?: number;
  readonly sideDivisions?: number;
  readonly footprint?: boolean;
  readonly colorByDistance?: unknown;
}

export interface CatalogInstrument {
  readonly id: string;
  readonly parent: string;
  readonly sensor: string;
  readonly targets: readonly string[];
  readonly fov?: {
    readonly shape?: string;
    readonly styles?: Readonly<Record<string, FovStyle>>;
  };
}

export interface CatalogObservation {
  readonly instrument: string;
  readonly target: string;
  readonly footprintColor?: CssColor;
  readonly intervals?: readonly TimeRange[];
}

export interface BesselCatalog {
  readonly name?: string;
  readonly version: string;
  readonly kernels?: {
    readonly baseUrl?: string;
    readonly paths?: readonly string[];
    readonly metaKernels?: readonly string[];
  };
  readonly bodies?: readonly CatalogBody[];
  readonly spacecraft?: readonly CatalogSpacecraft[];
  readonly instruments?: readonly CatalogInstrument[];
  readonly observations?: readonly CatalogObservation[];
}
