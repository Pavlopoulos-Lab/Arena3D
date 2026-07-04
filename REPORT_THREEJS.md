# Three.js / UI Refinement Report

Branch: `three-js-lifting` — 8 commits, one feature per commit, no push.
Backend untouched: no endpoint, model, or contract changes (verified by the
full backend test suite and by the unchanged `backend/` tree).

## Summary of major improvements

### Phase 1 — Three.js correctness
1. **HiDPI rendering** — the renderer ignored `devicePixelRatio` (blurry on
   retina). Now `setPixelRatio(min(dpr, 2))`, re-applied on resize for
   monitor moves; `powerPreference: 'high-performance'`.
2. **Render loop** — replaced the `setTimeout(rAF)` hybrid with a pure
   `requestAnimationFrame` loop and timestamp-based FPS cap (`ctx.fps` still
   the configurable bound). Frames are vsync-aligned and the loop auto-pauses
   in hidden tabs.
3. **GPU resource disposal** — scene graphs orphaned when a new command cut
   off the redo branch were never disposed (geometry/material/texture leak on
   repeated network loads). Commands now have an optional `dispose()` hook;
   `LoadNetworkCommand` frees its exclusively-owned snapshot. Undo history
   stays fully intact — only provably unreachable scenes are disposed.

### Phase 2 — UX / interaction
4. **Smooth eased wheel zoom** — wheel sets a clamped target scale (same
   0.2–2 bounds); the render loop eases toward it. `prefers-reduced-motion`
   users keep instant zoom; the target resets on network load.
5. **Smoother pan/orbit/lasso** — the v2 10px drag gate made orbit jump in
   ~10° increments; delta-based interactions now update every 2px. Held-key
   node/layer transforms keep the 10px step (they apply a fixed increment per
   event, so their speed is unchanged).
6. **Lasso leak fix** — the lasso rectangle allocated a new geometry+material
   per pointer move without disposal; material is now shared, geometry
   disposed on rebuild/release.
7. **Hover raycast throttling** — raycasting every node sphere per mousemove
   janks large networks; moves now record the latest position and the render
   loop does one hover check per frame.
8. **Picking crash fix (found during validation)** — `intersectObjects`
   defaults to recursive, so hover rays hit plane children (node spheres,
   labels, coord lines) whose uuids aren't in the picked list;
   `findIndexByUuid` returned -1 and `ctx.layers[-1].plane` threw on hover.
   Hover/double-click picking is now non-recursive (also cheaper).
   `drag_controls` was deliberately left recursive — its uuid gate encodes
   the v2 "don't drag a layer while over a node" behavior.

### Phase 3 — Postprocessing (`frontend/src/three/postprocessing.ts`)
9. **Optional subtle bloom** — `EffectComposer` + `UnrealBloomPass`
   (strength 0.35, radius 0.3, threshold 0.8) behind a "Node Glow" checkbox
   in Scene Actions. Guard rails:
   - active only over dark backgrounds (luma < 0.5) — bloom on the white
     theme would wash the scene out; theme switches toggle it automatically;
   - defaults off on mobile UAs;
   - when inactive the plain `renderer.render` path runs — zero extra GPU
     cost;
   - labels are DOM overlays, so they're never bloomed.

### Phase 4 — UI polish (CSS only, no semantic changes)
10. **Cohesive dark chrome** — shared design tokens (accent, frosted
    translucent surface, hairline border) across navbar, canvas-control
    overlay card, node description card, footer and loader; system font
    stack; the solid-blue v2 footer became a quiet translucent bar; the
    120px loader became a slim centered ring. Added `:focus-visible`
    outlines and reduced-motion handling for spinner + zoom.

## Files changed
- `frontend/src/actions/screen.ts` — renderer config, DPR, rAF loop, composer wiring
- `frontend/src/actions/canvas_controls.ts` — eased zoom, drag thresholds, lasso disposal, hover coalescing
- `frontend/src/actions/canvas_controls.test.ts` — updated zoom test for easing
- `frontend/src/actions/node.ts`, `frontend/src/actions/layer.ts` — non-recursive picking
- `frontend/src/commands/base.ts`, `frontend/src/commands/scene.ts` — `dispose()` hook
- `frontend/src/three/runtime.ts` — `disposeSnapshot`
- `frontend/src/three/postprocessing.ts` — new (bloom module)
- `frontend/src/ui/scene.ts` — Node Glow toggle
- `frontend/src/style.css` — design tokens + chrome polish

## Validation commands run (all green)
- `backend`: `uv run pytest` (58 passed), `uv run ruff check .`, `uv run mypy app`
- `frontend`: `npx vitest run` (105 tests, 15 files), `npm run lint`,
  `npx tsc --noEmit`, `npm run build`, `npx playwright test` (e2e suite)

## Playwright flows tested
- Existing e2e: load example → Fruchterman-Reingold layout → clustered layout → export session.
- Custom scripts: full-canvas hover sweeps (crash regression), eased-zoom
  scale assertions, middle-drag orbit, double-click select + Ctrl+Z/Ctrl+Shift+Z
  undo/redo, bloom toggle on/off screenshots, viewport resize (1440/900/700)
  + reload, responsive screenshots at desktop/tablet/mobile widths.
- Console: zero errors in every run (only headless-GL driver warnings from
  screenshot ReadPixels, environmental).

## Remaining risks / follow-ups
- **Undo stack is unbounded** — long sessions with many network loads retain
  all previous scenes for undo (CPU+GPU). Disposal now covers the redo side;
  a capped undo stack with eviction-time `dispose()` is the natural next step.
- **Bloom on WebGL context loss** is untested; the composer is created once
  and never rebuilt.
- **Node hover check still maps `ctx.nodeObjects` to a new array per check**
  (once per frame now, not per event); for 10k+ nodes consider a persistent
  array or BVH.
- Lighting (`AmbientLight` + two point lights) left untouched to preserve the
  established look; a soft key/fill setup could improve depth perception if a
  visual refresh is ever wanted.
- The `#info:not(:has(table))` rule assumes the pre-network overlay contains
  no table; if that markup changes, revisit.
