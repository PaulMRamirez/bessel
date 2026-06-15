# Bessel Gap Analysis

Status: Draft v1.0
Date: 2026-06-07

This document inventories what already exists (Cosmographia, the CSPICE-WASM
prior art, the rendering ecosystem, the tri-target tooling, and Paul's adjacent
systems), states the gap between each and Bessel's requirements, and names
what Bessel must build. It is the evidence base for the scope in SPEC.md.

For the auditable, feature-by-feature parity check (verified against the live
cosmoguide.org and against the code, with a prioritized closure plan), see
docs/PARITY_MATRIX.md.

---

## 1. SPICE-Enhanced Cosmographia (the incumbent)

What it is: NASA/JPL's SPICE-aware desktop visualization tool (C++/Qt), the
reference for mission geometry visualization. Source exists at
github.com/claurel/cosmographia; the User's Guide is at cosmoguide.org.

What it does well:
- Full, mature geometry taxonomy: Mesh, DSK, Globe, Rings, ParticleSystem,
  KeplerianSwarm, TimeSwitched, plus annotations.
- Direct CSPICE integration; correct geometry; trusted in operations.
- Mission extension precedent: the JUICE ESA plugin shows mission-specific
  modules are viable.
- Python scripting (resolved on Windows in version 4.2, December 2022).

Where it falls short, and the resulting Bessel gap:

| Cosmographia limitation                          | Bessel must provide                                  |
| ------------------------------------------------ | ------------------------------------------------------- |
| Desktop only; no web, no mobile                  | One codebase shipping PWA + Capacitor + Electron        |
| Per-sensor-per-target catalog file explosion     | Collapsed instrument schema with a targets array        |
| Silent "jump to the Sun" on missing references   | Explicit, located, actionable errors                    |
| No shareable view state                          | URL-serialized views (epoch, camera, selection, plugins)|
| Source published but not a living OSS project    | Apache-2.0, governed, contribution path, plugin surface |
| No operations integrations                       | MMGIS deep links, CZML export, telemetry overlays       |

Net: Cosmographia defines the capability bar for geometry. Bessel clears that
bar on the web and on mobile, fixes the catalog and failure-mode problems, and
adds the shareability and integration surface a multi-mission enterprise needs.

---

## 2. CSPICE to WebAssembly (the enabling prior art)

What exists: github.com/arturania/cspice compiles CSPICE to WebAssembly via
Emscripten, with a working React integration pattern using Web Workers. Binary
kernels (SPK, CK, DSK, PCK) and text kernels (FK, IK, LSK, SCLK) load.

Gap:
- The fork must be updated to a current CSPICE toolkit version.
- Only the minimal function surface the renderer needs should be exposed and
  typed (the set in SPEC.md Section 5.1).
- Kernel bytes must arrive through the PAL `KernelSource`, not be read directly,
  so the same engine works across HTTP range requests, Capacitor paths, and the
  Electron filesystem.

What Bessel builds: @bessel/spice, a maintained, typed, Web-Worker-isolated
wrapper over a current CSPICE-WASM fork, decoupled from kernel transport.

Verdict: the hardest technical risk (SPICE in the browser) is already retired by
prior art. Bessel integrates and hardens it rather than inventing it.

---

## 3. Rendering foundation

What exists:
- Three.js: a mature WebGL2 rendering library with a large shader ecosystem.
  Atmosphere, rings, and star-field implementations exist in the community.
- Camera-relative rendering is a known technique for the float32 jitter problem
  at large distances.

Gap:
- The mission-operations scene graph (FOV cones from getfov, footprint
  projection via sincpt, reference-frame axis triads, direction vectors) is not
  off the shelf; it must be assembled.
- Solar-system-scale handling (one meter to one AU in a single scene) requires
  the camera-relative discipline to be designed in from the start, not retrofitted.

What Bessel builds: @bessel/scene, the scene-graph builder and camera
controller, plus the operations-specific meshes and the large-distance handling.

Babylon.js was evaluated in prior work; Three.js was chosen for a lighter bundle,
a larger shader ecosystem, and license fit with Apache-2.0. See ADR-0003.

---

## 4. Adjacent visualization tools (prior art, not substitutes)

| Tool                 | What it is                                   | Why it is not a substitute                          |
| -------------------- | -------------------------------------------- | --------------------------------------------------- |
| spacekit.js          | JS/WebGL orbit visualization library         | Kepler-orbit focused, not SPICE-aware               |
| NASA PSG Orbits view | JPL/GSFC Three.js solar-system viewer        | Closest precedent; not Cosmographia-compatible ops  |
| CosmoScout VR (DLR)  | C++/OpenGL VR solar-system explorer          | Desktop/VR, not a web ops tool, no catalog parity   |
| OpenSpace, Celestia  | C++/OpenGL astronomy and outreach explorers  | Outreach focused, not mission-ops, not SPICE catalogs|
| STK (Ansys)          | Commercial mission analysis suite            | Proprietary; not an open, embeddable web viewer      |

