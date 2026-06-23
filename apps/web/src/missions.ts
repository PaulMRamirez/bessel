// The app's mission catalog, backed by the @bessel/catalog PluginRegistry so the
// registry is surfaced in the shell. A mission plugin mirrors a Cosmographia
// add-on: it declares the SPICE kernels it needs (in dependency order), the
// frames it relies on, and lazily fetches and parses its native catalog when
// activated. Users can still load their own catalogs via the Mission panel (file
// picker or drag and drop).

import {
  PluginRegistry,
  parseBesselCatalog,
  type BesselCatalog,
  type KernelRef,
} from '@bessel/catalog';

// The fixture kernels and catalog, imported as URLs so Vite emits them as hashed
// assets the KernelSource (and fetchCatalog) can resolve, exactly like the boot
// kernels in kernels.ts. The bounded SPK fixtures keep the download tiny.
import lskUrl from '../../../kernels/fixtures/naif0012.tls?url';
import pckUrl from '../../../kernels/fixtures/pck00011.tpc?url';
import ikUrl from '../../../kernels/fixtures/cas_iss_v10.ti?url';
import de440Url from '../../../kernels/fixtures/de440s-inner-cassini.bsp?url';
import cassiniUrl from '../../../kernels/fixtures/cassini-soi.bsp?url';

/** Fetch and parse a native catalog from a URL, for plugins that register one. */
export async function fetchCatalog(url: string): Promise<BesselCatalog> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mission catalog not found at ${url} (${res.status})`);
  return await parseBesselCatalog(await res.json());
}

// Cassini at Saturn orbit insertion, furnished in SPICE-data-before-objects order:
// leapseconds, planetary constants, the ISS instrument kernel (for the FOV cone),
// the inner-system ephemeris, then the Cassini trajectory SPK. This is exactly the
// boot kernel set, so the registered mission renders the same rich sample catalog
// (all planets, textured Saturn with rings + atmosphere, Cassini, and the
// CASSINI_ISS_WAC instrument) as the welcome card and the Mission menu sample button.
const CASSINI_KERNELS: readonly KernelRef[] = [
  { name: 'naif0012.tls', source: lskUrl },
  { name: 'pck00011.tpc', source: pckUrl },
  { name: 'cas_iss_v10.ti', source: ikUrl },
  { name: 'de440s-inner-cassini.bsp', source: de440Url },
  { name: 'cassini-soi.bsp', source: cassiniUrl },
];

/** Build the mission registry, pre-registering the bundled fixture plugins. */
export function createMissionRegistry(): PluginRegistry {
  const registry = new PluginRegistry();
  registry.register({
    id: 'cassini-soi',
    name: 'Cassini at Saturn',
    description: 'Cassini orbit-insertion arc at Saturn (SPICE SPK), with the ringed globe.',
    kernels: CASSINI_KERNELS,
    frames: ['J2000', 'IAU_SATURN'],
    panels: ['plugins'],
    // Load the same bundled sample catalog every other entry point uses, so loading
    // Cassini from the mission list matches the welcome / sample / file paths.
    loadCatalog: () => fetchCatalog(`${import.meta.env.BASE_URL}samples/cassini-saturn.json`),
  });
  return registry;
}
