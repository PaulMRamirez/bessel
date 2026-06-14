// The Phase 0 Cassini-at-Saturn viewer: loads kernels through pal-web, drives
// geometry from the SPICE worker, renders with @bessel/scene (camera-relative),
// and wires the timeline and camera controls. Body positions are precomputed over
// the demo window so playback interpolates without per-frame worker round-trips.
import { useEffect, useRef, useState } from 'react';
import { parseCosmographiaCatalog } from '@bessel/catalog';
import cassiniCatalog from '@bessel/catalog/examples/cassini';
import { createWebPlatform } from '@bessel/pal-web';
import { INNER_SYSTEM, SolarSystemScene, type Km3 } from '@bessel/scene';
import type { SpiceEngine } from '@bessel/spice';
import { Clock } from '@bessel/timeline';
import { TimelineControls, ViewControls } from '@bessel/ui';
import { KERNEL_ORDER, KERNEL_URLS } from './kernels.ts';
import { connectSpice } from './spice.ts';
import { positionAt, sampleEphemeris, trajectoryOf, type EphemerisTable } from './sampler.ts';
import {
  CASSINI_ISS_WAC,
  fovRim,
  footprint,
  loadInstrumentFov,
  type InstrumentFov,
} from './instruments.ts';

const STEPS = 120;
const CENTER_TARGETS = ['Sun', 'Earth', 'Jupiter', 'Saturn', 'Cassini'] as const;
// Scene units are 1e6 km. Distances frame each target: the Saturn and Cassini
// values show the orbit close-up, the others the heliocentric system.
const FOCUS_DISTANCE: Readonly<Record<string, number>> = {
  Sun: 2200,
  Earth: 320,
  Jupiter: 1200,
  Saturn: 0.45,
  Cassini: 0.35,
};

interface Engine {
  scene: SolarSystemScene;
  clock: Clock;
  table: EphemerisTable;
  spice: SpiceEngine;
  fov: InstrumentFov | null;
  raf: number;
  lastTs: number;
  labelAccum: number;
  instrumentAccum: number;
}

