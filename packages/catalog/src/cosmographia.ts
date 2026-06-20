// Cosmographia catalog compatibility (ADR-0006). Phase 0 supports the SPICE
// trajectory subset needed to render a spacecraft path; Phase 1 widens this to
// the full geometry taxonomy. Bad references fail loudly with a located error.

import { CatalogError, type SpacecraftCatalog } from './index.ts';
import type { CssColor, Geometry } from './native-types.ts';

export interface CosmographiaSpiceTrajectory {
  readonly type: 'Spice';
  readonly target: string;
  readonly center: string;
  readonly frame?: string;
}

export interface CosmographiaItem {
  readonly class?: string;
  readonly name: string;
  readonly startTime?: string;
  readonly endTime?: string;
  readonly trajectory: CosmographiaSpiceTrajectory;
}

export interface CosmographiaCatalog {
  readonly version?: string;
  readonly name: string;
  readonly spiceKernels?: readonly string[];
  readonly items: readonly CosmographiaItem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requireString(value: unknown, location: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new CatalogError(`Expected a non-empty string at ${location}`, location);
  }
  return value;
}

/**
 * Parse a Cosmographia catalog and return the first spacecraft as a typed
 * SpacecraftCatalog. Throws a located CatalogError on any bad reference rather
 * than silently re-centering (the loud-failure principle, CLAUDE.md).
 */
export function parseCosmographiaCatalog(raw: unknown): SpacecraftCatalog {
  if (!isRecord(raw)) throw new CatalogError('Catalog root must be an object', '$');
  // Validate the catalog name is present (fail loud) even though the spacecraft
  // item name is what we return.
  requireString(raw['name'], '$.name');

  const items = raw['items'];
  if (!Array.isArray(items) || items.length === 0) {
    throw new CatalogError('Catalog must have a non-empty items array', '$.items');
  }

  const index = items.findIndex(
    (item) => isRecord(item) && (item['class'] === 'spacecraft' || 'trajectory' in item),
  );
  if (index < 0) {
    throw new CatalogError('No spacecraft item found in catalog', '$.items');
  }
  const item = items[index] as Record<string, unknown>;
  const loc = `$.items[${index}]`;

  const trajectory = item['trajectory'];
  if (!isRecord(trajectory)) {
    throw new CatalogError('Spacecraft item is missing a trajectory', `${loc}.trajectory`);
  }
  if (trajectory['type'] !== 'Spice') {
    throw new CatalogError(
      `Unsupported trajectory type "${String(trajectory['type'])}" (Phase 0 supports "Spice")`,
      `${loc}.trajectory.type`,
    );
  }

  const spiceId = requireString(trajectory['target'], `${loc}.trajectory.target`);
  const center = requireString(trajectory['center'], `${loc}.trajectory.center`);
  const frame = typeof trajectory['frame'] === 'string' ? trajectory['frame'] : 'J2000';

  const kernelsRaw = raw['spiceKernels'];
  const kernels =
    kernelsRaw === undefined
      ? []
      : Array.isArray(kernelsRaw)
        ? kernelsRaw.map((k, i) => requireString(k, `$.spiceKernels[${i}]`))
        : (() => {
            throw new CatalogError('spiceKernels must be an array', '$.spiceKernels');
          })();

  return {
    name: requireString(item['name'], `${loc}.name`),
    spiceId,
    frame,
    center,
    kernels,
    ...(typeof item['startTime'] === 'string' ? { startTime: item['startTime'] } : {}),
    ...(typeof item['endTime'] === 'string' ? { endTime: item['endTime'] } : {}),
  };
}

const asString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const asNumber = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const asColor = (v: unknown): CssColor | undefined => {
  if (typeof v === 'string') return v;
  if (isRecord(v) && typeof v['r'] === 'number' && typeof v['g'] === 'number' && typeof v['b'] === 'number') {
    return { r: v['r'], g: v['g'], b: v['b'], ...(typeof v['a'] === 'number' ? { a: v['a'] } : {}) };
  }
  return undefined;
};
const asRadii = (v: unknown): readonly [number, number, number] | undefined => {
  if (Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number')) {
    return [v[0] as number, v[1] as number, v[2] as number];
  }
  return undefined;
};

/**
 * Map a Cosmographia geometry record (Globe or RingSystem) onto the native
 * Geometry. Globe accepts Cosmographia's `baseMap` as the diffuse alias and
 * carries `cloudMap`/`specularColor`/`specularPower`/`emissive`; RingSystem maps
 * `innerRadius`/`outerRadius`/`texture`. Returns null for unsupported types so
 * the caller can decide whether the omission is fatal (loud at the call site).
 */
export function cosmographiaGeometryToNative(raw: unknown): Geometry | null {
  if (!isRecord(raw)) throw new CatalogError('Geometry must be an object', '$.geometry');
  const type = raw['type'];
  if (type === 'Globe') {
    const radii = asRadii(raw['radii']);
    // Cosmographia's diffuse field is `baseMap`; native names it `texture`.
    const texture = asString(raw['baseMap']) ?? asString(raw['texture']);
    const cloudAltitudeKm = asNumber(raw['cloudAltitude']) ?? asNumber(raw['cloudAltitudeKm']);
    const specularColor = asColor(raw['specularColor']);
    const specularPower = asNumber(raw['specularPower']);
    return {
      type: 'Globe',
      ...(radii ? { radii } : {}),
      ...(texture !== undefined ? { texture } : {}),
      ...(asString(raw['nightTexture']) !== undefined ? { nightTexture: raw['nightTexture'] as string } : {}),
      ...(asString(raw['normalMap']) !== undefined ? { normalMap: raw['normalMap'] as string } : {}),
      ...(asString(raw['cloudMap']) !== undefined ? { cloudMap: raw['cloudMap'] as string } : {}),
      ...(cloudAltitudeKm !== undefined ? { cloudAltitudeKm } : {}),
      ...(specularColor !== undefined ? { specularColor } : {}),
      ...(specularPower !== undefined ? { specularPower } : {}),
      ...(typeof raw['emissive'] === 'boolean' ? { emissive: raw['emissive'] } : {}),
    };
  }
  if (type === 'RingSystem' || type === 'Rings') {
    const inner = asNumber(raw['innerRadius']);
    const outer = asNumber(raw['outerRadius']);
    const texture = asString(raw['texture']);
    if (inner === undefined || outer === undefined) {
      throw new CatalogError('Ring system requires innerRadius and outerRadius', '$.geometry');
    }
    return {
      type: 'Rings',
      innerRadius: inner,
      outerRadius: outer,
      ...(texture !== undefined ? { texture } : {}),
    };
  }
  return null;
}
