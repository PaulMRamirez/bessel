// Item 6 (scripting API): BesselScript translates chainable cosmoscripting-style
// verbs into ScriptHost calls in order, so a guided tour drives the viewer.

import { describe, it, expect } from 'vitest';
import { BesselScript, type ScriptHost } from './scripting.ts';

function recordingHost(): { host: ScriptHost; calls: string[] } {
  const calls: string[] = [];
  const host: ScriptHost = {
    gotoObject: (name) => calls.push(`goto:${name}`),
    gotoHome: () => calls.push('home'),
    select: (ids) => calls.push(`select:${ids.join(',')}`),
    setRate: (rate) => calls.push(`rate:${rate}`),
    setPlaying: (playing) => calls.push(`playing:${playing}`),
    setTime: (et) => calls.push(`time:${et}`),
    getTime: () => {
      calls.push('getTime');
      return 42;
    },
    track: (name) => calls.push(`track:${name}`),
    untrack: () => calls.push('untrack'),
    setFrame: (mode) => calls.push(`frame:${mode}`),
    setLayer: (key, on) => calls.push(`layer:${key}:${on}`),
    setObjectVisible: (id, visible) => calls.push(`vis:${id}:${visible}`),
    screenshot: () => calls.push('shot'),
    toggleRecording: (on) => calls.push(`rec:${on}`),
    note: (text) => calls.push(`note:${text}`),
    loadCatalog: (url) => calls.push(`load:${url}`),
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

  it('delegates the parity verbs to the host in order', () => {
    const { host, calls } = recordingHost();
    const script = new BesselScript(host);
    const returned = script
      .gotoHome()
      .track('Cassini')
      .untrack()
      .setFrame('sync')
      .show('orbits')
      .hide('labels')
      .showObject('Titan')
      .hideObject('Earth')
      .screenshot()
      .record()
      .stopRecord()
      .note('hello')
      .displayNote('again')
      .loadCatalog('/samples/x.json');
    expect(returned).toBe(script);
    expect(calls).toEqual([
      'home',
      'track:Cassini',
      'untrack',
      'frame:sync',
      'layer:orbits:true',
      'layer:labels:false',
      'vis:Titan:true',
      'vis:Earth:false',
      'shot',
      'rec:true',
      'rec:false',
      'note:hello',
      'note:again',
      'load:/samples/x.json',
    ]);
  });

  it('reads the current time through the host', () => {
    const { host, calls } = recordingHost();
    expect(new BesselScript(host).getTime()).toBe(42);
    expect(calls).toEqual(['getTime']);
  });
});
