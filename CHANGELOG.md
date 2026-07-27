# Changelog

## [3.0.0] - 2026-07-08

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
