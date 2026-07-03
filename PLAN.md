# Arena3Dweb v3 — Implementation Plan

Tracks migration from R/Shiny to FastAPI + Vite + TypeScript + Three.js (npm).
See `SPEC.md` for architecture decisions and rationale.
See `MIGRATION.md` for the old-file → new-file deletion checklist.

**Rule:** Each phase must be independently runnable and tested before the next begins.
**Done signal:** Old source files are deleted only after their replacement is tested.

---

## Phase 1 — Scaffolding & Tooling

- [x] Create `v3` branch from `main`
- [x] Tag current `main` as `v2-legacy`
- [x] Scaffold `backend/` directory structure
- [x] Scaffold `frontend/` directory structure
- [x] Set up `backend/pyproject.toml` — Ruff + mypy config
- [x] Set up `frontend/package.json` — Vite + TypeScript + ESLint + Prettier + Vitest
- [x] Set up `frontend/vite.config.ts` — proxy `/api` to `localhost:8000` in dev
- [x] Set up `frontend/tsconfig.json`
- [x] Set up `docker-compose.yml` — hot-reload frontend + backend
- [x] Set up `Dockerfile` — production single image (nginx + uvicorn)
- [x] Set up `nginx/nginx.conf` — serve static build, proxy `/api`
- [x] Set up `.github/workflows/ci.yml` — lint → typecheck → unit tests → E2E
- [x] Set up `.pre-commit-config.yaml` — Ruff + ESLint/Prettier hooks
- [x] Create `MIGRATION.md` with full old-file → new-file checklist

---

## Phase 2 — Backend: Config Endpoint

- [x] Implement `backend/app/config.py` — port constants from `config/server_variables.R`; backend keeps what it validates against (`MAX_EDGES`, `MAX_LAYERS`, `MAX_CHANNELS`, mandatory/optional column lists, scale targets), purely visual constants (node palette, channel colors, floor defaults) also served via `/api/config` for the frontend
- [x] Implement `GET /api/config` router
- [x] Write pytest tests for `/api/config`
- [x] Verify frontend can fetch and parse config response (`src/api/config.ts` typed client + live smoke test)
- [x] Delete `config/server_variables.R` (`global_variables.R`, `static_variables.R`, `ui_variables.R` folded in / obsolete — deleted too)

---

## Phase 3 — Backend: Network Parsing

- [x] Implement Pydantic models — `NodeModel`, `EdgeModel`, `NetworkModel` (`models/network.py`)
- [x] Implement `services/parser.py` — port TSV parsing and validation from `functions/input.R` (`parseUploadedNetwork` chain + `mapper`)
- [x] Implement `POST /api/network` router
- [x] Write pytest tests using `www/data/` TSV files as fixtures (12 tests, real `aspirin_3channels.tsv`)
- [x] Verify validation errors match current behaviour (missing columns, non-numeric weights, empty channels)
- [x] Delete `functions/input.R` — all responsibilities ported: TSV upload (`parser.py`), JSON import/session export (`session.py`), node/edge attribute uploads (`attributes.py`, Phase 7), example load (frontend bundled TSV).

---

## Phase 4 — Backend: Layout Algorithms

- [x] Swap `networkx` + `scipy` + `python-louvain` for `python-igraph`; backend now managed by `uv` (`pyproject.toml` + `uv.lock`, `requirements.txt` deleted)
- [x] Implement `services/graph.py` — `ig.Graph` construction (port `functions/igraph/general.R`: channel filter, perLayer/allLayers/nodesPerLayers subgraph scopes, `simplify()` multi-edge/loop rules)
- [x] Implement `services/layouts.py` — registry dict mapping all 11 UI layout names to `Graph.layout_*` calls (port `getLayoutFunction()`)
- [x] Port pseudo-network for no-edge layouts (`NO_EDGE_LAYOUTS` = Circle, Grid, Random) — simplified: add all layer nodes as isolated vertices so `layout_circle/grid/random` place them (v2 chained them with tiny weights; same visible result)
- [x] Seed RNG per request (v2 uses `set.seed(123)`) — layouts must be reproducible
- [x] Implement `POST /api/layout` router — scope + selected layers/nodes/channels params, returns 2D in-layer `[y, z]` coords (SPEC §5 flow)
- [x] Write pytest tests for each layout with fixture graphs (24 tests: all 11 algos run, 3 scopes, channel filter, seed determinism)
- [x] Delete `functions/igraph/layout.R` (`general.R` ported into `graph.py` but kept as living spec until `cluster.R`/`topology.R` land in Phases 5–6)

