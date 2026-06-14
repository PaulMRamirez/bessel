# Bessel Vision

Status: Draft v1.0
Date: 2026-06-07
Owner: Paul Ramirez

## One sentence

Bessel is an open-source, SPICE-aware mission visualization application that
renders solar-system geometry, spacecraft trajectories, instrument fields of
view, observation footprints, and time evolution from a single codebase that
ships as a Progressive Web App, as native iOS and Android apps (via Capacitor),
and as a desktop application (via Electron).

## The problem

NASA/JPL's SPICE-Enhanced Cosmographia is the de facto tool for visualizing
mission geometry against SPICE kernels. It is capable and trusted, but it is
constrained in ways that matter for a modern, multi-mission ground enterprise:

1. It is desktop only. There is no browser experience, no mobile experience,
   and no way to hand someone a link that opens the exact view you are looking
   at. Operations, planning, outreach, and review all want a shareable,
   zero-install entry point.
2. Its catalog model produces a file explosion: a separate catalog file per
   sensor per target makes mission setup brittle and hard to maintain.
3. Several behaviors fail silently. The best-known example is the camera
   jumping to the Sun when a referenced body or kernel is missing, with no
   actionable error. In an operations context, a silent failure is worse than a
   loud one.
4. It is not governed as a living open-source project. The source exists, but
   there is no community, no plugin ecosystem, and no clear contribution path.

Bessel is not a reimplementation for its own sake. It is the SPICE
visualization surface that the rest of the ground software ecosystem
(MMGIS, Yamcs, OpenMCT, and the broader AMMOS IDS portfolio) can deep-link into,
embed, and extend.

## What Bessel is

- A web-first 3D viewer built on Three.js, driven by CSPICE compiled to
  WebAssembly, that reads Cosmographia-compatible catalogs and a cleaner native
  catalog schema.
- A single codebase with three delivery targets: PWA, Capacitor (mobile),
  Electron (desktop). The 3D engine, SPICE engine, catalog parser, scene graph,
  timeline, and UI are shared. Only a thin Platform Abstraction Layer differs
  per target.
- An operations instrument, not only an outreach toy: shareable URL state,
  geometric readouts (range, phase angle, incidence, emission), predicted versus
  actual ephemeris overlays, and adapters to live telemetry.
- An extensible platform: mission-specific behavior arrives as plugins
  (the JUICE ESA plugin in Cosmographia is the prior-art model), not as forks.

## What Bessel is not

- It is not a SPICE replacement. It links CSPICE; it does not reimplement the
  toolkit. NAIF remains the source of truth for the kernels and the math.
- It is not a planetary surface GIS. Surface analysis stays in MMGIS. Bessel
  interoperates with MMGIS through deep links and with CesiumJS through CZML
  export rather than absorbing that scope.
- It is not a single monolithic app. It is composable packages with three shells.

## Why now

Three things line up in 2026:

1. The web platform is ready. CSPICE compiles to WASM today
   (arturania/cspice is working prior art), OPFS and the File System Access API
   give browsers real local-file capability, and Three.js handles
   solar-system-scale scenes when paired with camera-relative rendering.
2. The packaging story is mature. Capacitor wraps a Vite web build into iOS and
   Android, electron-vite produces a first-class desktop build, and
   vite-plugin-pwa provides the service worker and manifest. One codebase, three
   targets, is now a well-trodden path rather than a research project.
3. The build economics changed. Claude Code's `/goal` workflow lets a verifiable
   specification be executed as a sequence of autonomous, checker-gated runs.
   A spec written with machine-checkable acceptance criteria is now directly
   executable, which is exactly how this document set is structured.

## Principles

- Open by default. Apache-2.0, public from day one, designed to live in the
  NASA-AMMOS GitHub organization with a real contribution and governance model.
- Composable, not coupled. The core never imports a platform API directly. Every
  target is swappable behind the Platform Abstraction Layer. No bundle lock-in,
  no hidden dependency on any single vendor runtime.
- Fail loudly. Every missing kernel, unresolved body, or bad catalog reference
  produces an explicit, actionable error. The Cosmographia "jump to the Sun"
  behavior is treated as a defect to fix, not a default to copy.
- Compatible, then better. Bessel reads existing Cosmographia catalogs so
  missions can migrate without a rewrite, and offers a collapsed schema that
  removes the per-sensor-per-target file explosion.
- Verifiable. Progress is defined by runnable checks (tests pass, types clean,
  builds produce valid artifacts), so each phase can be driven and confirmed by
  the `/goal` completion checker.

## North-star scenarios

1. An operations engineer pastes a link into a chat. It opens Bessel in a
   browser at the exact epoch, camera, and selection of the sender, with the
   instrument footprint already drawn on the target body.
2. A planner on a tablet, offline on travel, opens the installed Bessel PWA,
   loads a previously cached kernel bundle, and scrubs the timeline to check a
   geometry window.
3. A mission integrator on a workstation runs the Electron build, points it at a
   meta-kernel on a network share, and gets parity with desktop Cosmographia,
   plus a Python scripting bridge for batch geometry products.
4. A mission team ships a Bessel plugin (kernels, frames, catalog overlays,
   custom panels) the way the JUICE team shipped one for Cosmographia, without
   touching the core.

## Success criteria for v1

- A user can load a Cosmographia spacecraft catalog and see a correct trajectory,
  FOV cone, and footprint in the browser, on a phone, and on the desktop, from
  the same source tree.
- A view is fully reconstructable from a URL.
- A missing kernel produces an explicit error, never a silent re-center.
- The project is public, Apache-2.0, documented, and accepts external
  contributions, with CI, budgets, and an auditable release pipeline
  (production quality is a gate, not a hope).

## Relationship to the rest of the portfolio

Bessel is the orbital and geometry lens that complements the surface lens
(MMGIS), the telemetry lens (Yamcs, OpenMCT), and the science-data lenses
(PIXLISE among them). It deep-links with MMGIS (time sync and lat/lon
handoff, both directions), exports CZML for CesiumJS contexts, and ingests
live ephemeris from Yamcs/OpenMCT in later phases. Treated as a peer in the AMMOS IDS
architecture, it gives that architecture a missing piece: an open, shareable,
multi-platform view of where everything is and where it is going.
