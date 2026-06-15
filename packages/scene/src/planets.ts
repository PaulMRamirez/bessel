// Inner solar system body table for the Phase 0 view. Radii are physical (km);
// the scene keeps geometry true to scale and instead enforces a minimum apparent
// size per frame so distant bodies stay visible without exaggerating the close-up.
// Phase 1 replaces this table with catalog-driven globes and radii via bodvrd.

export interface PlanetDef {
  readonly name: string;
  /** SPICE body id for ephemeris lookups (position relative to the Sun, 10). */
  readonly spiceId: string;
  /** Physical mean radius in km. */
  readonly radiusKm: number;
  /** Base RGB color (0..1) for the procedural texture (used when no image map). */
  readonly color: readonly [number, number, number];
  /** Optional image base-map URL; when set, replaces the procedural texture. */
  readonly texture?: string;
  /** Optional normal-map image URL for surface relief shading. */
  readonly normalMap?: string;
}

export const INNER_SYSTEM: readonly PlanetDef[] = [
  { name: 'Sun', spiceId: '10', radiusKm: 696000, color: [1.0, 0.83, 0.4] },
  { name: 'Mercury', spiceId: '1', radiusKm: 2440, color: [0.6, 0.57, 0.52] },
  { name: 'Venus', spiceId: '2', radiusKm: 6052, color: [0.85, 0.74, 0.5] },
  { name: 'Earth', spiceId: '399', radiusKm: 6371, color: [0.32, 0.5, 0.78] },
  { name: 'Mars', spiceId: '4', radiusKm: 3390, color: [0.74, 0.38, 0.25] },
  { name: 'Jupiter', spiceId: '5', radiusKm: 69911, color: [0.78, 0.68, 0.54] },
  { name: 'Saturn', spiceId: '6', radiusKm: 58232, color: [0.86, 0.78, 0.6] },
];