---

## Phase 5 — Backend: Clustering (optional layout step)

Clustering in v2 is not a standalone action — it is an option of the layout run (`calculateClusteredLayout()`): cluster, lay out cluster super-nodes globally, lay out members locally, translate into place. No separate `/api/cluster` endpoint.

- [x] Implement clustering registry (`services/clustering.py`) — Louvain, Walktrap, Fast Greedy, Label Propagation (`Graph.community_*`, all exact with python-igraph)
- [x] Port supernode strategy (`execute_strategy3_superNodes_strictPartitioning`): global layout on cluster graph with repelling force, per-cluster local layout, coordinate translation
- [x] Extend `POST /api/layout` with optional `clustering: { algorithm, local_layout }`; response gains `clusters` map (feeds Clustering Data table + node-color priority)
- [x] Write pytest tests for each clustering algorithm and the clustered layout (8 tests, two-community fixture)
- [x] Delete `functions/igraph/cluster.R`

---

## Phase 6 — Backend: Topology Metrics

- [x] Implement `services/topology.py` — Degree (raw `Graph.degree(loops=True)`, **not** normalized centrality), Clustering Coefficient (weighted local transitivity, isolates = 0), Betweenness (honours edge-direction toggle + weights)
- [x] Port `mapper()` — map values into `[TARGET_NODE_SCALE_MIN, TARGET_NODE_SCALE_MAX]` per subgraph as v2 does; return raw values too for the View Data table
- [x] Implement `POST /api/topology` router (same scope/filter params as layout)
- [x] Write pytest tests for each metric with known fixture graphs (7 tests, star + triangle fixtures)
- [x] Delete `functions/igraph/topology.R` (+ `general.R` — all igraph ports done, `functions/igraph/` now empty)

---

## Phase 7 — Backend: Session & External API

- [x] Implement Pydantic models for session (`models/session.py`)
- [x] Implement `POST /api/session/import` router — ports `parseUploadedJSON()` + `isJSONValid()` (defaults for scene/layers/nodes/edges, channel handling, edge dedup, scramble flag)
- [x] Implement `POST /api/session/export` router — thin packaging (stateless: frontend holds state, server returns JSON download)
- [x] Implement `POST /api/external` + `GET /api/external/<token>` — token = `secrets.token_urlsafe`, session JSON stored in `tmp/` with 24h TTL sweep, path-traversal guard on resolve
- [x] **VR: dropped.** `functions/vr.R` deleted, not ported. v2's VR mode wrote PLY + A-Frame HTML served from external `bib.fleming.gr` infra; niche feature, out of scope for the restack. Recorded in MIGRATION.md.
- [x] Write pytest tests for all session and external endpoints using `www/data/*.json` as fixtures (11 tests, real `Arena3DwebApp_aspirin.json` + `figure1_export.json`)
- [x] Delete `functions/init.R`, `functions/general.R`, `functions/reset.R`, `functions/vr.R`, `functions/render.R`, `functions/js_handling.R` (`functions/edges.R` is UI logic — dies with `views/` in Phase 13)
- [x] **Attribute-file uploads ported**: `POST /api/attributes/nodes` + `/api/attributes/edges` (`services/attributes.py` + `models/attributes.py`, 7 pytest tests). Frontend `applyNodeAttributes`/`applyEdgeAttributes` (node.ts/edge.ts) + File-panel wiring; `input.R` deleted.

---

## Phase 8 — Frontend: Foundation

- [x] Install Three.js via npm, configure `@types/three` (already in `package.json`)
- [x] Implement `EventBus` singleton (`src/bus/index.ts`) — typed events, returns unsubscribe fn
- [x] Implement `AppState` store singleton (`src/store/index.ts`)
- [x] Implement `Command` interface + `CommandHistory` singleton (`src/commands/base.ts`) — emits `history:changed`
- [x] Hand-write typed API client mirroring the Pydantic models (`src/api/client.ts`) — no codegen dep; covers network/layout/topology/session/external
- [x] Verify API client can call all Phase 2–7 endpoints (live smoke test: config/network/layout 200; OpenAPI lists all 9 paths). 5 Vitest tests for bus/store/history.

