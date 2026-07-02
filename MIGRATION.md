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
| `functions/input.R` | `backend/app/services/parser.py` + `backend/app/routers/network.py` | [ ] |
| `functions/init.R` | `backend/app/routers/config.py` + `backend/app/main.py` | [ ] |
| `functions/general.R` | `backend/app/services/parser.py` (file read) + `backend/app/services/topology.py` (`mapper()`) — JS-bridge helpers die with Shiny | [ ] |
| `functions/reset.R` | *(stateless server — no equivalent needed)* | [ ] |
| `functions/render.R` | *(absorbed into FastAPI error responses)* | [ ] |
| `functions/js_handling.R` | *(absorbed into frontend EventBus)* | [ ] |
| `functions/edges.R` | `frontend/src/ui/edge.ts` — UI visibility toggles + JS handler calls, no server logic | [ ] |
| `functions/vr.R` | `backend/app/routers/vr.py` — PLY + A-Frame HTML generation *(keep/drop decision, PLAN Phase 7)* | [ ] |
| `functions/igraph/general.R` | `backend/app/services/graph.py` | [ ] |
| `functions/igraph/layout.R` | `backend/app/services/layouts.py` | [ ] |
| `functions/igraph/cluster.R` | `backend/app/services/clustering.py` — folded into `POST /api/layout` as optional step | [ ] |
| `functions/igraph/topology.R` | `backend/app/services/topology.py` | [ ] |

---

## Frontend (JS → TypeScript/Vite)

| Old file | New file | Done |
|---|---|---|
| `www/js/three/three.js` *(patched)* | `three` npm package + `src/three/` extensions | [ ] |
| `www/js/three/matrix4.js` | `three` npm package (bundled) | [ ] |
| `www/js/three/drag_controls.js` | `three/examples/jsm/controls/DragControls` (npm) | [ ] |
| `www/js/classes/Scene.js` | `frontend/src/classes/Scene.ts` | [ ] |
| `www/js/classes/Layer.js` | `frontend/src/classes/Layer.ts` | [ ] |
| `www/js/classes/Node.js` | `frontend/src/classes/Node.ts` | [ ] |
| `www/js/classes/Edge.js` | `frontend/src/classes/Edge.ts` | [ ] |
| `www/js/config/global_variables.js` | `frontend/src/config/global_variables.ts` + `GET /api/config` | [ ] |
| `www/js/config/static_variables.js` | `frontend/src/config/static_variables.ts` | [ ] |
| `www/js/object_actions/canvas_controls.js` | `frontend/src/actions/canvas_controls.ts` | [ ] |
| `www/js/object_actions/network.js` | `frontend/src/actions/network.ts` | [ ] |
| `www/js/object_actions/layout.js` | `frontend/src/actions/layout.ts` | [ ] |
| `www/js/object_actions/layer.js` | `frontend/src/actions/layer.ts` | [ ] |
| `www/js/object_actions/node.js` | `frontend/src/actions/node.ts` | [ ] |
| `www/js/object_actions/edge.js` | `frontend/src/actions/edge.ts` | [ ] |
| `www/js/object_actions/screen.js` | `frontend/src/actions/screen.ts` | [ ] |
| `www/js/object_actions/themes.js` | `frontend/src/actions/themes.ts` | [ ] |
| `www/js/object_actions/labels.js` | `frontend/src/actions/labels.ts` | [ ] |
| `www/js/object_actions/right_click_menu.js` | `frontend/src/actions/right_click_menu.ts` | [ ] |
| `www/js/rshiny_handlers.js` | `frontend/src/bus/index.ts` + `frontend/src/api/client.ts` | [ ] |
| `www/js/rshiny_update.js` | `frontend/src/api/client.ts` | [ ] |
| `www/js/general.js` | `frontend/src/utils.ts` | [ ] |
| `www/js/event_listeners.js` | `frontend/src/event_listeners.ts` | [ ] |
| `www/js/on_page_load.js` | `frontend/src/main.ts` | [ ] |
| `www/arena3dweb.css` | Bootstrap 5 + `frontend/src/style.css` | [ ] |

---

## UI / Shell (R/Shiny → HTML + TypeScript)

| Old file | New file | Done |
|---|---|---|
| `ui.R` | `frontend/index.html` | [ ] |
| `server.R` | `backend/app/main.py` + routers | [ ] |
| `global.R` | `backend/app/main.py` (lifespan) | [ ] |
| `views/home.R` | `frontend/src/ui/home.ts` | [ ] |
| `views/file.R` | `frontend/src/ui/file.ts` | [ ] |
| `views/layouts.R` | `frontend/src/ui/layouts.ts` | [ ] |
| `views/scene.R` | `frontend/src/ui/scene.ts` | [ ] |
| `views/layer.R` | `frontend/src/ui/layer.ts` | [ ] |
| `views/node.R` | `frontend/src/ui/node.ts` | [ ] |
| `views/edge.R` | `frontend/src/ui/edge.ts` | [ ] |
| `views/data.R` | `frontend/src/ui/data.ts` | [ ] |
| `views/fps.R` | `frontend/src/ui/fps.ts` | [ ] |
| `views/help.R` | `frontend/src/ui/help.ts` | [ ] |
| `views/footer.R` | `frontend/index.html` (static footer) | [ ] |

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
