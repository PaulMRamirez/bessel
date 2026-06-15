// The app's mission catalog, backed by the @bessel/catalog PluginRegistry so the
// registry is surfaced in the shell. Each plugin lazily fetches and parses its
// native catalog the first time it is activated.

import { PluginRegistry, parseBesselCatalog, type BesselCatalog } from '@bessel/catalog';

async function fetchCatalog(url: string): Promise<BesselCatalog> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mission catalog not found at ${url} (${res.status})`);
  return parseBesselCatalog(await res.json());
}

/** Build the registry of bundled sample missions. */
export function createMissionRegistry(): PluginRegistry {
  const registry = new PluginRegistry();
  registry.register({
    id: 'cassini-saturn',
    name: 'Cassini at Saturn',
    kernels: [
      'naif0012.tls',
      'pck00011.tpc',
      'cas_iss_v10.ti',
      'de440s-inner-cassini.bsp',
      'cassini-soi.bsp',
    ],
    frames: ['IAU_SATURN'],
    loadCatalog: () => fetchCatalog('/samples/cassini-saturn.json'),
  });
  return registry;
}
