// Generic, catalog-driven mission scene builder. Where mission.ts encodes the
// bundled Cassini demo, this turns an arbitrary parsed native Bessel catalog
// into a SceneSpec by sampling SPICE for every referenced body and spacecraft
// and mapping each catalog geometry type onto the spec. This is the seam that
// makes "load any mission" real: engine.loadCatalog rebuilds the rendered scene
// from one of these rather than re-rendering Cassini.
//
// The geometry-mapping helpers are pure and headless-testable; the orchestrator
// does the SPICE sampling and calls them. Bodies and spacecraft resolve by SPICE
// name or id (spkpos accepts both), so a catalog body "Saturn" or "699" works as
// long as the loaded kernels cover it. Unresolved bodies fail loudly.

import {
  INNER_SYSTEM,
  parseStarCatalog,
  type PlanetDef,
  type SceneSpec,
  type Km3,
  type Star,
  type RingSpec,
  type KeplerianSwarmSpec,
  type ParticleSystemSpec,
  type TimeSwitchedSpec,
} from '@bessel/scene';
import { linearRamp } from '@bessel/color';
import type { BesselCatalog, CatalogBody, CatalogSpacecraft, Geometry } from '@bessel/catalog';
import type { SpiceEngine } from '@bessel/spice';
import brightStars from './assets/bright-stars.json';
import { sampleEphemeris, trajectoryOf, type EphemerisTable } from './sampler.ts';
import { missionWindow } from './mission/duration.ts';
import { STEPS, FOCUS_DISTANCE, DEFAULT_FOCUS_DISTANCE } from './engine/constants.ts';

/** Which spacecraft and center body the active mission tracks. */
export interface MissionIdentity {
  readonly spacecraftName: string | null;
  readonly centerBody: string;
  /** SPICE frame for the spacecraft attitude (CK), driven via pxform, if any. */
  readonly spacecraftFrame?: string;
}

export interface MissionScene {
  readonly spec: SceneSpec;
  readonly table: EphemerisTable;
  readonly window: readonly [number, number];
  readonly identity: MissionIdentity;
}

const INNER_BY_NAME = new Map(INNER_SYSTEM.map((p) => [p.name.toLowerCase(), p]));

const DEFAULT_BODY_COLOR: readonly [number, number, number] = [0.6, 0.62, 0.66];
const DEFAULT_BODY_RADIUS_KM = 1000;

/** Mean radius (km) for a catalog body: explicit Globe radii, else a known body, else a default. */
export function bodyRadiusKm(body: CatalogBody): number {
  const g = body.geometry;
  if (g && g.type === 'Globe' && g.radii && g.radii.length === 3) {
    return (g.radii[0]! + g.radii[1]! + g.radii[2]!) / 3;
  }
  const known = INNER_BY_NAME.get((body.name ?? body.id).toLowerCase());
  return known?.radiusKm ?? DEFAULT_BODY_RADIUS_KM;
}

/** Turn a catalog body into the PlanetDef the globe renderer consumes. */
export function catalogBodyToPlanetDef(body: CatalogBody): PlanetDef {
  const name = body.name ?? body.id;
  const known = INNER_BY_NAME.get(name.toLowerCase());
  const g = body.geometry;
  const texture = g && g.type === 'Globe' ? g.texture : undefined;
  const normalMap = g && g.type === 'Globe' ? g.normalMap : undefined;
  return {
    name,
    spiceId: body.id,
    radiusKm: bodyRadiusKm(body),
    color: known?.color ?? DEFAULT_BODY_COLOR,
    ...(texture ? { texture } : {}),
    ...(normalMap ? { normalMap } : {}),
  };
}

/** A Rings geometry (or a Globe carrying a rings sub-spec) maps to a RingSpec. */
export function ringSpecFromGeometry(
  body: string,
  g: Geometry,
  rotationRowMajor3x3?: readonly number[],
): RingSpec | null {
  const rings = g.type === 'Rings' ? g : g.type === 'Globe' ? g.rings : undefined;
  if (!rings) return null;
  const innerKm = rings.innerRadius ?? 0;
  const outerKm = rings.outerRadius ?? 0;
  if (outerKm <= innerKm) return null;
  return { body, innerKm, outerKm, ...(rotationRowMajor3x3 ? { rotationRowMajor3x3 } : {}) };
}

/** A KeplerianSwarm geometry maps to a swarm spec with sensible default orbit spread. */
export function swarmSpecFromGeometry(
  id: string,
  anchorBody: string,
  g: Geometry,
  semiMajorRefKm: number,
  rotationRowMajor3x3?: readonly number[],
): KeplerianSwarmSpec | null {
  if (g.type !== 'KeplerianSwarm') return null;
  const color = typeof g.color === 'string' ? g.color : '#bcd4ff';
  return {
    id,
    anchorBody,
    ...(rotationRowMajor3x3 ? { rotationRowMajor3x3 } : {}),
    params: {
      count: 1200,
      semiMajorMinKm: semiMajorRefKm * 1.6,
      semiMajorMaxKm: semiMajorRefKm * 4,
      eccentricity: 0.04,
      inclinationDeg: 2,
      color,
      sizePx: 1.5,
    },
  };
}

