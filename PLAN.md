# Fix Plan — Code Review Findings

Source: `REPORT_CODE_REVIEW.md` (commit 5f3a04a). One item = one commit. Check off when merged.

## High

- [x] **H1. Wire external session handoff** — in `frontend/src/main.ts`, parse `new URLSearchParams(location.search).get('session')`; if present, call `api.resolveExternal(token)` and `loadSession()` after setup. E2E test: POST a session to `/api/external`, open returned URL, assert network loaded.
- [x] **H2. Validate session referential integrity** — in `backend/app/services/session.py _validate`: reject node.layer ∉ layer names and edge src/trg ∉ node ids (HTTP 400). Unit tests for both.
- [x] **H3. Fix `setChannelVisibility` arrow lookup** — in `frontend/src/actions/edge.ts`, replace positional `children[j + 1]` with lookup by `userData.tag === channel` + ArrowHelper type; toggle all matches, drop the fragile interleave assumption.

## Medium

- [x] **M1. Surface channel-removal warning** — `session.py _handle_channels`: compute warning before popping channels; return warnings through `SessionImportResponse` and show in frontend file panel.
- [x] **M2. Reject duplicate layer names** — `session.py _validate`: error on duplicate `layers[].name`.
- [x] **M3. Stop deriving `source_node` by slicing** — `frontend/src/actions/network.ts buildFromSession`: resolve source/target node + layer from the session nodes list, not `slice(0, -len-1)` string surgery.
- [x] **M4. Fix super-node repulsion at x == 0** — `backend/app/services/clustering.py _super_node_coords`: replace slope hack with direct vector scaling `(x * F, y * F)`.
- [x] **M5. Guard `_sweep` race** — `backend/app/routers/external.py`: wrap per-file stat/remove in `try/except OSError: continue`.
- [x] **M6. Single-edge layer topology** — `backend/app/services/topology.py`: verify v2 intent for the `len(layer_edges) < 2` skip; either compute for 1 edge or return a client-visible warning.
- [x] **M7. Un-alias `Edge.importedColors`** — `frontend/src/three/Edge.ts`: `this.importedColors = [...this.colors]`.

## Low

- [x] **L1. Dedicated lasso membership flag** — `canvas_controls.ts`: track lasso-hit nodes in a Set instead of the opacity===0.5 sentinel (hover pollution).
- [x] **L2. Skip undo/redo in text inputs** — `event_listeners.ts handleUndoRedo`: return early when `event.target` is input/textarea/contentEditable.
- [x] **L3. Don't arm axis keys with Ctrl held** — `canvas_controls.ts keyPressed`: ignore z/x/c when `ctrlKey || metaKey`.
- [x] **L4. Single source of truth for theme** — write theme changes to `store` (or drop `AppState.currentTheme`); remove module-local duplicate in `themes.ts`.
- [x] **L5. Fallback for unknown channel color** — `Edge.decideColor`: `ctx.channelColors[...] ?? ctx.edgeDefaultColor`.
- [x] **L6. `ARENA_PUBLIC_URL` read per request** — `external.py`: read env inside handler (or document the import-time constraint).

## UI

- [ ] **U1. Fix unreadable select options** — layout/clustering/local-layout/topology-metric `<select class="form-select">` dropdowns (`frontend/src/ui/layouts.ts`) render light text on light background. Add explicit `color`/`background-color` for `select.form-select` and its `option`s in `frontend/src/style.css` so options are readable in all themes.
