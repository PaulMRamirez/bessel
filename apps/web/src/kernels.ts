// The demo kernels, imported as URLs so Vite emits them as hashed assets. pal-web
// fetches them by URL and the SPICE engine furnsh'es the bytes. The bounded SPK
// fixtures keep the download tiny; full kernels are fetched by kernels/fetch.sh.
import lskUrl from '../../../kernels/fixtures/naif0012.tls?url';
import de440Url from '../../../kernels/fixtures/de440s-inner-cassini.bsp?url';
import cassiniUrl from '../../../kernels/fixtures/cassini-soi.bsp?url';

export const KERNEL_URLS: Readonly<Record<string, string>> = {
  'naif0012.tls': lskUrl,
  'de440s-inner-cassini.bsp': de440Url,
  'cassini-soi.bsp': cassiniUrl,
};

/** furnsh order matters: LSK first, then the SPKs. */
export const KERNEL_ORDER: readonly string[] = [
  'naif0012.tls',
  'de440s-inner-cassini.bsp',
  'cassini-soi.bsp',
];