---

## Phase 9 — Frontend: Three.js Classes

- [x] Identify all manual patches in `www/js/three/three.js` — **none found**: file is byte-identical to stock Three.js r117 (diff = only a missing trailing newline). SPEC's "patched copy" claim is wrong; no `src/three/` subclasses needed.
- [x] Migrate `Scene.js` → `src/three/Scene.ts` — plain TS on npm `three` r170 (`THREE.Math`→`THREE.MathUtils`). Ambient globals → typed `src/three/runtime.ts` context; statics → `src/three/constants.ts`. `Scene.rotate()` (DOM slider + Shiny glue) deferred to Phase 11.
- [x] Migrate `Layer.js` → `src/three/Layer.ts`
- [x] Migrate `Node.js` → `src/three/Node.ts`
- [x] Migrate `Edge.js` → `src/three/Edge.ts`
- [x] Write Vitest unit tests for all four classes (16 tests in `src/three/three.test.ts`; tsc + eslint + prettier clean)
- [x] Delete `www/js/classes/` + `www/js/three/three.js`. **`matrix4.js` / `drag_controls.js` kept** as living spec for Phase 11 (canvas_controls) — deleted there once ported.

---

## Phase 10 — Frontend: Commands

All 8 in `src/commands/scene.ts`. Commands are **thin**: they apply/reverse already-decided values on the Phase 9 object model (via `ctx`); API fetch + position/scale math is the Phase 11 actions' job, which construct these with the results. Added `ctx.edgeObjects` registry + `snapshotRegistries`/`restoreRegistries` helpers to `runtime.ts`, and a `layer:moved` bus event.

- [x] Implement `LoadNetworkCommand` — takes a `build: () => void` closure; snapshots ctx registries before/after so a load is one undo step (concrete builder lands in Phase 11 network action)
- [x] Implement `ApplyLayoutCommand` — captures node positions before/after, plus cluster IDs/colors + `nodeColorPrioritySource` when clustering ran (single command, one undo step)
- [x] Implement `ApplyTopologyCommand` — captures node scale values before/after
- [x] Implement `MoveLayerCommand` — captures layer position/rotation/scale before/after; redraws inter-layer edges
- [x] Implement `ChangeNodeColorCommand`
- [x] Implement `ChangeNodeSizeCommand`
- [x] Implement `ChangeEdgeColorCommand` — captures colors/importedColors + `edgeFileColorPriority`, redraws
- [x] Implement `ChangeThemeCommand` — store-only (getter/setter injected); concrete recolor is the Phase 11 themes action listening to `theme:changed`
- [x] Write Vitest tests for execute/undo/redo on each command (9 tests in `src/commands/scene.test.ts`)

---

## Phase 11 — Frontend: Object Actions

**Re-scoped.** The v2 actions split cleanly into two groups by dependency:
- **Pure data-model actions** (no renderer/camera/animate/DOM) — portable + unit-testable now.
- **Render-loop / DOM / event actions** — need the renderer, camera, `animate()` loop, raycaster, DragControls, CSS2D labels, and the UI panels. Those dependencies are built in **Phase 12** (main loop, `screen.js` renderer/camera, `event_listeners.js`) and **Phase 13** (UI panels). Migrating them now would mean stubbing all of that, so they move to the phase where their deps exist.

Done now (portable core):
- [x] Migrate `layout.js` → `src/actions/layout.ts` — `executeLayout` coordinate normalization (backend returns raw igraph `[y,z]`, confirmed) + `applyLayout` / `applyTopology` dispatching the Phase 10 commands. 5 Vitest tests. *(allLayers scope; perLayer/local refinements deferred to Phase 13 scope UI — `layout.js` kept as their spec.)* **Predefined layouts added**: `applyPredefinedLayout` (parallel / zigZag / starLike petals / cube sides with multi-cube x-offsets) — direct layer transforms as v2, raises edge+label render flags in place of the Shiny syncs. 5 more Vitest tests.

