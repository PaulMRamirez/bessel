// The Phase 0 Cassini-at-Saturn viewer: loads kernels through pal-web, drives
// geometry from the SPICE worker, renders with @bessel/scene (camera-relative),
// and wires the timeline and camera controls. Body positions are precomputed over
// the demo window so playback interpolates without per-frame worker round-trips.
import { useCallback, useEffect, useRef, useState } from 'react';
import { parseCosmographiaCatalog } from '@bessel/catalog';
import cassiniCatalog from '@bessel/catalog/examples/cassini';
import { createWebPlatform } from '@bessel/pal-web';
import {
  INNER_SYSTEM,
  SolarSystemScene,
  loadSpacecraftModel,
  parseStarCatalog,
  type Km3,
} from '@bessel/scene';
import type { SpiceEngine } from '@bessel/spice';
import cassiniGltf from './assets/cassini.gltf?raw';
import brightStars from './assets/bright-stars.json';
import { Clock } from '@bessel/timeline';
import { decodeView, encodeView, type ViewModel } from '@bessel/state';
import {
  CaptureControls,
  KeyboardHelp,
  ObjectBrowser,
  ReadoutPanel,
  SettingsPanel,
  TimelineControls,
  ViewControls,
  captureStill,
  downloadBlob,
  startRecording,
  useKeyboardShortcuts,
  type CatalogEntry,
  type KeyboardAction,
  type Readouts,
  type Recorder,
  type SettingKey,
  type VisualizationSettings,
} from '@bessel/ui';
import { computeReadouts } from './readouts.ts';
import { toggleSelection } from './selection.ts';
import { KERNEL_ORDER, KERNEL_URLS } from './kernels.ts';
import { connectSpice } from './spice.ts';
import {
  positionAt,
  sampleEphemeris,
  trajectoryOf,
  velocityAt,
  type EphemerisTable,
} from './sampler.ts';
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
  readoutAccum: number;
}