Gap and conclusion: none of these is an open, web-first, SPICE-aware viewer that
reads Cosmographia catalogs and serves operations. That is precisely Bessel's
niche. These are reference implementations to learn from (especially the Three.js
solar-system patterns), not products to adopt.

---

## 5. Tri-target delivery tooling (the new substrate)

What exists in 2026:
- Capacitor (Ionic) wraps a single web build into iOS, Android, and PWA. Vite is
  the standard build tool. This is a stable, well-documented path.
- electron-vite is the recommended modern desktop toolchain (Vite HMR,
  framework-agnostic). Electron Forge with the Vite plugin is the first-party
  alternative with code-signing support.
- vite-plugin-pwa supplies the Workbox service worker and the web manifest.
- @capacitor-community/electron exists as a Capacitor-native Electron target.

Gap:
- The kernel and filesystem behavior differs per platform and must be unified
  behind the PAL: HTTP range plus OPFS on web, Capacitor Filesystem on mobile,
  Node filesystem with meta-kernel resolution on Electron.
- The OPFS kernel cache and offline behavior are bespoke.
- Desktop meta-kernel (.tm) path resolution for Cosmographia parity is bespoke.

What Bessel builds: @bessel/pal (interface) and the three implementations,
plus the three shells (apps/web, apps/desktop, apps/mobile).

Tooling decision: electron-vite with an explicit IPC bridge, rather than
@capacitor-community/electron, to keep the desktop bridge explicit and avoid
coupling the desktop target to Capacitor's plugin lifecycle. This fits the
composability principle and the stated aversion to bundle lock-in and vendor
durability risk. See ADR-0002.

Verdict: the packaging path is mature and low-risk. The work is the PAL bridges,
not the packaging itself.

---

## 6. Catalog and interchange

What exists:
- The Cosmographia JSON catalog format is well-specified and stable across the
  five primary catalog types.
- CZML is the established interchange format for CesiumJS.

Gap:
- A parser covering the full geometry taxonomy plus annotations.
- The native collapsed schema and a lossless round-trip compatibility layer.
- JSON Schema validation with explicit, located errors.
- A CZML exporter for CesiumJS interop.

What Bessel builds: @bessel/catalog (parser, native schema, compatibility
layer, validation) and the CZML exporter (Phase 2). The native schema already
exists as a drafted, validated artifact (packages/catalog/schema/, documented in
docs/catalog-schema.md); the parser, compatibility layer, and converter are the
remaining build.

---

## 7. Paul's adjacent systems (integration targets, already in hand)

| System    | Role                                  | Integration Bessel builds                                  |
| --------- | ------------------------------------- | ------------------------------------------------------------- |
| MMGIS     | Planetary surface GIS                 | Deep links: time sync and lat/lon handoff (Phase 2)           |
| CesiumJS  | Earth/Moon surface context globe      | CZML export rather than embedding; defer surface to MMGIS     |
| Yamcs     | Telemetry archive and processing      | WebSocket adapter for live ephemeris overlay (Phase 4)        |
| OpenMCT   | Telemetry visualization framework     | WebSocket adapter; potential embedding as a view (Phase 4)    |

Gap: these systems exist and are stable; what is missing is the thin adapter and
deep-link layer on the Bessel side. None requires changes to the adjacent
system to begin.

---

## 8. Build process

What exists: Claude Code v2.1.139+ with the `/goal` workflow and an independent
completion checker, which makes a verifiable specification directly executable.

Gap: the specification must express acceptance criteria as runnable commands, and
the repository must define those commands before the first goal runs.

What Bessel builds: the verifiable command catalog (SPEC.md Section 8), the
per-phase goal files (docs/goals/), and the agent context (CLAUDE.md), so each
phase is a checker-gated `/goal` run. This document set is that build process.

---

## 9. Summary of gaps to close, by phase

| Phase | Primary gap closed                                                      |
| ----- | ----------------------------------------------------------------------- |
| 0     | SPICE-WASM spine in a Web Worker; Cassini-at-Saturn render in a PWA      |
| 1     | Full catalog taxonomy, FOV, footprints; all three shells building       |
| 2     | Shareable URL state; readouts; MMGIS deep links; CZML; PWA offline      |
| 3     | Desktop meta-kernel parity; Python bridge; advanced rendering; mobile FS |
| 4     | Telemetry overlays; collaboration; plugin GA (JUICE-style modules)      |
| 5     | Production hardening: budgets, audit, a11y, release pipeline, suite GA  |

The recurring theme: the hard enabling pieces (SPICE in WASM, the rendering
library, the packaging toolchains, the adjacent systems) already exist. Bessel's
work is the integration glue, the platform abstraction, the catalog and failure-mode
fixes, the shareability and operations surface, and a living open-source home.
