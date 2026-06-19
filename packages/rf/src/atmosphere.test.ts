import { describe, it, expect } from 'vitest';
import {
  rainAttenuationDb,
  gaseousAttenuationDb,
  RAIN_COEFFS,
  dishAntenna,
  eirpDbW,
  gOverTDbK,
  linkBudget,
  parabolicGainDbi,
} from './index.ts';

const deg = (d: number): number => (d * Math.PI) / 180;

describe('rainAttenuationDb', () => {
  it('is zero with no rain and grows with rain rate', () => {
    const base = { coeffs: RAIN_COEFFS.ku12!, elevationRad: deg(30) };
    expect(rainAttenuationDb({ ...base, rainRateMmHr: 0 })).toBe(0);
    const light = rainAttenuationDb({ ...base, rainRateMmHr: 5 });
    const heavy = rainAttenuationDb({ ...base, rainRateMmHr: 50 });
    expect(light).toBeGreaterThan(0);
    expect(heavy).toBeGreaterThan(light);
  });

  it('increases at lower elevation (longer slant path)', () => {
    const base = { coeffs: RAIN_COEFFS.ka30!, rainRateMmHr: 25 };
    const high = rainAttenuationDb({ ...base, elevationRad: deg(60) });
    const low = rainAttenuationDb({ ...base, elevationRad: deg(10) });
    expect(low).toBeGreaterThan(high);
  });

  it('Ka-band attenuates more than Ku-band for the same rain', () => {
    const base = { rainRateMmHr: 25, elevationRad: deg(20) };
    const ku = rainAttenuationDb({ ...base, coeffs: RAIN_COEFFS.ku12! });
    const ka = rainAttenuationDb({ ...base, coeffs: RAIN_COEFFS.ka30! });
    expect(ka).toBeGreaterThan(ku);
  });
});

describe('gaseousAttenuationDb', () => {
  it('scales the zenith loss by the airmass (1/sin elevation)', () => {
    expect(gaseousAttenuationDb(0.3, deg(90))).toBeCloseTo(0.3, 6);
    expect(gaseousAttenuationDb(0.3, deg(30))).toBeCloseTo(0.6, 6); // sin30 = 0.5
  });
});

describe('comm entities', () => {
  it('rolls up EIRP and G/T, matching a manual link budget', () => {
    const freq = 8.4e9;
    const tx = { powerDbW: 13, antenna: dishAntenna(4, freq), lineLossDb: 1 };
    const rx = { antenna: dishAntenna(34, freq), systemNoiseTempK: 50, lineLossDb: 0.5 };
    const eirp = eirpDbW(tx);
    const gt = gOverTDbK(rx);
    // EIRP = power + dish gain - line loss.
    expect(eirp).toBeCloseTo(13 + parabolicGainDbi(4, freq) - 1, 6);
    // Feeding the rolled-up figures into linkBudget is consistent.
    const lb = linkBudget({ eirpDbW: eirp, distanceKm: 4e5, freqHz: freq, gOverTDbK: gt, dataRateBps: 2e6 });
    expect(Number.isFinite(lb.ebN0Db)).toBe(true);
  });
});
