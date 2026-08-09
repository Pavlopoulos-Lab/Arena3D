# Changelog

## [3.1.0dev] - unreleased

### Added

- Edge weight can now be shown as **edge thickness**, not only opacity. The Edge Actions panel replaces the "Edge Opacity By Weight" checkbox with a "Show Edge Weight As" radio — Nothing / Opacity / Width / Both — plus intra- and inter-layer width sliders for whichever property weight isn't driving. Sessions carry the choice as the independent `edgeOpacityByWeight` and `edgeWidthByWeight` booleans; files written before this default to opacity, so they render unchanged. Thickness needed `Line2` (instanced quads) because WebGL renders every line primitive at exactly 1px regardless of `linewidth`.

### Fixed

- Curved channel edges rendered as dotted lines with beads at the curve points once thickness landed. `LineMaterial`'s `worldUnits` mode assumes a perspective camera — its fragment shader traces a view ray from the camera origin and discards anything farther than half a width from the segment, which under this app's orthographic camera discards along the whole segment. Widths are now screen-space, sized against a shared resolution uniform kept on the frustum size (so the numbers still mean world units), retargeted on resize and for the PNG export.
- Node colors rendered washed out/dark in the 3D scene compared to the 2D navigator. The bloom composer was blitting linear color straight to the sRGB canvas (missing `OutputPass`), and the ambient light was left at the pre-r155 intensity that physical lighting divides by PI.

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
