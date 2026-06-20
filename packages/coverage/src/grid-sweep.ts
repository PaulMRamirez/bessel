// Coverage grid-sweep over access. Builds a uniform lat/lon grid of ground points
// on a central body and, for each cell, reuses the @bessel/access single-(point,
// asset) elevation-access engine (do NOT duplicate it) to find the visibility
// window of a satellite, or the union over a constellation of satellites. Each cell
// is reduced to a Figure of Merit and an N-fold (number of simultaneous assets)
// count, giving a FOM grid the scene can contour. Worker-side and cancellable in the
// app; the core sweep is a plain async function here. (STK_PARITY_SPEC §4.4,
// COV-1/COV-2/COV-3.)

import {
  windowIntersect,
  windowUnionAll,
  type EphemerisTime,
  type Window,
} from '@bessel/timeline';
import { computeElevationAccess, type Facility } from '@bessel/access';
import type { AberrationCorrection, SpiceEngine } from '@bessel/spice';
import { figureOfMerit, type FigureOfMerit } from './index.ts';

/** A uniform lat/lon coverage grid over a central body. */
export interface GridSpec {
  /** Central body (e.g. "EARTH") and its body-fixed frame (e.g. "IAU_EARTH"). */
  readonly body: string;
  readonly bodyFrame: string;
  /** Inclusive latitude bounds (rad), south to north. */
  readonly latMin: number;
  readonly latMax: number;
  /** Number of latitude rows (>= 1). Row centers are evenly spaced in [latMin,latMax]. */
  readonly latCount: number;
  /** Inclusive longitude bounds (rad), west to east. */
  readonly lonMin: number;
  readonly lonMax: number;
  /** Number of longitude columns (>= 1). */
  readonly lonCount: number;
  /** Cell altitude above the ellipsoid (km), default 0. */
  readonly altKm?: number;
}

export interface GridSweepRequest {
  readonly grid: GridSpec;
  /** Asset SPK ids/names; the cell sees coverage when any asset is in view (1-fold). */
  readonly assets: readonly string[];
  /** Search span [start, stop] in ET seconds. */
  readonly span: readonly [EphemerisTime, EphemerisTime];
  /** Geometry-finder step (s); must be shorter than the briefest pass. */
  readonly step: number;
  /** Minimum elevation above the local horizon (rad) for a pass to count. */
  readonly minElevationRad: number;
  readonly abcorr?: AberrationCorrection;
  /** Optional monotonic progress callback in [0,1] over the swept cells. */
  readonly onProgress?: (fraction: number) => void;
}

/** One swept cell: its center, per-asset FOM, and N-fold simultaneous coverage. */
export interface CoverageCell {
  readonly latRad: number;
  readonly lonRad: number;
  readonly rowIndex: number;
  readonly colIndex: number;
  /** FOM of the any-asset (1-fold) union window. */
  readonly fom: FigureOfMerit;
  /**
   * N-fold coverage fraction[k] = fraction of the span covered by at least (k+1)
   * assets simultaneously, for k in [0, assets.length).
   */
  readonly nFoldCoverage: readonly number[];
}

/** The reduced FOM grid for the whole sweep. */
export interface CoverageGrid {
  readonly grid: GridSpec;
  /** Cells in row-major order (row by latitude ascending, column by longitude). */
  readonly cells: readonly CoverageCell[];
}

/** A bad grid configuration (loud, located). */
export class GridSweepError extends Error {
  constructor(message: string) {
    super(`coverage grid sweep: ${message}`);
    this.name = 'GridSweepError';
  }
}

/** Center coordinate of cell index `k` of `count` evenly spaced across [min,max]. */
function cellCenter(min: number, max: number, count: number, k: number): number {
  if (count === 1) return (min + max) / 2;
  return min + ((max - min) * k) / (count - 1);
}

function validate(grid: GridSpec): void {
  if (grid.latCount < 1 || grid.lonCount < 1) {
    throw new GridSweepError(`latCount and lonCount must be >= 1 (got ${grid.latCount}, ${grid.lonCount})`);
  }
  if (grid.latMax < grid.latMin) throw new GridSweepError('latMax must be >= latMin');
  if (grid.lonMax < grid.lonMin) throw new GridSweepError('lonMax must be >= lonMin');
}

/**
 * Count the span fraction covered by at least 1..N assets simultaneously. Builds the
 * k-fold window as the union of every k-subset intersection. With N small (the usual
 * constellation-coverage case) this is the exact STK N-fold figure; the union keeps
 * it disjoint. nFold[k] is for "at least (k+1) assets".
 */
function nFoldFractions(
  perAsset: readonly Window[],
  span: readonly [EphemerisTime, EphemerisTime],
): number[] {
  const [t0, t1] = span;
  const duration = t1 - t0;
  const n = perAsset.length;
  const out: number[] = [];
  for (let k = 1; k <= n; k++) {
    // Union over all k-subsets of the k-way intersection.
    const subsets: Window[] = [];
    forEachKSubset(n, k, (idx) => {
      let acc: Window = perAsset[idx[0]!]!;
      for (let m = 1; m < idx.length; m++) acc = windowIntersect(acc, perAsset[idx[m]!]!);
      subsets.push(acc);
    });
    const kFold = subsets.length ? windowUnionAll(subsets) : [];
    const measure = kFold.reduce((s, [a, b]) => s + (b - a), 0);
    out.push(duration > 0 ? measure / duration : 0);
  }
  return out;
}

/** Enumerate every k-subset of [0,n) and call `fn` with the index array. */
function forEachKSubset(n: number, k: number, fn: (idx: number[]) => void): void {
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    fn([...idx]);
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) break;
    idx[i]!++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1]! + 1;
  }
}

/**
 * Sweep the grid: for every cell, compute each asset's elevation-access window via
 * @bessel/access, reduce the any-asset union to a FOM, and accumulate the N-fold
 * coverage fractions. Returns the FOM grid in row-major order.
 */
export async function sweepCoverageGrid(
  spice: SpiceEngine,
  req: GridSweepRequest,
): Promise<CoverageGrid> {
  validate(req.grid);
  if (req.assets.length === 0) throw new GridSweepError('a sweep needs at least one asset');
  const [t0, t1] = req.span;
  if (t1 <= t0) throw new GridSweepError(`span must be increasing, got [${t0}, ${t1}]`);
  const g = req.grid;
  const cells: CoverageCell[] = [];
  const total = g.latCount * g.lonCount;
  let done = 0;

  for (let r = 0; r < g.latCount; r++) {
    const latRad = cellCenter(g.latMin, g.latMax, g.latCount, r);
    for (let c = 0; c < g.lonCount; c++) {
      const lonRad = cellCenter(g.lonMin, g.lonMax, g.lonCount, c);
      const facility: Facility = {
        body: g.body,
        bodyFrame: g.bodyFrame,
        lonRad,
        latRad,
        altKm: g.altKm ?? 0,
      };
      const perAsset: Window[] = [];
      for (const asset of req.assets) {
        perAsset.push(
          await computeElevationAccess(spice, facility, asset, req.span, req.step, req.minElevationRad, req.abcorr),
        );
      }
      const anyAsset = windowUnionAll(perAsset);
      const fom = figureOfMerit(anyAsset, req.span);
      const nFoldCoverage = nFoldFractions(perAsset, req.span);
      cells.push({ latRad, lonRad, rowIndex: r, colIndex: c, fom, nFoldCoverage });
      done++;
      req.onProgress?.(done / total);
    }
  }
  return { grid: g, cells };
}
