// The Cassini-at-Saturn viewer, refactored onto a state store + engine
// controller. This component is now presentational: it subscribes to slices of
// the store (useStore) and forwards user actions to the BesselEngine, which owns
// the scene, clock, SPICE worker, and the RAF loop. Body positions are still
// precomputed over the demo window so playback interpolates without per-frame
// worker round-trips.
import { useCallback, useRef } from 'react';
import { INNER_SYSTEM } from '@bessel/scene';
import {
  CaptureControls,
  KeyboardHelp,
  ObjectBrowser,
  ReadoutPanel,
  SettingsPanel,
  TimelineControls,
  ViewControls,
  useKeyboardShortcuts,
  type CatalogEntry,
  type KeyboardAction,
} from '@bessel/ui';
import { createAppStore, useStore, type AppStore } from './store/index.ts';
import { useBesselEngine } from './engine/index.ts';
import { CENTER_TARGETS } from './engine/constants.ts';

export function BesselViewer(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) storeRef.current = createAppStore();
  const store = storeRef.current;
  const engine = useBesselEngine(canvasRef, store);

  const status = useStore(store, (s) => s.status);
  const ready = useStore(store, (s) => s.ready);
  const playing = useStore(store, (s) => s.playing);
  const rate = useStore(store, (s) => s.rate);
  const et = useStore(store, (s) => s.et);
  const bounds = useStore(store, (s) => s.bounds);
  const epochLabel = useStore(store, (s) => s.epochLabel);
  const focus = useStore(store, (s) => s.focus);
  const instruments = useStore(store, (s) => s.instruments);
  const footprintPoints = useStore(store, (s) => s.footprintPoints);
  const fovOk = useStore(store, (s) => s.fovOk);
  const selection = useStore(store, (s) => s.selection);
  const track = useStore(store, (s) => s.track);
  const settings = useStore(store, (s) => s.settings);
  const visibility = useStore(store, (s) => s.visibility);
  const readouts = useStore(store, (s) => s.readouts);
  const helpOpen = useStore(store, (s) => s.helpOpen);
  const recording = useStore(store, (s) => s.recording);

  const onKeyboardAction = useCallback(
    (action: KeyboardAction): void => engine?.keyboardAction(action),
    [engine],
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
          onClick={() => engine?.toggleInstruments()}
          aria-pressed={instruments}
          data-testid="toggle-instruments"
        >
          {instruments ? 'Hide instruments' : 'Show instruments'}
        </button>
        <button
          type="button"
          onClick={() => engine?.toggleTrack()}
          aria-pressed={track}
          data-testid="toggle-track"
        >
          {track ? 'Stop tracking' : 'Track Cassini'}
        </button>
        <button type="button" onClick={() => void engine?.share()} data-testid="share">
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
          onToggleSelect={(id) => engine?.toggleSelectObject(id)}
          onToggleVisible={(id, visible) => engine?.toggleVisibleObject(id, visible)}
        />
        <SettingsPanel settings={settings} onChange={(k, v) => engine?.setSetting(k, v)} />
        <ReadoutPanel target={focus} readouts={readouts} />
        <CaptureControls
          recording={recording}
          onCaptureStill={() => engine?.captureStill()}
          onToggleRecording={() => engine?.toggleRecording()}
        />
      </div>
      <ViewControls bodies={CENTER_TARGETS} focus={focus} onCenter={(b) => engine?.centerOn(b)} />
      <TimelineControls
        playing={playing}
        rate={rate}
        epochLabel={epochLabel}
        min={bounds[0]}
        max={bounds[1]}
        value={et}
        annotations={annotations}
        onPlayToggle={() => engine?.togglePlay()}
        onRateChange={(r) => engine?.setRate(r)}
        onScrub={(v) => engine?.scrub(v)}
        onAnnotationSelect={(v) => engine?.scrub(v)}
      />
      <KeyboardHelp open={helpOpen} onClose={() => engine?.setHelpOpen(false)} />
      <button
        type="button"
        className="bessel-help-button"
        onClick={() => engine?.setHelpOpen(true)}
        aria-label="Keyboard shortcuts help"
        data-testid="help-button"
      >
        ?
      </button>
    </div>
  );
}
