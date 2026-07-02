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
- [ ] Delete `functions/input.R` — **deferred to Phase 7**: file also holds JSON import, session export, node/edge attribute uploads, example load. Only the TSV-upload portion is ported now.

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
- [ ] **Remaining in `functions/input.R`**: node/edge attribute-file uploads (`handleInputNodeAttributeFileUpload`, `handleInputEdgeAttributeFileUpload`) — not yet ported; map to a future `POST /api/attributes` endpoint. `input.R` deletion deferred until then.

---

## Phase 8 — Frontend: Foundation

- [ ] Install Three.js via npm, configure `@types/three`
- [ ] Implement `EventBus` singleton (`src/bus/index.ts`)
- [ ] Implement `AppState` store singleton (`src/store/index.ts`)
- [ ] Implement `Command` interface + `CommandHistory` singleton (`src/commands/base.ts`)
- [ ] Generate typed API client from FastAPI OpenAPI spec (`src/api/client.ts`)
- [ ] Verify API client can call all Phase 2–7 endpoints

---

## Phase 9 — Frontend: Three.js Classes

- [ ] Identify all manual patches in `www/js/three/three.js` — document each one
- [ ] Migrate `Scene.js` → `Scene.ts` — reimplement patches as subclasses in `src/three/`
- [ ] Migrate `Layer.js` → `Layer.ts`
- [ ] Migrate `Node.js` → `Node.ts`
- [ ] Migrate `Edge.js` → `Edge.ts`
- [ ] Write Vitest unit tests for all four classes
- [ ] Delete `www/js/classes/`, `www/js/three/`

---

## Phase 10 — Frontend: Commands

- [ ] Implement `LoadNetworkCommand`
- [ ] Implement `ApplyLayoutCommand` — captures node positions before/after, plus cluster IDs/colors when the layout ran with clustering (single command: one API response, one undo step)
- [ ] Implement `ApplyTopologyCommand` — captures node scale values before/after
- [ ] Implement `MoveLayerCommand` — captures layer transform before/after
- [ ] Implement `ChangeNodeColorCommand`
- [ ] Implement `ChangeNodeSizeCommand`
- [ ] Implement `ChangeEdgeColorCommand`
- [ ] Implement `ChangeThemeCommand`
- [ ] Write Vitest tests for execute/undo/redo on each command

---

## Phase 11 — Frontend: Object Actions

- [ ] Migrate `canvas_controls.js` → `src/actions/canvas_controls.ts`
- [ ] Migrate `layout.js` → `src/actions/layout.ts`
- [ ] Migrate `node.js` → `src/actions/node.ts`
- [ ] Migrate `edge.js` → `src/actions/edge.ts`
- [ ] Migrate `layer.js` → `src/actions/layer.ts`
- [ ] Migrate `network.js` → `src/actions/network.ts`
- [ ] Migrate `screen.js` → `src/actions/screen.ts`
- [ ] Migrate `themes.js` → `src/actions/themes.ts`
- [ ] Migrate `labels.js` → `src/actions/labels.ts`
- [ ] Migrate `right_click_menu.js` → `src/actions/right_click_menu.ts`
- [ ] Delete `www/js/object_actions/`

---

## Phase 12 — Frontend: Event Handling & Main Loop

- [ ] Migrate `general.js` → `src/utils.ts`
- [ ] Migrate `event_listeners.js` → `src/event_listeners.ts` — add `Ctrl+Z` / `Ctrl+Shift+Z` undo/redo
- [ ] Migrate `on_page_load.js` → `src/main.ts` — Three.js canvas setup, calls `GET /api/config` on load
- [ ] Replace `rshiny_handlers.js` + `rshiny_update.js` with typed EventBus + API client calls
- [ ] Delete `www/js/event_listeners.js`, `www/js/on_page_load.js`, `www/js/general.js`
- [ ] Delete `www/js/rshiny_handlers.js`, `www/js/rshiny_update.js`
- [ ] Delete `www/js/config/`

---

## Phase 13 — Frontend: UI Panels

- [ ] Build `frontend/index.html` — Bootstrap 5 navbar structure matching current tab layout
- [ ] Migrate Home panel (`views/home.R` → `src/ui/home.ts`)
- [ ] Migrate File panel (`views/file.R` → `src/ui/file.ts`)
- [ ] Migrate Layer Selection & Layouts panel (`views/layouts.R` → `src/ui/layouts.ts`)
- [ ] Migrate Scene Actions panel (`views/scene.R` → `src/ui/scene.ts`)
- [ ] Migrate Layer Actions panel (`views/layer.R` → `src/ui/layer.ts`)
- [ ] Migrate Node Actions panel (`views/node.R` → `src/ui/node.ts`)
- [ ] Migrate Edge Actions panel (`views/edge.R` → `src/ui/edge.ts`)
- [ ] Migrate View Data panel (`views/data.R` → `src/ui/data.ts`)
- [ ] Migrate FPS panel (`views/fps.R` → `src/ui/fps.ts`)
- [ ] Migrate Help panel (`views/help.R` → `src/ui/help.ts`) — 920 lines of mostly static HTML; port as an HTML fragment, not TS
- [ ] Migrate footer (`views/footer.R` → static footer in `index.html`)
- [ ] Port edge-panel toggles from `functions/edges.R` into `src/ui/edge.ts`, then delete it
- [ ] Add Undo/Redo buttons wired to `CommandHistory`
- [ ] Delete `views/`, `ui.R`, `server.R`, `www/arena3dweb.css`

---

## Phase 14 — Final Cleanup & Production

- [ ] Delete remaining `www/`, `functions/`, `config/` (R) directories
- [ ] Delete `Arena3Dweb.Rproj`, `Rprofile.site`, `global.R`
- [ ] Full Docker production build test — `docker build` + `docker run`
- [ ] Full Playwright E2E test suite pass — upload fixture network, apply layout, clustering, export session
- [ ] Update `CLAUDE.md` for new stack
- [ ] Update `README.md` for new stack and Docker instructions
- [ ] Swap `v3` → `main`
- [ ] Update Docker Hub build to point to new `main`