/** A ParticleSystem geometry maps to a particle spec emitting from the body. */
export function particleSpecFromGeometry(
  id: string,
  anchorBody: string,
  g: Geometry,
  bodyRadius: number,
): ParticleSystemSpec | null {
  if (g.type !== 'ParticleSystem') return null;
  return {
    id,
    anchorBody,
    params: {
      count: g.particleCount ?? 600,
      direction: [0, 1, 0],
      spreadDeg: 18,
      lengthKm: bodyRadius * 1.5,
      baseRadiusKm: bodyRadius,
      color: '#cfe8ff',
      sizePx: 2,
    },
  };
}

/** Assemble the final SceneSpec from sampled positions and mapped geometry. */
export function assembleSceneSpec(input: {
  readonly bodies: readonly PlanetDef[];
  readonly spacecraftName: string | null;
  readonly trajectoryPoints: readonly Km3[];
  readonly trajectoryColors?: readonly (readonly [number, number, number])[];
  readonly trajectoryAnchor: string;
  readonly stars?: readonly Star[];
  readonly rings: readonly RingSpec[];
  readonly keplerianSwarms: readonly KeplerianSwarmSpec[];
  readonly particleSystems: readonly ParticleSystemSpec[];
  readonly timeSwitched: readonly TimeSwitchedSpec[];
  readonly cameraFocus: string;
  readonly cameraDistance: number;
}): SceneSpec {
  const labels = [
    ...input.bodies.map((b) => ({ id: b.name, text: b.name, anchorBody: b.name })),
    ...(input.spacecraftName
      ? [{ id: input.spacecraftName, text: input.spacecraftName, anchorBody: input.spacecraftName }]
      : []),
  ];
  return {
    bodies: input.bodies,
    ...(input.spacecraftName ? { spacecraft: { name: input.spacecraftName } } : {}),
    ...(input.trajectoryPoints.length > 0
      ? {
          trajectory: {
            points: input.trajectoryPoints,
            anchorBody: input.trajectoryAnchor,
            ...(input.trajectoryColors ? { colors: input.trajectoryColors } : {}),
          },
        }
      : {}),
    ...(input.stars ? { starField: input.stars } : {}),
    rings: input.rings,
    keplerianSwarms: input.keplerianSwarms,
    particleSystems: input.particleSystems,
    timeSwitched: input.timeSwitched,
    labels,
    camera: { focus: input.cameraFocus, azimuth: 0.6, elevation: 0.35, distance: input.cameraDistance },
  };
}

/**
 * Orchestrate a generic mission: sample SPICE for every catalog body and the
 * first spacecraft, then assemble a SceneSpec. Throws on a missing time window
 * or an unresolved body (loud failure, never a silent re-center).
 */