export function BesselViewer(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const playingRef = useRef(false);
  const rateRef = useRef(86400);
  const instrumentsRef = useRef(false);

  const [status, setStatus] = useState('Initializing');
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(86400);
  const [et, setEt] = useState(0);
  const [bounds, setBounds] = useState<[number, number]>([0, 1]);
  const [epochLabel, setEpochLabel] = useState('');
  const [focus, setFocus] = useState('Saturn');
  const [instruments, setInstruments] = useState(false);
  const [footprintPoints, setFootprintPoints] = useState(0);
  const [fovOk, setFovOk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;

    void (async () => {
      try {
        const spice = connectSpice();
        setStatus('Loading kernels');
        const platform = await createWebPlatform({ kernelUrls: KERNEL_URLS });
        for (const name of KERNEL_ORDER) {
          const handle = await platform.kernels.resolve(name);
          const bytes = await platform.kernels.read(handle);
          await spice.furnsh(name, bytes);
        }

        const sc = parseCosmographiaCatalog(cassiniCatalog);
        const rawEt0 = await spice.str2et(sc.startTime ?? '2004-06-21T00:00:00');
        const rawEt1 = await spice.str2et(sc.endTime ?? '2004-08-23T00:00:00');
        // The catalog window coincides with the Cassini SPK coverage boundaries;
        // inset slightly so interpolation always has data at the sampled epochs.
        const margin = 1800;
        const et0 = rawEt0 + margin;
        const et1 = rawEt1 - margin;

        setStatus('Sampling ephemerides');
        const bodies = [
          ...INNER_SYSTEM.map((p) => ({ name: p.name, spiceId: p.spiceId })),
          { name: 'Cassini', spiceId: sc.spiceId },
        ];
        const table = await sampleEphemeris(spice, bodies, et0, et1, STEPS);
        // Cassini orbit sampled in Saturn's frame so the trajectory shows the
        // orbit rather than Saturn's heliocentric drift.
        const orbit = await sampleEphemeris(
          spice,
          [{ name: 'Cassini', spiceId: sc.spiceId }],
          et0,
          et1,
          STEPS,
          sc.center,
        );
        if (disposed) return;

        const scene = new SolarSystemScene(canvas);
        scene.setBodies(INNER_SYSTEM);
        scene.setSpacecraft('Cassini');
        scene.setTrajectory(trajectoryOf(orbit, 'Cassini'), 'Saturn');
        scene.centerOn('Saturn');
        scene.setView(0.6, 0.35, FOCUS_DISTANCE['Saturn'] ?? 0.45);

        const fov = await loadInstrumentFov(spice, CASSINI_ISS_WAC).catch((err: unknown) => {
          console.error('getfov failed', err);
          return null;
        });
        setFovOk(!!fov);

        const clock = new Clock(et0, rateRef.current);
        const engine: Engine = {
          scene,
          clock,
          table,
          spice,
          fov,
          raf: 0,
          lastTs: 0,
          labelAccum: 0,
          instrumentAccum: 0,
        };
        engineRef.current = engine;
        setBounds([et0, et1]);
        setEt(et0);

        const frame = (ts: number): void => {
          const e = engineRef.current;
          if (!e) return;
          const dt = e.lastTs ? (ts - e.lastTs) / 1000 : 0;
          e.lastTs = ts;
          e.clock.setRate(rateRef.current);
          if (playingRef.current) e.clock.play();
          else e.clock.pause();
          e.clock.tick(dt);
          const now = e.clock.state.et;

          const positions = new Map<string, Km3>();
          for (const name of e.table.byBody.keys()) {
            positions.set(name, positionAt(e.table, name, now));
          }
          e.scene.setPositions(positions);

          // Sensor FOV cone (cheap, every frame) and footprint (throttled, async).
          if (instrumentsRef.current && e.fov) {
            const scPos = positionAt(e.table, 'Cassini', now);
            const satPos = positionAt(e.table, 'Saturn', now);
            e.scene.setFovCone(scPos, fovRim(scPos, satPos, e.fov));
            e.instrumentAccum += dt;
            if (e.instrumentAccum > 0.4) {
              e.instrumentAccum = 0;
              const fovRef = e.fov;
              void footprint(e.spice, now, fovRef).then(
                (pts) => {
                  if (!disposed && instrumentsRef.current) {
                    e.scene.setFootprint(pts, 'Saturn', '#ff33cc');
                    setFootprintPoints(pts.length);
                  }
                },
                (err: unknown) => console.error('footprint failed', err),
              );
            }
          }

          e.scene.render();

          if (playingRef.current) setEt(now);
          e.labelAccum += dt;
          if (e.labelAccum > 0.25) {
            e.labelAccum = 0;
            void spice.et2utc(now, 'ISOC', 0).then((utc) => {
              if (!disposed) setEpochLabel(utc);
            });
          }
          e.raf = requestAnimationFrame(frame);
        };
        engine.raf = requestAnimationFrame(frame);

        setStatus('Ready');
        setReady(true);
      } catch (err) {
        if (!disposed) setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
      }
    })();

    return () => {
      disposed = true;
      const e = engineRef.current;
      if (e) {
        cancelAnimationFrame(e.raf);
        e.scene.dispose();
      }
      engineRef.current = null;
    };
  }, []);

  // Pointer-drag orbit and wheel zoom.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dragging = false;
    let px = 0;
    let py = 0;
    const down = (ev: PointerEvent): void => {
      dragging = true;
      px = ev.clientX;
      py = ev.clientY;
    };
    const move = (ev: PointerEvent): void => {
      if (!dragging) return;
      const e = engineRef.current;
      if (!e) return;
      e.scene.orbitBy((ev.clientX - px) * 0.005, (ev.clientY - py) * 0.005);
      px = ev.clientX;
      py = ev.clientY;
    };
    const up = (): void => {
      dragging = false;
    };
    const wheel = (ev: WheelEvent): void => {
      ev.preventDefault();
      engineRef.current?.scene.zoomBy(ev.deltaY > 0 ? 1.1 : 0.9);
    };
    canvas.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => {
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      canvas.removeEventListener('wheel', wheel);
    };
  }, []);

  const onCenter = (body: string): void => {
    setFocus(body);
    const e = engineRef.current;
    if (!e) return;
    e.scene.centerOn(body);
    e.scene.setView(0.6, 0.35, FOCUS_DISTANCE[body] ?? 600);
  };

  const onScrub = (value: number): void => {
    setEt(value);
    engineRef.current?.clock.setEpoch(value);
  };

  const onToggleInstruments = (): void => {
    const next = !instruments;
    setInstruments(next);
    instrumentsRef.current = next;
    const e = engineRef.current;
    if (e && !next) {
      // Clear the FOV cone and footprint when instruments are turned off.
      e.scene.setFovCone([0, 0, 0], []);
      e.scene.setFootprint([], 'Saturn');
      setFootprintPoints(0);
    }
  };

  return (
    <div className="bessel-viewer">
      <canvas
        ref={canvasRef}
        id="viewport"
        aria-label="3D viewport"
        width={960}
        height={600}
        data-ready={ready}
        data-footprint-points={footprintPoints}
        data-fov={fovOk ? '1' : '0'}
        data-testid="viewport"
      />
      <div className="bessel-hud" data-testid="status">
        {status}
      </div>
      <div className="bessel-viewcontrols" role="group" aria-label="Instruments">
        <button
          type="button"
          onClick={onToggleInstruments}
          aria-pressed={instruments}
          data-testid="toggle-instruments"
        >
          {instruments ? 'Hide instruments' : 'Show instruments'}
        </button>
      </div>
      <ViewControls bodies={CENTER_TARGETS} focus={focus} onCenter={onCenter} />
      <TimelineControls
        playing={playing}
        rate={rate}
        epochLabel={epochLabel}
        min={bounds[0]}
        max={bounds[1]}
        value={et}
        onPlayToggle={() => {
          const next = !playing;
          setPlaying(next);
          playingRef.current = next;
        }}
        onRateChange={(r) => {
          setRate(r);
          rateRef.current = r;
        }}
        onScrub={onScrub}
      />
    </div>
  );
}
