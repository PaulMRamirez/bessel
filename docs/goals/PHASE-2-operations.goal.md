# Phase 2: Operations features

Maps to SPEC.md Section 9, Phase 2. Prerequisite: Phase 1 committed and green.
Start from a clean Git tree.

Intent: make Bessel useful for real operations and review. Shareable URL state,
geometric readouts, capture, multi-object selection, timeline annotations, MMGIS
deep links, CZML export, and PWA offline with an OPFS kernel cache.

## Goal body

```
/goal Implement Bessel Phase 2 as defined in SPEC.md Section 9.

Build:
1. @bessel/state: encode a view (epoch, camera pose and mode, selection,
   visibility toggles, active plugins) into a compact URL fragment and decode it
   on load. Wire this end to end so a shared URL reconstructs the exact view.
2. @bessel/ui: geometric readouts (range, phase angle, incidence, emission)
   computed via @bessel/spice; multi-object selection; timeline annotations
   with event markers; screen capture and video recording.
3. Integrations per docs/integrations.md: MMGIS deep links (time sync and lat/lon
   handoff, both directions, using the MMGIS deep-linking parameters cited there)
   and a CZML exporter for CesiumJS interop.
4. pal-web: complete the OPFS kernel cache so the PWA operates offline against
   cached kernels after a bundle has been cached.

Goal is complete when ALL of the following exit 0 or hold:
- pnpm verify exits 0
- pnpm test includes the @bessel/state round-trip property test: for a generated
  sample of views, decode(encode(view)) equals view
- pnpm test includes a CZML export test validating output structure for a fixture
  trajectory
- pnpm e2e includes a test that loads a shared URL and asserts the reconstructed
  epoch, camera, and selection match the encoded view
- pnpm e2e includes a test that confirms a second load works offline against the
  OPFS cache (network disabled), and an accessibility scan (axe) reporting zero
  serious or critical violations on the main view
- pnpm test includes suite URL tests asserting well-formed outbound MMGIS URLs
  from fixture selections
- pnpm lhci exits 0 against the production web build

Scope: packages/state, packages/ui, packages/scene (readout hooks), packages/spice
(geometry readout helpers), an integrations module, pal-web (OPFS), apps/web, e2e,
lighthouserc.json usage (read only; never loosen its assertions).

Do not: implement the Python bridge, DSK or advanced shaders, telemetry, or the
plugin registry (Phase 3 and Phase 4). Do not delete or skip tests. Do not weaken
typecheck. Do not edit docs, ADRs, AGENTS.md, or CLAUDE.md. Do not use em dashes.

Stop after 35 turns and report remaining work if not complete.
```

## Natural split point

Phase 2a: @bessel/state plus readouts plus the shared-URL e2e test. Phase 2b:
MMGIS deep links, CZML export, and the OPFS offline cache plus its e2e test.
Commit between them.
