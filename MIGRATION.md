# MIGRATION.md

Maps every old R/Shiny file to its replacement in the new stack.
**Deletion = done signal:** old files are deleted only after their replacement is tested.

See `PLAN.md` for the ordered implementation steps.

---

## Backend (R → Python/FastAPI)

| Old file | New file | Done |
|---|---|---|
| `config/server_variables.R` | `backend/app/config.py` | [x] |
| `config/global_variables.R` | `backend/app/config.py` | [x] |
| `config/static_variables.R` | *(mutable Shiny state — no equivalent in stateless server)* | [x] |
| `config/ui_variables.R` | *(absorbed into frontend config — see Removed)* | [x] |
| `functions/input.R` (TSV upload) | `backend/app/services/parser.py` + `routers/network.py` | [x] |
| `functions/input.R` (JSON import + export) | `backend/app/services/session.py` + `routers/session.py` | [x] |
| `functions/input.R` (attribute uploads) | `backend/app/services/attributes.py` + `routers/attributes.py` | [x] |
| `functions/init.R` | `backend/app/routers/config.py` + `backend/app/main.py` | [x] |
| `functions/general.R` | `backend/app/services/parser.py` (file read) + `topology.py`/`parser.py` (`mapper()`) — JS-bridge helpers die with Shiny | [x] |
| `functions/reset.R` | *(stateless server — no equivalent needed)* | [x] |
| `functions/render.R` | *(absorbed into FastAPI error responses)* | [x] |
| `functions/js_handling.R` | *(absorbed into frontend EventBus)* | [x] |
| `functions/edges.R` | `frontend/src/ui/edge.ts` (toggles) + `frontend/src/ui/data.ts` (`updateSelectedEdgesView`) | [x] |
| `functions/vr.R` | **DROPPED** — VR mode not ported (depended on external `bib.fleming.gr` hosting + A-Frame; niche, out of scope) | [x] |
| `functions/igraph/general.R` | `backend/app/services/graph.py` | [x] |
| `functions/igraph/layout.R` | `backend/app/services/layouts.py` | [x] |
| `functions/igraph/cluster.R` | `backend/app/services/clustering.py` — folded into `POST /api/layout` as optional step | [x] |
| `functions/igraph/topology.R` | `backend/app/services/topology.py` | [x] |

---

## Frontend (JS → TypeScript/Vite)

| Old file | New file | Done |
|---|---|---|
| `www/js/three/three.js` *(NOT patched — see below)* | `three` npm package (r170) | [x] |
| `www/js/three/matrix4.js` | `three` npm package (bundled) | [x] |
| `www/js/three/drag_controls.js` | `src/actions/drag_controls.ts` (hand-ported; npm three math) | [x] |
| `www/js/classes/Scene.js` | `frontend/src/three/Scene.ts` | [x] |
| `www/js/classes/Layer.js` | `frontend/src/three/Layer.ts` | [x] |
| `www/js/classes/Node.js` | `frontend/src/three/Node.ts` | [x] |
| `www/js/classes/Edge.js` | `frontend/src/three/Edge.ts` | [x] |

