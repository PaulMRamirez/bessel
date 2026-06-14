// View URL fragment codec (SPEC 5.5, ADR-0008 Section 1). Canonical form:
//   v=1&t=<utc>&cam=<mode>:<target>:<dist,az,el>&sel=<id,...>&vis=<k:0|1,...>&plugins=<id,...>
// Values are percent-encoded, so the ':' and ',' delimiters never collide with
// content. encode then decode is the identity (asserted by a property test).

import { VIEW_VERSION, type CameraMode, type CameraPose, type ViewModel } from './index.ts';

const MODES: readonly CameraMode[] = ['orbit', 'center', 'track'];

function encodeCamera(c: CameraPose): string {
  const target = c.target === undefined ? '' : encodeURIComponent(c.target);
  return `${c.mode}:${target}:${c.distance},${c.azimuth},${c.elevation}`;
}

function decodeCamera(raw: string): CameraPose {
  const [mode, target, pose = ''] = raw.split(':');
  const [d, az, el] = pose.split(',');
  const m = MODES.includes(mode as CameraMode) ? (mode as CameraMode) : 'orbit';
  const camera: CameraPose = {
    mode: m,
    distance: Number(d),
    azimuth: Number(az),
    elevation: Number(el),
  };
  return target ? { ...camera, target: decodeURIComponent(target) } : camera;
}

function encodeVisibility(vis: Readonly<Record<string, boolean>>): string {
  return Object.entries(vis)
    .map(([k, v]) => `${encodeURIComponent(k)}:${v ? 1 : 0}`)
    .join(',');
}

function decodeVisibility(raw: string): Record<string, boolean> {
  // Null-prototype object so a "__proto__" flag round-trips as an own property and
  // a hostile URL cannot pollute Object.prototype (URLs are untrusted input).
  const out = Object.create(null) as Record<string, boolean>;
  if (!raw) return out;
  for (const pair of raw.split(',')) {
    const idx = pair.lastIndexOf(':');
    if (idx < 0) continue;
    out[decodeURIComponent(pair.slice(0, idx))] = pair.slice(idx + 1) === '1';
  }
  return out;
}

const encodeList = (ids: readonly string[]): string => ids.map(encodeURIComponent).join(',');
// Presence of the key, not emptiness of the value, decides an empty list: a key
// present with an empty value encodes a single empty-string element.
const decodeList = (raw: string): string[] => raw.split(',').map(decodeURIComponent);

/** Encode a view to a URL fragment (no leading '#'). */
export function encodeView(view: ViewModel): string {
  const parts = [
    `v=${VIEW_VERSION}`,
    `t=${encodeURIComponent(view.t)}`,
    `cam=${encodeCamera(view.camera)}`,
  ];
  if (view.selection.length) parts.push(`sel=${encodeList(view.selection)}`);
  const vis = encodeVisibility(view.visibility);
  if (vis) parts.push(`vis=${vis}`);
  if (view.plugins.length) parts.push(`plugins=${encodeList(view.plugins)}`);
  return parts.join('&');
}

/** Decode a URL fragment (with or without a leading '#') back to a view. */
export function decodeView(fragment: string): ViewModel {
  const frag = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  const params = new Map<string, string>();
  for (const part of frag.split('&')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    params.set(part.slice(0, idx), part.slice(idx + 1));
  }
  const cam = params.get('cam');
  const sel = params.get('sel');
  const plugins = params.get('plugins');
  return {
    t: decodeURIComponent(params.get('t') ?? ''),
    camera: cam ? decodeCamera(cam) : { mode: 'orbit', distance: 1, azimuth: 0, elevation: 0 },
    selection: sel === undefined ? [] : decodeList(sel),
    visibility: decodeVisibility(params.get('vis') ?? ''),
    plugins: plugins === undefined ? [] : decodeList(plugins),
  };
}
