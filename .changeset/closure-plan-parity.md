---
"@bessel/catalog": minor
"@bessel/color": minor
"@bessel/pal": minor
"@bessel/pal-capacitor": minor
"@bessel/pal-electron": minor
"@bessel/pal-web": minor
"@bessel/scene": minor
"@bessel/spice": minor
"@bessel/state": minor
"@bessel/timeline": minor
"@bessel/ui": minor
"@bessel/desktop": minor
"@bessel/mobile": minor
"@bessel/web": minor
---

Close the Cosmographia parity gaps in docs/PARITY_MATRIX.md.

- Arbitrary-mission load: a native catalog now rebuilds the rendered 3D scene
  generically (catalog-driven bodies, spacecraft, trajectory, and the seven
  geometry types), with an OPFS kernel-upload path, replacing the bundled
  Cassini-only demo.
- Rendering fidelity: bodies and rings support image base-maps and normal maps
  (procedural fallback retained); spacecraft attitude is driven from a CK frame
  via pxform when a CK is loaded.
- Analysis: range rate (km/s) in the measure panel, surface-altitude readout,
  and a vector-to-set-view camera control.
- Scripting and extensibility: a scripting API over the engine, a typed mission
  plugin registry, and a telemetry adapter for predicted-versus-actual overlays.
