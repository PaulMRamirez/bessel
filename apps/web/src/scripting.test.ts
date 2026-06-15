// Item 6 (scripting API): BesselScript translates chainable cosmoscripting-style
// verbs into ScriptHost calls in order, so a guided tour drives the viewer.

import { describe, it, expect } from 'vitest';
import { BesselScript, type ScriptHost } from './scripting.ts';

function recordingHost(): { host: ScriptHost; calls: string[] } {
  const calls: string[] = [];
  const host: ScriptHost = {
    gotoObject: (name) => calls.push(`goto:${name}`),
    select: (ids) => calls.push(`select:${ids.join(',')}`),
    setRate: (rate) => calls.push(`rate:${rate}`),
    setPlaying: (playing) => calls.push(`playing:${playing}`),
    setTime: (et) => calls.push(`time:${et}`),
    viewFromSun: () => calls.push('viewSun'),
    viewAlongVelocity: () => calls.push('viewVel'),
  };
  return { host, calls };
}

describe('BesselScript', () => {
  it('drives a tour as an ordered sequence of host calls and is chainable', () => {
    const { host, calls } = recordingHost();
    const script = new BesselScript(host);
    const returned = script
      .gotoObject('Saturn')
      .setTimeRate(3600)
      .play()
      .setTime(123)
      .select('Saturn', 'Titan')
      .viewFromSun()
      .viewAlongVelocity()
      .pause();
    expect(returned).toBe(script);
    expect(calls).toEqual([
      'goto:Saturn',
      'rate:3600',
      'playing:true',
      'time:123',
      'select:Saturn,Titan',
      'viewSun',
      'viewVel',
      'playing:false',
    ]);
  });

  it('maps play and unpause to the same playing=true action', () => {
    const { host, calls } = recordingHost();
    new BesselScript(host).unpause();
    expect(calls).toEqual(['playing:true']);
  });
});
