# Changelog

## [3.1.0dev] - unreleased

### Added

- Network upload accepts a minimal 2-column edgelist (`SourceNode`, `TargetNode` only) — all nodes are spread out in a single default layer named `Layer1`. The optional `Weight` and `Channel` columns still apply. A downloadable example lives in the Help → Examples tab.

- Edge weight can now be shown as **edge thickness**, not only opacity. The Edge Actions panel replaces the "Edge Opacity By Weight" checkbox with a "Show Edge Weight As" radio — Nothing / Opacity / Width / Both — plus intra- and inter-layer width sliders for whichever property weight isn't driving. Sessions carry the choice as the independent `edgeOpacityByWeight` and `edgeWidthByWeight` booleans; files written before this default to opacity, so they render unchanged. Thickness needed `Line2` (instanced quads) because WebGL renders every line primitive at exactly 1px regardless of `linewidth`.

### Changed

- Channel curvature sliders reach much further — intra-layer 10–60 (was 10–20), inter-layer 1–30 (was 1–10) — so the channels of a multi-channel edge can be pulled well apart instead of running nearly parallel. Defaults are unchanged, so existing sessions render exactly as before.

### Fixed

- Edges no longer glow. Thick edges cover a large share of the screen, and bloom on all of them was blinding against dark backgrounds. Bloom is now selective (three's off-screen bloom-composer pattern) and reads from node spheres alone, so nodes still glow, edges and layer planes stay crisp, and the extra pass costs a few spheres rather than a second full scene.
- Curved channel edges rendered as dotted lines with beads at the curve points once thickness landed. `LineMaterial`'s `worldUnits` mode assumes a perspective camera — its fragment shader traces a view ray from the camera origin and discards anything farther than half a width from the segment, which under this app's orthographic camera discards along the whole segment. Widths are now screen-space, sized against a shared resolution uniform kept on the frustum size (so the numbers still mean world units), retargeted on resize and for the PNG export.
- Node colors rendered washed out/dark in the 3D scene compared to the 2D navigator. The bloom composer was blitting linear color straight to the sRGB canvas (missing `OutputPass`), and the ambient light was left at the pre-r155 intensity that physical lighting divides by PI.

### `Dependencies`

| Tool              | Previous version | New version  |
| ----------------- | ---------------- | ------------ |
| fastapi           | 0.139.0          | 0.141.1      |
| pandas            | 3.0.3            | 3.0.5        |
| uvicorn           | 0.50.0           | 0.52.1       |
| httpx2            | 2.5.0            | 2.10.0       |
| mypy              | 2.1.0            | 2.3.0        |
| pandas-stubs      | 3.0.3.260530     | 3.0.5.260730 |
| ruff              | 0.15.20          | 0.16.2       |
| @playwright/test  | 1.61.1           | 1.62.1       |
| @types/three      | 0.185.0          | 0.185.4      |
| eslint            | 10.6.0           | 10.8.1       |
| prettier          | 3.9.4            | 3.9.6        |
| typescript-eslint | 8.62.1           | 8.66.0       |
| vite              | 8.1.3            | 8.2.1        |
| vitest            | 4.1.9            | 4.1.10       |

Backend dependencies updated to latest via `uv lock --upgrade`; transitives moved with them (notably starlette 1.3.1 → 1.6.0 and websockets 16.0 → 17.0.1). No known vulnerabilities on either side. `pydantic-core` stays at 2.46.4 — pydantic pins it exactly. TypeScript stays on 6.0.3: 7.0.2 typechecks fine but typescript-eslint 8.x refuses to load against the TS 7 API, so linting breaks; revisit once typescript-eslint ships TS >=7.1 support. CI now runs `uv sync --frozen` so it installs exactly the locked set the Docker image ships.

## [3.0.0] - 2026-07-27

Full rewrite: migrated from R/Shiny to a **FastAPI (Python) backend + Vite / TypeScript / Three.js frontend**. Algorithms (layouts, clustering, topology) ported 1:1 via python-igraph.

### Added

- **Satellite view** — minimap overview of the scene (hidden layers excluded).
- **Command-pattern undo/redo** — granular history for scene mutations.
- **Token-shared sessions** — hand off a session to another app via `?session=` URL (`POST /api/external`).
- **Export Image** — button to export the scene as PNG.
- Reproducible node scatter (seeded), 60 FPS render loop as default, redesigned UI (side-drawer panels).

### Changed

- **Zoom to cursor** — mouse-wheel zoom anchors at the pointer instead of the scene center.

### Fixed

- **Undraggable layers when zoomed in** — orthographic drag ray rejected planes sitting behind its origin; layers froze at high zoom despite hover working.

## [2.0.0] - 2023-04-13

Initial public release — Arena3D, an **R/Shiny + Three.js** web app for interactive 3D visualization of multilayered networks.

- Interactive 3D rendering of multilayer networks (Three.js via R/Shiny).
- TSV network upload; layer / node / edge styling.
- Layout algorithms, community clustering, and topology metrics on the graph.
- Session import / export.

## [1.0.0] - 2008-11-28

The now retired legacy Arena3D standalone desktop application written in Java.
