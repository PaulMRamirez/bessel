// The Phase 0 Three.js scene: textured inner-solar-system globes, a spacecraft
// trajectory polyline, and a moving spacecraft marker, with camera-relative
// (floating-origin) rendering. Body positions arrive as kilometres relative to
// the Sun; every frame the whole world group is translated by minus the focus
// position so the matrices the GPU sees stay small near the focus, defeating
// float32 jitter at solar-system distances (mandatory, CLAUDE.md).

import {
  AmbientLight,
  BufferGeometry,
  Color,
  DataTexture,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  RGBAFormat,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { PlanetDef } from './planets.ts';

const KM_PER_UNIT = 1_000_000;
const SCALE = 1 / KM_PER_UNIT;

export type Km3 = readonly [number, number, number];

function bodyTexture(color: readonly [number, number, number]): DataTexture {
  const w = 32;
  const h = 16;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Latitude banding plus a little longitudinal variation, so globes read as
      // surfaces rather than flat discs without bundling image assets.
      const band = 0.85 + 0.15 * Math.sin((y / h) * Math.PI * 6);
      const lon = 0.92 + 0.08 * Math.sin((x / w) * Math.PI * 4);
      const k = band * lon;
      const i = (y * w + x) * 4;
      data[i] = Math.min(255, color[0] * 255 * k);
      data[i + 1] = Math.min(255, color[1] * 255 * k);
      data[i + 2] = Math.min(255, color[2] * 255 * k);
      data[i + 3] = 255;
    }
  }
  const tex = new DataTexture(data, w, h, RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

// Bodies are kept at true scale; this fraction of the camera-to-body distance is
// the floor on apparent radius so distant planets never collapse to sub-pixel.
const MIN_APPARENT = 0.012;

interface BodyNode {
  readonly def: PlanetDef;
  readonly mesh: Mesh;
  /** True radius in scene units. */
  readonly radius: number;
}

export class SolarSystemScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly world = new Group();
  private readonly bodies = new Map<string, BodyNode>();
  private readonly positions = new Map<string, Km3>();
  private spacecraft: { name: string; mesh: Mesh; radius: number } | null = null;
  private trajectory: Line | null = null;
  private trajectoryAnchor = 'Sun';

  private focus = 'Sun';
  private azimuth = 0.6;
  private elevation = 0.35;
  private distance = 3000;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setClearColor(new Color('#05070b'), 1);
    this.camera = new PerspectiveCamera(45, canvas.width / Math.max(1, canvas.height), 0.01, 1e7);
    this.scene.add(this.world);
    this.scene.add(new AmbientLight(0xffffff, 0.55));
    const sun = new PointLight(0xfff4e0, 2.2, 0, 0.0);
    this.world.add(sun);
    this.resize(canvas.width, canvas.height);
  }

  setBodies(defs: readonly PlanetDef[]): void {
    for (const def of defs) {
      const material = new MeshStandardMaterial({
        map: bodyTexture(def.color),
        emissive: new Color(...def.color),
        emissiveIntensity: def.name === 'Sun' ? 0.9 : 0.08,
        roughness: 0.9,
        metalness: 0.0,
      });
      const radius = def.radiusKm * SCALE;
      const mesh = new Mesh(new SphereGeometry(radius, 32, 16), material);
      this.bodies.set(def.name, { def, mesh, radius });
      this.world.add(mesh);
    }
  }

  setSpacecraft(name: string, radiusKm = 200): void {
    const material = new MeshStandardMaterial({
      color: new Color('#e6e9ef'),
      emissive: new Color('#9fb4ff'),
      emissiveIntensity: 0.6,
    });
    const radius = radiusKm * SCALE;
    const mesh = new Mesh(new SphereGeometry(radius, 12, 8), material);
    this.spacecraft = { name, mesh, radius };
    this.world.add(mesh);
  }

  /**
   * Set the trajectory polyline. Points are km relative to anchorBody, and the
   * line is positioned at the anchor body every frame, so a spacecraft orbit
   * sampled in its central body's frame stays attached to that body.
   */
  setTrajectory(points: readonly Km3[], anchorBody = 'Sun'): void {
    this.trajectoryAnchor = anchorBody;
    if (this.trajectory) {
      this.world.remove(this.trajectory);
      this.trajectory.geometry.dispose();
    }
    const coords = new Float32Array(points.length * 3);
    points.forEach((p, i) => {
      coords[i * 3] = p[0] * SCALE;
      coords[i * 3 + 1] = p[1] * SCALE;
      coords[i * 3 + 2] = p[2] * SCALE;
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(coords, 3));
    this.trajectory = new Line(geometry, new LineBasicMaterial({ color: new Color('#5b8cff') }));
    this.world.add(this.trajectory);
  }

  /** Update body and spacecraft positions (km relative to the Sun). */
  setPositions(positions: ReadonlyMap<string, Km3>): void {
    for (const [name, pos] of positions) {
      this.positions.set(name, pos);
      const node = this.bodies.get(name);
      if (node) node.mesh.position.set(pos[0] * SCALE, pos[1] * SCALE, pos[2] * SCALE);
      if (this.spacecraft && this.spacecraft.name === name) {
        this.spacecraft.mesh.position.set(pos[0] * SCALE, pos[1] * SCALE, pos[2] * SCALE);
      }
    }
  }

  centerOn(name: string): void {
    if (this.bodies.has(name) || this.spacecraft?.name === name) this.focus = name;
  }

  get focusBody(): string {
    return this.focus;
  }

  orbitBy(dAzimuth: number, dElevation: number): void {
    this.azimuth += dAzimuth;
    const limit = Math.PI / 2 - 0.05;
    this.elevation = Math.max(-limit, Math.min(limit, this.elevation + dElevation));
  }

  zoomBy(factor: number): void {
    this.distance = Math.max(0.5, Math.min(5e6, this.distance * factor));
  }

  setView(azimuth: number, elevation: number, distance: number): void {
    this.azimuth = azimuth;
    this.elevation = elevation;
    this.distance = distance;
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    const focusPos = this.positions.get(this.focus) ?? [0, 0, 0];
    this.world.position.set(-focusPos[0] * SCALE, -focusPos[1] * SCALE, -focusPos[2] * SCALE);

    if (this.trajectory) {
      const anchor = this.positions.get(this.trajectoryAnchor) ?? [0, 0, 0];
      this.trajectory.position.set(anchor[0] * SCALE, anchor[1] * SCALE, anchor[2] * SCALE);
    }

    const ce = Math.cos(this.elevation);
    this.camera.position.set(
      this.distance * ce * Math.cos(this.azimuth),
      this.distance * Math.sin(this.elevation),
      this.distance * ce * Math.sin(this.azimuth),
    );
    this.camera.lookAt(new Vector3(0, 0, 0));

    // Enforce a minimum apparent size so distant bodies stay visible while the
    // close-up keeps true proportions.
    const cam = this.camera.position;
    const apply = (mesh: Mesh, radius: number): void => {
      const dx = this.world.position.x + mesh.position.x - cam.x;
      const dy = this.world.position.y + mesh.position.y - cam.y;
      const dz = this.world.position.z + mesh.position.z - cam.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const floor = dist * MIN_APPARENT;
      mesh.scale.setScalar(radius > 0 ? Math.max(1, floor / radius) : 1);
    };
    for (const node of this.bodies.values()) apply(node.mesh, node.radius);
    if (this.spacecraft) apply(this.spacecraft.mesh, this.spacecraft.radius);

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