Deferred into Phase 12 (with renderer/camera/animate/raycaster/DragControls/CSS2D) and Phase 13 (UI/DOM), then delete `www/js/object_actions/`:
- [ ] `screen.js` → `src/actions/screen.ts` (renderer, camera, window bounds, raycaster, `animate()`)
- [x] `network.js` → `src/actions/network.ts` — `buildNetwork` consumes backend `NetworkData` (layer/edge limits enforced server-side; channel limit checked client-side); `loadNetwork` wraps it in `LoadNetworkCommand`. Builds a fresh `Scene` + registries (never mutates in place) so undo snapshots stay valid. Spread/scramble now imported from `layer.ts`/`node.ts`. 4 Vitest tests. *(Channel UI → Phase 13.)*
- [x] Session import → `network.ts` `buildFromSession`/`loadSession` (one undo step) — consumes the backend-normalized `SessionData` (typed in `api/client.ts`): scene position/scale/rotation + clear color, full layer transforms (spread only when the backend `generate_coordinates` flag says the JSON had none), nodes with positions/scale/color/url/descr (scramble per flag, min-layer-width bounds), edges with file colors (`EdgeRow.color` wins over channel palette) + opacity as weight, v2 `setJSONExtras` flags, store gets a `NetworkData` equivalent for later layout/topology calls. 6 Vitest tests. File-panel upload/download wiring → Phase 13.
- [x] Session export → `src/actions/session.ts` — `collectSession` reads live ctx (scene pan/scale/rotation + renderer clear color, layer transforms via `getWidth`/`getColor`, nodes, one edge row per channel with `decideColor(j, forExport=true)`, `setJSONExtras` flags); `exportSession` POSTs to `/api/session/export` and triggers a blob download. `api.exportSession` returns the `Blob`. 4 Vitest tests incl. a `collectSession → buildFromSession` round-trip.
- [x] `node.js` → `src/actions/node.ts` — hover (`checkHoverOverNode`), double-click + search + select-all selection (store-synced), `repaintNode` (cluster branch folded into `Node.getColor`), label-flag priorities (DOM checkboxes → `Layer.isVisible`), shape/color-priority setters; `scrambleNodes` moved here from `network.ts`. New ctx state: `lastHoveredNodeIndex`, `selectedNodeColorFlag`, `showAll/showSelectedNodeLabelsFlag`. 7 Vitest tests. *(Search bar/sliders/descr div → Phase 13; lasso + held-key/spread/move/scale → canvas_controls.ts; attribute upload → POST /api/attributes.)*
- [x] `edge.js` → `src/actions/edge.ts` — inter-layer render machinery (`renderInterLayerEdges` wired into `animate()`, remove-on-drag/pause/zero-opacity, v2 locked-flag redraw pair), `redrawIntra/InterLayerEdges` (moved out of `commands/scene.ts` privates), channel color/visibility, `unselectAllEdges`, all edge-setting setters. New ctx state: `renderInterLayerEdgesFlag`, `waitEdgeRenderFlag`, `interEdgesRemoved`, `interLayerEdgesRenderPauseFlag`. 5 Vitest tests. *(Edge build lives in network.ts; channel UI lists/picker → Phase 13; attributes upload → POST /api/attributes.)*
- [x] `layer.js` → `src/actions/layer.ts` — `initialSpreadLayers` (moved from network.ts), hover (`checkHoverOverLayer` red-highlight + repaint), double-click/`selectLayer`/select-all selection (store-synced), `repaintLayers` (selected → default/picker priority), per-layer visibility + node-label toggles (recompute node label flags), coords/opacity/wireframe/color-priority setters. New ctx state: `lastHoveredLayerIndex`, `hoveredLayerPaintedFlag`, `renderLayerLabelsFlag`. 6 Vitest tests. *(Checkbox group + picker DOM → Phase 13; DragControls + held-key/slider rotate/move/scale intervals → canvas_controls.ts.)*
- [x] `themes.js` → `src/actions/themes.ts` — `THEMES` presets (light/dark/gray from v2 buttons), `applyTheme(name, fromInit)` (renderer clear color, `ctx.edgeDefaultColor`/`labelColor`, channel palette from config, picker-priority layer repaint with theme floor color), `registerThemeListener()` wired to `theme:changed` in main.ts so `ChangeThemeCommand` execute/undo recolors. Added `ctx.labelColor` (v2 `globalLabelColor`), `repaintLayers(pickerColor?)`, `assignChannelColorsFromPalette` in edge.ts. 4 Vitest tests. *(Theme buttons DOM + channel edit list rebuild → Phase 13; label recolor → labels.ts.)*
- [x] `labels.js` → `src/actions/labels.ts` — v2's plain absolutely-positioned divs in `#labelDiv` (kept over CSS2DRenderer: no new dep, inline `position:absolute` until the Phase 13 stylesheet), `createLabels` on network build, flag-gated `renderLayer/NodeLabels` registered as animate hooks (`registerAnimateHook` added to screen.ts — avoids screen→labels→node→screen cycle), `showLayer/NodeLabels` modes, resize + `setLabelColor` (themes now recolors labels). Added `ctx.renderNodeLabelsFlag` + layer-label flags; `decideNodeLabelFlags` raises the render flag as v2 did. 4 Vitest tests (flag machinery; div positioning → Phase 13 Playwright). `index.html` gains `#labelDiv`.
- [x] `canvas_controls.js` (core) + canvas half of `event_listeners.js` → `src/actions/canvas_controls.ts` — `sceneZoom`, `keyPressed`/`axisRelease` (modern `event.key`), `clickDown/Drag/Up`, `dblClick` (node → layer → unselect-all priority), scene pan/orbit, held-key node-translate/layer-rotate (the node.js/layer.js deferrals), shift-lasso select (anchor, THREE.Line rectangle, dim-then-select), `registerCanvasControls()` on the canvas from main.ts (tabIndex, wheel/scroll prevention, mouseleave release). 8 Vitest tests. *(Right-click node menu → right_click_menu.ts; nav buttons/slider control table DOM → Phase 13.)*
- [x] DragControls layer dragging → `src/actions/drag_controls.ts` — hand-port of v2's tweaked `www/js/three/drag_controls.js` on npm three math (`matrix4.js` shim dropped; both v2 files deleted). v2 gate kept (drag only while left button held over hovered layer; label flags raised); release now raises the inter-edge render flag + emits `layer:moved`. Planes list read live from ctx, so one registration survives network reloads. 4 Vitest tests (ray-hit select, ortho drag math, gate, release).
- [x] `right_click_menu.js` + `replaceContextMenuOverNode` (event_listeners.js) → `src/actions/right_click_menu.ts` — pure graph commands (`selectNeighbors`, `selectMultiLayerPath` with v2's starting/current-layer exclusions, recursive `selectDownstreamPath` over inter-layer edges), `executeCommand` tail (render flags + label flags + store sync), `<select>` menu over the clicked node in `#labelDiv` (Link opens URL; Description → Phase 13 panel), wired to `contextmenu` + removed on `clickUp` in canvas_controls. 5 Vitest tests. *(Loader spinner + descrDiv content → Phase 13.)*
- [x] Delete `www/js/object_actions/` — all ported. `node.js`/`edge.js` deleted with the attribute-upload port (`applyNodeAttributes`/`applyEdgeAttributes`). Nav-controls port (`src/actions/nav_controls.ts`: fixed buttons, Scene/Layers/Nodes control table with hold-to-repeat rotate/move intervals, spread/scale, recenter, info instructions — attached on first `network:loaded` as v2). Verified live (scene rotate hold+release, layer/node move, scale sliders, recenter, spread, table toggle, inter-edge pause, node+edge attribute upload).

---

## Phase 12 — Frontend: Event Handling & Main Loop

Render spine done and **verified live** (playwright-cli: config loads from `/api/config`, canvas mounts, tilted coord axes render). Also ported `screen.js` here (renderer/camera/bounds/raycaster/`animate`) — it was deferred out of Phase 11 for exactly this reason.

- [x] Migrate `general.js` → `src/utils.ts` (6 Vitest tests)
- [x] Migrate `screen.js` → `src/actions/screen.ts` — renderer, camera, window bounds, raycaster, FPS-limited `animate()`. Added `ctx.renderer/camera/fps/*Bound*` (persist across network reloads, not in `resetContext`).
- [x] Migrate `event_listeners.js` (window-level) → `src/event_listeners.ts` — `resize` + `Ctrl+Z` / `Ctrl+Shift+Z` (and `Ctrl+Y`) undo/redo wired to `CommandHistory`
- [x] Migrate `on_page_load.js` → `src/main.ts` — config fetch → renderer/camera/scene setup → mount canvas → animate; exposes `window.__arena = { ctx, history }` test hook (Phase 13 Playwright reads scene state through it)
- [x] **Canvas mouse/keyboard scene controls** (`clickDown/Drag/Up`, `sceneZoom`, `keyPressed`, right-click menu) — landed in `canvas_controls.ts` + `right_click_menu.ts` (see Phase 11 list).
- [x] Replace `rshiny_handlers.js` + `rshiny_update.js` fully with EventBus + API — last two gaps ported: loader spinner (`startLoader`/`finishLoader` in `screen.ts`, wrapping network/session upload + layout/topology runs) and right-click Description → `#descrDiv` (close button + paragraph; `textContent` instead of v2 `innerHTML` — descriptions come from uploaded/external files). `executeCommand` added to the `window.__arena` test hook. Verified live (loader hidden + opacity restored after load, Description shows/fills/closes). Attribute handlers (`setNode/EdgeAttributes`) die with the deferred `/api/attributes` feature — JS spec lives on in `www/js/object_actions/node.js`/`edge.js`.
- [x] Delete `www/js/event_listeners.js`, `www/js/on_page_load.js`, `www/js/general.js` — all fully ported (`event_listeners.ts` + `canvas_controls.ts` + `right_click_menu.ts`; `main.ts`; `utils.ts`). The v2 color-picker inputs from `on_page_load.js` re-appear with the Phase 13 scene panel (`repaintLayers` already reads `#floor_color`).
- [x] Delete `www/js/rshiny_handlers.js`, `www/js/rshiny_update.js`
- [x] Delete `www/js/config/` (globals → `three/runtime.ts` + `/api/config`; statics → `three/constants.ts`)

---

## Phase 13 — Frontend: UI Panels

**Verification with Playwright Agent CLI** (`playwright-cli`, `@playwright/cli@0.1.15`, installed globally). The panels are plain DOM (Bootstrap), so agent-cli's accessibility-ref model drives them deterministically and token-efficiently — use it to build + verify each panel against the running dev server (`npm run dev`), not by eyeballing screenshots:
- Drive each panel: `playwright-cli navigate http://localhost:5173`, then ref-based `click` / `type` / `upload` to exercise buttons, dropdowns, the File upload, and the Undo/Redo buttons.
- **WebGL caveat:** the 3D canvas is opaque to the a11y tree. Assert scene results (node counts/positions, applied layout/cluster/scale) via the `window.__arena = { ctx, history }` hook exposed in Phase 12, read with `playwright-cli`'s JS-eval, rather than pixel diffs.
- As panels stabilise, capture the driven flows as durable `@playwright/test` specs for Phase 14 (agent-cli drives/authoring; `@playwright/test` is the committed artifact).

- [x] Build `frontend/index.html` — Bootstrap 5 navbar (`data-bs-theme="dark"`, bootstrap css+js imported in `main.ts`) with the 11 v2 tabs as `data-bs-toggle="tab"` buttons over empty `#panel-*` panes (each `views/*.R` port fills its pane; Main View pane intentionally empty — selecting it reveals the canvas). v2 helper divs added (`#navControlButtonsDiv`, `#info`, `#loader`, `#descrDiv`). Verified live with playwright-cli (tabs listed in a11y tree, click switches active pane).
- [x] Migrate Home panel (`views/home.R` → `src/ui/home.ts`) — static HTML into `#panel-home`, `link_to_examples`/`link_to_fileInput` wired via new `ui/tabs.ts` `showTab` (Bootstrap Tab API). New `src/style.css`: fullscreen-canvas + panel-overlay layout replacing v2 positioning hacks (`#panel-main-view` kept invisible so the canvas shows through), `#info`, `#logo1`. Images copied to `frontend/public/images/`. Verified live (links switch to File/Help panes). Footer → separate task.
- [x] Migrate File panel (`views/file.R` → `src/ui/file.ts`) — Upload Network (`api.uploadNetwork`→`loadNetwork`), Load Session (`api.importSession`→`loadSession`), Save Session (`exportSession`), Load Example (fetches bundled `public/example_network.tsv` = v2 aspirin 3-channel, uploads it). Node/edge attribute inputs shown **disabled** (deferred to `/api/attributes`, Phase 7). `#file_status` line shows success/error. Verified live (Load Example → backend build → 2 layers, 11 nodes in `ctx`).
- [x] Migrate Layer Selection & Layouts panel (`views/layouts.R` → `src/ui/layouts.ts`) — subgraph-scope radios, Select/Deselect All, per-layer checkbox group (select/Hide/Labels → `selectLayer`/`setLayerVisibility`/`setLayerNodeLabels`, rebuilt on `network:loaded`), channel layout list (all checked by default), layout/clustering/local-layout selects + Run (`applyLayout`; local algorithm used for `nodesPerLayers` scope), topology metric select (from `config.topology_metrics`) + Run (`applyTopology`). `#layouts_status` shows success/error. v2 hide-button collapse dropped (panels are Bootstrap tabs now).
- [x] Migrate Scene Actions panel (`views/scene.R` → `src/ui/scene.ts`) — scene-coords toggle (`Scene.toggleCoords`), auto-rotate checkbox (steady Y spin via `registerAnimateHook`; v2 tied it to the unported canvas rotate buttons), predefined-layout radios → `applyPredefinedLayout` (applied on change, as v2's `ignoreInit`). VR button dropped (Phase 7). Background color picker included (v2 injected it from `on_page_load.js initializeColorPickers` → `setRendererColor`). Also `#info` made `pointer-events: none` — its fixed overlay swallowed clicks on panel controls beneath it. Verified live (coords hide, rotation starts/halts, all 4 predefined layouts move layer planes).
- [x] Migrate Layer Actions panel (`views/layer.R` → `src/ui/layer.ts`) — show-labels radios (`showLayerLabels`), layer-coords + wireframe toggles, label-size (12–30) and floor-opacity (0–1) sliders, color-priority radios, floor color picker (v2 `initializeColorPickers` + `repaintLayersFromPicker`: picking a color flips priority to picker and repaints). Verified live (coords/wireframe/opacity on both layers, label divs resize+hide, floor color 777777→22cc88 and back on default priority).
- [x] Migrate Node Actions panel (`views/node.R` → `src/ui/node.ts`) — select/deselect-all checkbox, show-labels radios (default Selected), label-size slider (5–15), geometry radios (sphere/box/diamond/cone → `setNodeShape`), color-priority radios (default/cluster), highlight-selected checkbox, comma-separated search textarea (Enter selects matching nodes case-insensitively, v2 `selectSearchedNodes`). Verified live (select-all=11, geometry swaps SphereGeometry↔Box/Octahedron/Cone, search "aspirin"→1 node, unknown term→no change, labels show/resize).
- [x] Migrate Edge Actions panel (`views/edge.R` → `src/ui/edge.ts`) — direction toggle (shows arrow-size sliders), opacity-by-weight (hides manual opacity sliders — both show/hide behaviours ported from `functions/edges.R`), intra/inter arrow-size + edge-opacity + channel-curvature sliders, highlight-selected + loaded-edge-color-priority checkboxes, and the channel color/Hide list (`attachChannelEditList`, rebuilt on `network:loaded`). Verified live (defaults hide opacity+arrow sliders, toggles reveal them, curvature 18/8, channel color→#123456, channel Hide→visibility false).
- [x] Migrate View Data panel (`views/data.R` → `src/ui/data.ts`) — 6 sub-tabs (Network Data, Selected Edges, Clustering Data, Degree, Clustering Coefficient, Betweenness Centrality) as plain HTML tables with CSV download, replacing v2 DT datatables. Network table fills on `network:loaded`; Clustering/metric tables on `clustering:applied`/`topology:applied` (added `metric` to the topology event payload + `ApplyTopologyCommand` so results route to the right tab); Selected Edges recomputed from `ctx` on panel open (port of `functions/edges.R updateSelectedEdgesView`). Metric tabs hidden until their event fires (v2 `hideDataMetricTabs`), Selected Edges re-hides when nothing selected. Verified live (Network Data 21 aspirin rows, Degree tab appears after run w/ layers selected, Selected Edges 3 channel-rows on edge select then hides on deselect).
- [x] Migrate FPS panel (`views/fps.R` → `src/ui/fps.ts`) — 15/30/60 radios set `ctx.fps` (read by the `animate` loop). Default checked reflects the real `ctx.fps` (30) rather than v2's UI default of 15. Verified live (30 checked, switches to 60/15).
- [x] Migrate Help panel (`views/help.R` → `src/ui/help.ts`) — static HTML fragment in `#panel-help` with 12 inner tabs (data-attr driven `openHelpTab`, Examples default). Help images + example data copied to `public/images/help/` + `public/data/`; `./`→`/` asset paths, `max-width:100%` on imgs, `pre` scrolls. Help CSS ported into `style.css` (`#helpDiv .tab/.tabcontent/.numbering/.indent/.last_p`). Verified live (12 tabs, tab-switch Examples↔API, 19/19 images load).
- [x] Migrate footer (`views/footer.R` → static footer in `index.html`) — year set from `Date` in `main.ts` (v2 `YEAR` config var), CSS ported into `style.css` (white links for the dark bar; v2's `-8px` body-margin hack dropped). Verified live (year 2026, 2 lab links, fixed bottom).
- [x] Port edge-panel toggles from `functions/edges.R` into `src/ui/edge.ts` (done with the Edge panel above: `handleEdgeWidthByWeightCheckbox`/`handleEdgeDirectionCheckbox` slider show/hide). `updateSelectedEdgesView` ported into `src/ui/data.ts` (recomputed from `ctx` on View Data panel open). `functions/edges.R` fully ported; delete in Phase 14 cleanup.
- [x] Add Undo/Redo buttons wired to `CommandHistory` — navbar `ms-auto` button pair in `index.html`, wired in `event_listeners.ts` (click → `history.undo/redo`, disabled state tracks `history:changed`). Verified live (Load Example → Undo empties scene → Redo restores 11 nodes, disabled states follow).
- [x] Delete `views/`, `ui.R`, `server.R`, `www/arena3dweb.css` (+ fully-ported `functions/edges.R`). v2 favicon copied to `frontend/public/`. All panels verified live in the tasks above; remaining CSS rules were ported per-panel into `style.css`.

---

## Phase 14 — Final Cleanup & Production

- [x] Delete remaining `www/` (R) directory — `functions/`, `config/` already gone. The 3 test fixtures actually used moved to `backend/tests/fixtures/` (tests repointed); images were already in `frontend/public/`. `www/` deleted.
- [x] Delete `Arena3Dweb.Rproj`, `Rprofile.site`, `global.R` (dead R/Shiny startup config; `global.R` lib-loading maps to `backend/app/main.py`)
- [~] Docker production build — both stages verified independently (frontend `npm run build` ✓, backend `uv sync --frozen --no-group dev` ✓); `docker build`/`run` itself **not run** in this environment (Docker daemon socket permission denied). Fixed the README run port (`8080:8080`, was `8080:80`). Needs a real `docker build` on a machine with daemon access before release.
- [x] Full Playwright E2E test suite pass — `e2e/network-flow.spec.ts` + `playwright.config.ts`: Load Example → apply Fruchterman-Reingold (allLayers) → apply Louvain clustered layout → export session (download). Scene asserted via `window.__arena.ctx` (WebGL is opaque to the a11y tree); waits on scene state, not the reused status text. Passes green. Also: fixed `tsc -b` emitting stray `.js` beside sources (build now `tsc --noEmit && vite build`, tsconfig `noEmit`), added `frontend/.gitignore`, excluded `e2e/` from Vitest.
- [x] Update `CLAUDE.md` for new stack — rewritten for FastAPI + Vite/TS/Three.js; dropped the R/Shiny run instructions + living-spec framing (all R deleted).
- [x] Update `README.md` for new stack and Docker instructions — Overview/Features/Getting Started rewritten for FastAPI + Vite/TS/Three.js; dropped R/RStudio + VR; docker-compose + single-image build; example-data paths updated; Shiny badge → Live Demo.
- [ ] Swap `v3` → `main` (user will do this)
- [ ] Update Docker Hub build to point to new `main` (user will do this)