> **Phase 9 finding:** `www/js/three/three.js` was byte-for-byte identical to
> stock Three.js **r117** (verified by diff — only a missing trailing newline).
> The SPEC's "manually patched copy" claim is wrong: there are **no** core
> patches, so no `src/three/` subclasses were needed. The four classes ported to
> plain TS on npm `three` r170 (only API change: `THREE.Math` → `THREE.MathUtils`).
> Shared ambient globals from `static_variables.js` were replaced by a typed
> `src/three/runtime.ts` context; static geometry/palette constants by
> `src/three/constants.ts`. All four classes now live under `src/three/`
> (not the SPEC's split `classes/` + `three/`), since with no patches one folder
> suffices. `matrix4.js` / `drag_controls.js` deleted with `src/actions/drag_controls.ts`.
| `www/js/config/global_variables.js` | `frontend/src/three/runtime.ts` + `GET /api/config` | [x] |
| `www/js/config/static_variables.js` | `frontend/src/three/constants.ts` | [x] |
| `www/js/object_actions/canvas_controls.js` | `frontend/src/actions/canvas_controls.ts` + `src/actions/nav_controls.ts` | [x] |
| `www/js/object_actions/network.js` | `frontend/src/actions/network.ts` (upload build + session import) | [x] |
| `www/js/object_actions/layout.js` | `frontend/src/actions/layout.ts` | [x] |
| `www/js/object_actions/layer.js` | `frontend/src/actions/layer.ts` + `src/actions/nav_controls.ts` | [x] |
| `www/js/object_actions/node.js` | `frontend/src/actions/node.ts` + `src/actions/nav_controls.ts` | [x] |
| `www/js/object_actions/edge.js` | `frontend/src/actions/edge.ts` | [x] |
| `www/js/object_actions/screen.js` | `frontend/src/actions/screen.ts` | [x] |
| `www/js/object_actions/themes.js` | `frontend/src/actions/themes.ts` | [x] |
| `www/js/object_actions/labels.js` | `frontend/src/actions/labels.ts` | [x] |
| `www/js/object_actions/right_click_menu.js` | `frontend/src/actions/right_click_menu.ts` | [x] |
| `www/js/rshiny_handlers.js` | `frontend/src/bus/index.ts` + `frontend/src/api/client.ts` | [x] |
| `www/js/rshiny_update.js` | `frontend/src/api/client.ts` (store/bus replace Shiny input sync) | [x] |
| `www/js/general.js` | `frontend/src/utils.ts` | [x] |
| `www/js/event_listeners.js` | `frontend/src/event_listeners.ts` + `src/actions/canvas_controls.ts` + `src/actions/right_click_menu.ts` | [x] |
| `www/js/on_page_load.js` | `frontend/src/main.ts` + `src/actions/canvas_controls.ts` (color-picker inputs re-created in Phase 13 scene panel) | [x] |
| `www/arena3dweb.css` | Bootstrap 5 + `frontend/src/style.css` | [x] |

---

## UI / Shell (R/Shiny → HTML + TypeScript)

| Old file | New file | Done |
|---|---|---|
| `ui.R` | `frontend/index.html` | [x] |
| `server.R` | `backend/app/main.py` + routers | [x] |
| `global.R` | `backend/app/main.py` (lifespan) | [x] |
| `views/home.R` | `frontend/src/ui/home.ts` | [x] |
| `views/file.R` | `frontend/src/ui/file.ts` | [x] |
| `views/layouts.R` | `frontend/src/ui/layouts.ts` | [x] |
| `views/scene.R` | `frontend/src/ui/scene.ts` | [x] |
| `views/layer.R` | `frontend/src/ui/layer.ts` | [x] |
| `views/node.R` | `frontend/src/ui/node.ts` | [x] |
| `views/edge.R` | `frontend/src/ui/edge.ts` | [x] |
| `views/data.R` | `frontend/src/ui/data.ts` | [x] |
| `views/fps.R` | `frontend/src/ui/fps.ts` | [x] |
| `views/help.R` | `frontend/src/ui/help.ts` | [x] |
| `views/footer.R` | `frontend/index.html` (static footer) | [x] |

---

## Removed (no equivalent needed)

| Old file | Reason |
|---|---|
| `Arena3Dweb.Rproj` | R project file — not applicable |
| `Rprofile.site` | R startup config — not applicable |
| `config/ui_variables.R` | Shiny UI helpers absorbed into frontend |
| `functions/reset.R` | Stateless server has no session to reset |
| `functions/render.R` | FastAPI handles errors via HTTP status codes + JSON |
| `functions/js_handling.R` | Shiny checkbox sync — replaced by frontend state store |

---

## Algorithm Notes

Backend uses **python-igraph** — same C core as R's igraph, so all 11 layouts, 4 clustering algorithms, and 3 topology metrics port 1:1 with identical output (full mapping table in SPEC §5). Non-obvious renames and v2 parameters to preserve:

| v2 behaviour | Port note |
|---|---|
| `cluster_louvain()` | `Graph.community_multilevel()` (igraph's name for Louvain) |
| `layout_as_tree()` ("Reingold-Tilford") | `Graph.layout_reingold_tilford()` |
| `degree(mode = "all", loops = T, normalized = F)` | Raw `Graph.degree()` — **not** degree centrality |
| `transitivity(type = "weighted", isolates = "zero")` | `Graph.transitivity_local_undirected(weights=…)`, isolates → 0 |
| `betweenness(directed = input$edgeDirectionToggle, weights)` | Direction toggle + weights are request params |
| `set.seed(123)` before every layout | Seed igraph RNG per request — layouts must be reproducible |
| `NO_EDGE_LAYOUTS` (Circle, Grid, Random) | Run on pseudo-network linking isolated nodes with tiny weights (`filterPseudoNetwork()`) |
| Clustered layout | Supernode strategy in `cluster.R` (global layout on cluster graph + repelling force + local layout per cluster) — part of `/api/layout`, not a separate endpoint |