export function BesselViewer(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const playingRef = useRef(false);
  const rateRef = useRef(86400);
  const instrumentsRef = useRef(false);
  const trackRef = useRef(false);

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
  const [selection, setSelection] = useState<readonly string[]>([]);
  const [track, setTrack] = useState(false);
  const [settings, setSettings] = useState<VisualizationSettings>({
    trajectory: true,
    fov: true,
    footprint: true,
    axes: true,
    stars: true,
    atmosphere: false,
    shadows: false,
  });
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [readouts, setReadouts] = useState<Readouts>({
    rangeKm: null,
    phaseDeg: null,
    incidenceDeg: null,
    emissionDeg: null,
  });
  const [helpOpen, setHelpOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<Recorder | null>(null);

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

        // Star field, Saturn rings, body-fixed axis triad, and the GLTF spacecraft.
        try {
          scene.setStarField(parseStarCatalog(brightStars));
        } catch (err) {
          console.error('star field failed', err);
        }
        const saturnRot = await spice.pxform('IAU_SATURN', 'J2000', et0);
        scene.setRings('Saturn', 74500, 140220, saturnRot);
        scene.setAxisTriad('saturn-axes', 'Saturn', saturnRot, 120000);
        // Atmosphere shell around Saturn (toggled via the settings panel).
        const sunDir = positionAt(table, 'Saturn', et0);
        scene.setAtmosphere('Saturn', 60268, 66000, {
          sunDirection: [-sunDir[0], -sunDir[1], -sunDir[2]],
        });
        scene.setAtmosphereVisible(false);
        // Direction to the Sun from Cassini (the Sun sits at the heliocentric origin).
        const sc0 = positionAt(table, 'Cassini', et0);
        scene.setDirectionVectors(
          'Cassini',
          [{ label: 'to-Sun', dirKm: [-sc0[0], -sc0[1], -sc0[2]], color: 0xffd27f }],
          200000,
        );
        try {
          scene.setSpacecraftModel(await loadSpacecraftModel(cassiniGltf, 200));
        } catch (err) {
          console.error('spacecraft model load failed', err);
        }

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
          readoutAccum: 0,
        };
        engineRef.current = engine;
        setBounds([et0, et1]);
        setEt(et0);

        // Reconstruct a shared view from the URL fragment, if present.
        if (window.location.hash.length > 1) {
          try {
            const view = decodeView(window.location.hash);
            if (view.t) {
              const sharedEt = await spice.str2et(view.t.replace('Z', ''));
              clock.setEpoch(sharedEt);
              setEt(sharedEt);
            }
            if (view.camera.target) scene.centerOn(view.camera.target);
            scene.setView(view.camera.azimuth, view.camera.elevation, view.camera.distance);
            setFocus(view.camera.target ?? scene.focusBody);
            setSelection(view.selection);
          } catch (err) {
            console.error('failed to apply shared view', err);
          }
        }

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

          // Track-along-trajectory camera: follow Cassini down its velocity.
          if (trackRef.current) {
            e.scene.setFocusVelocity(velocityAt(e.table, 'Cassini', now));
            e.scene.setCameraMode('track');
          } else {
            e.scene.setCameraMode('orbit');
          }

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
          // Geometry readouts for the focused body, relative to Cassini.
          e.readoutAccum += dt;
          if (e.readoutAccum > 0.3) {
            e.readoutAccum = 0;
            const focusName = e.scene.focusBody;
            if (focusName !== 'Cassini') {
              void computeReadouts(spice, focusName, focusName, now, '-82').then((r) => {
                if (!disposed) setReadouts(r);
              });
            }
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
    setSelection([body]);
    const e = engineRef.current;
    if (!e) return;
    e.scene.centerOn(body);
    e.scene.setView(0.6, 0.35, FOCUS_DISTANCE[body] ?? 600);
  };

  const onShare = async (): Promise<void> => {
    const e = engineRef.current;
    if (!e) return;
    const v = e.scene.getView();
    const utc = await e.spice.et2utc(e.clock.state.et, 'ISOC', 3);
    const view: ViewModel = {
      t: `${utc}Z`,
      camera: {
        mode: 'center',
        target: v.focus,
        distance: v.distance,
        azimuth: v.azimuth,
        elevation: v.elevation,
      },
      selection,
      visibility: {},
      plugins: [],
    };
    window.location.hash = encodeView(view);
    try {
      await navigator.clipboard?.writeText(window.location.href);
    } catch {
      // Clipboard may be unavailable; the URL hash is still updated.
    }
  };

  const onScrub = (value: number): void => {
    setEt(value);
    engineRef.current?.clock.setEpoch(value);
  };

  const onToggleTrack = (): void => {
    const next = !track;
    setTrack(next);
    trackRef.current = next;
    if (next) onCenter('Cassini');
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

  const togglePlay = (): void => {
    const next = !playingRef.current;
    setPlaying(next);
    playingRef.current = next;
  };

  const changeRate = (r: number): void => {
    setRate(r);
    rateRef.current = r;
  };

  const stepRate = (dir: -1 | 1): void => {
    const rates = [1, 60, 3600, 86400, 604800];
    const idx = rates.indexOf(rateRef.current);
    changeRate(rates[Math.max(0, Math.min(rates.length - 1, idx + dir))]!);
  };

  const onSettingChange = (key: SettingKey, value: boolean): void => {
    setSettings((s) => ({ ...s, [key]: value }));
    const s = engineRef.current?.scene;
    if (!s) return;
    if (key === 'trajectory') s.setTrajectoryVisible(value);
    else if (key === 'fov') s.setFovVisible(value);
    else if (key === 'footprint') s.setFootprintVisible(value);
    else if (key === 'axes') s.setAxesVisible(value);
    else if (key === 'stars') s.setStarFieldVisible(value);
    else if (key === 'atmosphere') s.setAtmosphereVisible(value);
    else if (key === 'shadows' && value) s.enableShadows(60268);
  };

  const onToggleSelectObject = (id: string): void => {
    setSelection((sel) => toggleSelection(sel, id));
  };

  const onToggleVisibleObject = (id: string, visible: boolean): void => {
    setVisibility((v) => ({ ...v, [id]: visible }));
    engineRef.current?.scene.setVisible(id, visible);
  };

  const onCaptureStill = (): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    void captureStill(canvas)
      .then((blob) => downloadBlob(blob, 'bessel.png'))
      .catch((err: unknown) => console.error('capture failed', err));
  };

  const onToggleRecording = (): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (recorderRef.current) {
      void recorderRef.current.stop().then((blob) => downloadBlob(blob, 'bessel.webm'));
      recorderRef.current = null;
      setRecording(false);
    } else {
      try {
        recorderRef.current = startRecording(canvas);
        setRecording(true);
      } catch (err) {
        console.error('recording failed', err);
      }
    }
  };

  const onKeyboardAction = useCallback(
    (action: KeyboardAction): void => {
      const e = engineRef.current;
      if (!e) return;
      if (action.type === 'playToggle') togglePlay();
      else if (action.type === 'scrub') {
        const step = (bounds[1] - bounds[0]) / 200;
        const next = e.clock.state.et + action.direction * step;
        onScrub(Math.max(bounds[0], Math.min(bounds[1], next)));
      } else if (action.type === 'rate') stepRate(action.direction);
      else if (action.type === 'center') {
        if (selection[0]) onCenter(selection[0]);
      } else if (action.type === 'help') setHelpOpen((o) => !o);
    },
    [bounds, selection],
  );
  useKeyboardShortcuts(onKeyboardAction);

  const objectEntries: CatalogEntry[] = [
    ...INNER_SYSTEM.map((p) => ({ id: p.name, name: p.name, kind: 'body' as const })),
    { id: 'Cassini', name: 'Cassini', kind: 'spacecraft' },
    { id: 'CASSINI_ISS_WAC', name: 'ISS Wide Angle', kind: 'instrument' },
  ];
  const annotations =
    bounds[1] > bounds[0]
      ? [
          {
            id: 'soi',
            et: bounds[0] + 0.15 * (bounds[1] - bounds[0]),
            label: 'Saturn orbit insertion',
          },
        ]
      : [];

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
        data-cam-target={focus}
        data-cam-mode={track ? 'track' : 'orbit'}
        data-selection={selection.join(',')}
        data-epoch={epochLabel}
        data-testid="viewport"
      />
      <div className="bessel-hud" data-testid="status">
        {status}
      </div>
      <div className="bessel-viewcontrols" role="group" aria-label="Instruments and sharing">
        <button
          type="button"
          onClick={onToggleInstruments}
          aria-pressed={instruments}
          data-testid="toggle-instruments"
        >
          {instruments ? 'Hide instruments' : 'Show instruments'}
        </button>
        <button
          type="button"
          onClick={onToggleTrack}
          aria-pressed={track}
          data-testid="toggle-track"
        >
          {track ? 'Stop tracking' : 'Track Cassini'}
        </button>
        <button type="button" onClick={() => void onShare()} data-testid="share">
          Share view
        </button>
        <span className="bessel-selection" data-testid="selection-label">
          {selection.length ? `Selected: ${selection.join(', ')}` : 'No selection'}
        </span>
      </div>
      <div className="bessel-panels">
        <ObjectBrowser
          entries={objectEntries}
          selection={selection}
          visibility={visibility}
          onToggleSelect={onToggleSelectObject}
          onToggleVisible={onToggleVisibleObject}
        />
        <SettingsPanel settings={settings} onChange={onSettingChange} />
        <ReadoutPanel target={focus} readouts={readouts} />
        <CaptureControls
          recording={recording}
          onCaptureStill={onCaptureStill}
          onToggleRecording={onToggleRecording}
        />
      </div>
      <ViewControls bodies={CENTER_TARGETS} focus={focus} onCenter={onCenter} />
      <TimelineControls
        playing={playing}
        rate={rate}
        epochLabel={epochLabel}
        min={bounds[0]}
        max={bounds[1]}
        value={et}
        annotations={annotations}
        onPlayToggle={togglePlay}
        onRateChange={changeRate}
        onScrub={onScrub}
        onAnnotationSelect={onScrub}
      />
      <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <button
        type="button"
        className="bessel-help-button"
        onClick={() => setHelpOpen(true)}
        aria-label="Keyboard shortcuts help"
        data-testid="help-button"
      >
        ?
      </button>
    </div>
  );
}