export async function buildCatalogMissionScene(
  spice: SpiceEngine,
  catalog: BesselCatalog,
  onStatus: (status: string) => void = () => {},
): Promise<MissionScene> {
  const spacecraft = catalog.spacecraft?.[0] ?? null;
  const window = await resolveWindow(spice, spacecraft);
  const [et0, et1] = window;

  // Bodies: catalog-declared, else the inner-system table so the scene is never
  // empty. The Sun is always present as the heliocentric origin and light.
  const catalogDefs = (catalog.bodies ?? []).map(catalogBodyToPlanetDef);
  const bodies = catalogDefs.length > 0 ? withSun(catalogDefs) : INNER_SYSTEM;

  onStatus('Sampling ephemerides');
  const sampleRefs = bodies.map((b) => ({ name: b.name, spiceId: b.spiceId }));
  if (spacecraft) sampleRefs.push({ name: spacecraft.name ?? spacecraft.id, spiceId: spacecraft.id });
  const table = await sampleEphemeris(spice, sampleRefs, et0, et1, STEPS);

  // Spacecraft trajectory sampled in its center frame so the polyline shows the
  // orbit rather than the center body's heliocentric drift.
  let trajectoryPoints: Km3[] = [];
  let trajectoryColors: (readonly [number, number, number])[] | undefined;
  let centerBody = bodies[0]?.name ?? 'Sun';
  if (spacecraft) {
    const center =
      spacecraft.trajectory?.center ?? spacecraft.arcs?.[0]?.trajectory?.center ?? centerBody;
    centerBody = resolveCenterName(center, bodies);
    const orbit = await sampleEphemeris(
      spice,
      [{ name: spacecraft.name ?? spacecraft.id, spiceId: spacecraft.id }],
      et0,
      et1,
      STEPS,
      center,
    );
    trajectoryPoints = trajectoryOf(orbit, spacecraft.name ?? spacecraft.id);
    const ramp = linearRamp('trail', { r: 0.12, g: 0.17, b: 0.38 }, { r: 0.55, g: 0.78, b: 1 });
    trajectoryColors = trajectoryPoints.map((_, i) => {
      const c = ramp.color(i, [0, Math.max(1, trajectoryPoints.length - 1)]);
      return [c.r, c.g, c.b] as const;
    });
  }

  // Map every catalog body's geometry onto the decorative scene specs.
  const rings: RingSpec[] = [];
  const keplerianSwarms: KeplerianSwarmSpec[] = [];
  const particleSystems: ParticleSystemSpec[] = [];
  const timeSwitched: TimeSwitchedSpec[] = [];
  for (const body of catalog.bodies ?? []) {
    const name = body.name ?? body.id;
    const g = body.geometry;
    if (!g) continue;
    const radius = bodyRadiusKm(body);
    const ring = ringSpecFromGeometry(name, g);
    if (ring) rings.push(ring);
    const swarm = swarmSpecFromGeometry(`${name}-swarm`, name, g, radius);
    if (swarm) keplerianSwarms.push(swarm);
    const particles = particleSpecFromGeometry(`${name}-particles`, name, g, radius);
    if (particles) particleSystems.push(particles);
    const switched = timeSwitchedFromGeometry(`${name}-switched`, name, g, radius, et0, et1, spice);
    if (switched) timeSwitched.push(await switched);
  }

  const cameraDistance = FOCUS_DISTANCE[centerBody] ?? DEFAULT_FOCUS_DISTANCE;
  const stars = safeStars();
  const spec = assembleSceneSpec({
    bodies,
    spacecraftName: spacecraft ? (spacecraft.name ?? spacecraft.id) : null,
    trajectoryPoints,
    ...(trajectoryColors ? { trajectoryColors } : {}),
    trajectoryAnchor: centerBody,
    ...(stars ? { stars } : {}),
    rings,
    keplerianSwarms,
    particleSystems,
    timeSwitched,
    cameraFocus: centerBody,
    cameraDistance,
  });

  const spacecraftFrame =
    spacecraft?.orientation?.type === 'Spice' ? spacecraft.orientation.frame : undefined;
  return {
    spec,
    table,
    window,
    identity: {
      spacecraftName: spec.spacecraft?.name ?? null,
      centerBody,
      ...(spacecraftFrame ? { spacecraftFrame } : {}),
    },
  };
}

function timeSwitchedFromGeometry(
  id: string,
  anchorBody: string,
  g: Geometry,
  radius: number,
  et0: number,
  et1: number,
  spice: SpiceEngine,
): Promise<TimeSwitchedSpec> | null {
  if (g.type !== 'TimeSwitched') return null;
  return (async (): Promise<TimeSwitchedSpec> => {
    const segments = await Promise.all(
      g.segments.map(async (seg, i) => {
        const start = await safeEt(spice, seg.timeRange.start, et0);
        const stop = await safeEt(spice, seg.timeRange.stop, et1);
        const color = i % 2 === 0 ? '#7cfc00' : '#33ccff';
        return { start, end: stop, color, radiusKm: radius * 0.4 };
      }),
    );
    return { id, anchorBody, offsetKm: radius * 3, segments };
  })();
}

async function resolveWindow(
  spice: SpiceEngine,
  spacecraft: CatalogSpacecraft | null,
): Promise<readonly [number, number]> {
  const range = spacecraft?.arcs?.[0]?.timeRange;
  if (!range) {
    throw new Error(
      'Mission has no time window: the first spacecraft needs an arc with a timeRange to bound sampling',
    );
  }
  const rawEt0 = await spice.str2et(toSpiceUtc(range.start));
  const rawEt1 = await spice.str2et(toSpiceUtc(range.stop));
  return missionWindow(rawEt0, rawEt1, 1800);
}

async function safeEt(spice: SpiceEngine, utc: string, fallback: number): Promise<number> {
  try {
    return await spice.str2et(toSpiceUtc(utc));
  } catch {
    return fallback;
  }
}

// CSPICE str2et reads a UTC calendar string but does not accept the ISO 8601 "Z"
// zone suffix, so strip it. The time is already UTC by SPICE convention.
function toSpiceUtc(utc: string): string {
  return utc.endsWith('Z') ? utc.slice(0, -1) : utc;
}

function resolveCenterName(center: string, bodies: readonly PlanetDef[]): string {
  const match = bodies.find(
    (b) => b.name.toLowerCase() === center.toLowerCase() || b.spiceId === center,
  );
  return match?.name ?? center;
}

function withSun(defs: readonly PlanetDef[]): readonly PlanetDef[] {
  if (defs.some((d) => d.name.toLowerCase() === 'sun' || d.spiceId === '10')) return defs;
  return [INNER_SYSTEM[0]!, ...defs];
}

function safeStars(): readonly Star[] | undefined {
  try {
    return parseStarCatalog(brightStars);
  } catch (err) {
    console.error('star catalog parse failed', err);
    return undefined;
  }
}
