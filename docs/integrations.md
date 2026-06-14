# Bessel and MMGIS Integration

Status: Draft v1.0
Date: 2026-06-07
Decision record: docs/adr/0008-ammos-suite-integration.md
MMGIS source of truth: the NASA-AMMOS/MMGIS repository,
docs/pages/Miscellaneous/Deep_Linking/Deep_Linking.md (parameters below were
derived from that document at commit 6ffb9f8, 2026-06-11). When in doubt, the
MMGIS repository wins; run scripts/fetch-mmgis-reference.sh to keep a local
read-only copy beside this repo for inspection during goal sessions.

Bessel is the orbital and geometry lens of the AMMOS IDS suite; MMGIS is the
surface lens. This document defines the deep-link contract between them, both
directions. The principle (ADR-0008): integrate by URL contract and interchange
format, never by embedding one application inside the other.

---

## 1. Bessel inbound: the view URL

Every Bessel view is fully reconstructable from a URL (SPEC Section 5.5). The
canonical form:

```
https://<bessel-host>/#v=1&t=<utc>&cam=<mode>:<target>[:<pose>]&sel=<id,...>&vis=<flags>&plugins=<id,...>
```

- t: epoch, ISO 8601 UTC.
- cam: camera mode (orbit, center, track) and its target, with an optional
  encoded pose.
- sel: selected object ids (SPICE-resolvable names or NAIF ids).
- vis: visibility toggle bitset.
- plugins: active mission plugin ids.

Any application, chat message, procedure, or shift-handoff note can construct
this URL to open Bessel at an exact moment and viewpoint. This is the contract
MMGIS links TO.

## 2. Bessel to MMGIS (orbital to surface handoff)

Trigger: the user selects a surface point in Bessel (a footprint vertex, a
sub-spacecraft point, a sincpt intercept) and invokes "Open in MMGIS."

Bessel constructs an MMGIS URL from the deep-linking parameters MMGIS already
supports. The subset Bessel uses:

| MMGIS parameter      | Bessel supplies                                          |
| -------------------- | -------------------------------------------------------- |
| mission              | the MMGIS mission name from the active Bessel plugin     |
| mapLon, mapLat       | the selected point (degrees; MMGIS map convention)       |
| mapZoom              | a zoom chosen from the footprint's angular size          |
| centerPin            | hover text naming the source (instrument and epoch)      |
| startTime, endTime   | the Bessel epoch, when the MMGIS Time Control is enabled |
| selected (optional)  | layer plus lat,lon or key,value with "go" to select and pan |
| on (optional)        | layer visibility with opacity, when a target layer is known |

Sketch:

```
https://<mmgis-host>/?mission=<m>&mapLon=<lon>&mapLat=<lat>&mapZoom=<z>&centerPin=<text>&startTime=<t0>&endTime=<t1>
```

Notes:

- mapLon and mapLat require mapZoom alongside them; Bessel always sends the
  triple.
- centerPin keeps the handoff point visible to the user instead of only setting
  the initial view, which is exactly the handoff semantic Bessel wants.
- Longitude convention (and any site-frame subtleties) come from the MMGIS
  mission configuration; the integration test fixtures pin the expected output
  per mission config.

## 3. MMGIS to Bessel (surface to orbital handoff)

Trigger: from a surface feature or an observation footprint layer in MMGIS,
"View geometry in Bessel" (an MMGIS link layer or coordinate-action entry
pointing at the Bessel view URL).

MMGIS constructs a Bessel view URL (Section 1) with:

- t set to the observation or feature time,
- cam=center:<body> or track:<spacecraft> as appropriate,
- sel set to the relevant spacecraft and instrument ids.

Because the Bessel side is just a URL, this requires only MMGIS configuration,
no MMGIS code change.

## 4. CZML export (CesiumJS contexts)

For tools built on CesiumJS, Bessel exports CZML for a selected object and time
window (Phase 2). This is an interchange contract, not a live link.

## 5. Contract stability and testing

These URL contracts are public API. Once shipped in Phase 2, changes are
versioned (the v=1 field in Section 1) and ADR-worthy. Tests:

- Unit tests assert outbound MMGIS URLs are well-formed for fixture selections
  (the parameter table above, including the lon/lat/zoom triple rule).
- e2e tests assert an inbound Bessel URL reproduces the encoded view exactly.

If MMGIS deep-linking parameters evolve, update this document against the MMGIS
repository (the file cited in the header) and refresh the local reference copy.
