// A bundled sample two-line element set for the TLE propagation tool. A TLE is a
// tiny public orbital-element record (not a kernel), so embedding one as sample data
// is fine, the same as the bundled sample catalogs. This is the SGP4-VER catalog-5
// case (Vanguard-class, eccentric), whose SGP4 propagation is asserted against the
// AIAA reference in @bessel/propagator's tests.
export interface SampleTle {
  readonly name: string;
  readonly line1: string;
  readonly line2: string;
}

export const SAMPLE_TLE: SampleTle = {
  name: 'SGP4-VER sat 5',
  line1: '1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  4753',
  line2: '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667',
};
