// Scripting API (item 6, Cosmographia cosmoscripting parity). A small, chainable
// facade that drives the viewer (camera, time, selection) from code, for demos,
// guided tours, and deterministic e2e setups. BesselScript depends only on a
// narrow ScriptHost, so its verbs are unit-testable with a recording mock; the
// concrete host is assembled from the engine and store by createScriptHost.

import type { BesselEngine } from './engine/index.ts';
import type { AppStore } from './store/index.ts';

export interface ScriptHost {
  gotoObject(name: string): void;
  select(ids: readonly string[]): void;
  setRate(rate: number): void;
  setPlaying(playing: boolean): void;
  setTime(et: number): void;
  viewFromSun(): void;
  viewAlongVelocity(): void;
}

/**
 * Chainable scripting surface, mirroring the Cosmographia cosmoscripting verbs
 * (gotoObject, setTime, setTimeRate, pause/unpause, plus camera vectors). Each
 * method returns this so a tour reads as a sequence of calls.
 */
export class BesselScript {
  constructor(private readonly host: ScriptHost) {}

  /** Center the camera on a body or the spacecraft by name. */
  gotoObject(name: string): this {
    this.host.gotoObject(name);
    return this;
  }

  /** Select one or more objects (drives measurement and the inspector). */
  select(...ids: string[]): this {
    this.host.select(ids);
    return this;
  }

  /** Set the playback rate (simulated seconds per wall-clock second). */
  setTimeRate(rate: number): this {
    this.host.setRate(rate);
    return this;
  }

  pause(): this {
    this.host.setPlaying(false);
    return this;
  }

  unpause(): this {
    this.host.setPlaying(true);
    return this;
  }

  /** Alias for unpause, matching the cosmoscripting verb. */
  play(): this {
    return this.unpause();
  }

  /** Jump the clock to an ephemeris time (TDB seconds). */
  setTime(et: number): this {
    this.host.setTime(et);
    return this;
  }

  /** Look from the Sun toward the focus (vector-set-view). */
  viewFromSun(): this {
    this.host.viewFromSun();
    return this;
  }

  /** Look down the spacecraft velocity. */
  viewAlongVelocity(): this {
    this.host.viewAlongVelocity();
    return this;
  }
}

/** Build a ScriptHost backed by the live engine and store. */
export function createScriptHost(engine: BesselEngine, store: AppStore): ScriptHost {
  return {
    gotoObject: (name) => engine.centerOn(name),
    select: (ids) => store.setState({ selection: [...ids] }),
    setRate: (rate) => engine.setRate(rate),
    setPlaying: (playing) => store.setState({ playing }),
    setTime: (et) => engine.scrub(et),
    viewFromSun: () => engine.viewFromSun(),
    viewAlongVelocity: () => engine.viewAlongVelocity(),
  };
}

/** Convenience: a BesselScript wired to the engine and store. */
export function createScript(engine: BesselEngine, store: AppStore): BesselScript {
  return new BesselScript(createScriptHost(engine, store));
}
