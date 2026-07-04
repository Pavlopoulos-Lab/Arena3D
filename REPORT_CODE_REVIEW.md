# Code Review Report — Potential Bugs

Scope: full read of `backend/app` (services, routers, config) and `frontend/src` (three/, actions/, commands/, api/, bus/, store/, main). Findings ranked by severity. Line numbers from current `v3-fable-auto`.

## High

### H1. External session handoff is dead end-to-end
`POST /api/external` (backend/app/routers/external.py:48) returns `url: "{BASE}/?session={token}"`, but nothing in the frontend ever reads the `?session=` query parameter — `api.resolveExternal` and `api.createExternal` (frontend/src/api/client.ts:187-189) have zero callers, and `main.ts` never inspects `location.search`. A partner app following the returned URL gets an empty Arena3D with no network loaded.

**Fix:** in `main()` parse `new URLSearchParams(location.search).get('session')`, call `api.resolveExternal(token)` and `loadSession()`.

### H2. Malformed session crashes the frontend (missing referential validation)
`normalize_session` (backend/app/services/session.py) validates that nodes/edges have non-empty fields but never checks that:
- every `node.layer` exists in `layers`
- every `edge.src`/`edge.trg` exists in `nodes`

On the frontend, `buildFromSession` then does `ctx.layers[ctx.layerGroups[n.layer]].addNode(...)` (frontend/src/actions/network.ts:205) — `undefined.addNode` throws — and `Edge.initIndexVariables` (frontend/src/three/Edge.ts) gets `sourceNodeIndex = -1`, so `decidePoints()` calls `ctx.nodeObjects[-1].getWorldPosition()` and crashes. Since `/api/external` accepts arbitrary third-party payloads, this is a realistic input, not just user error. Result: white screen mid-`LoadNetworkCommand.execute`, leaving `ctx` half-reset.

**Fix:** validate both referential constraints in `_validate` and return HTTP 400.

### H3. `setChannelVisibility` toggles the wrong object
frontend/src/actions/edge.ts:482: `if (ctx.isDirectionEnabled) children[j + 1].visible = visible // arrow`. The `[line, arrow, line, arrow…]` interleave only holds when every channel curve got an arrow — `createCurve` skips the arrow when its `opacity === 0` (Edge.ts:1188). With direction enabled and any zero-opacity channel, `children[j+1]` is the *next channel's line*, which gets hidden/shown incorrectly; can also read past the array end (last child) → no crash but silent wrong state. Also, if direction was enabled *after* the edge was drawn (before redraw), there is no arrow at all.

**Fix:** locate the arrow by `userData.tag === channel && child instanceof ArrowHelper` instead of positional `j+1`.

## Medium

### M1. Channel-removal warning is dead code and dropped anyway
backend/app/services/session.py `_handle_channels`: after `e.pop("channel")` runs for **all** edges, the guard `if not all(_empty(e.get("channel")))` is always false, so the "Removing channels completely" warning can never be appended. And the only caller does `edges, _ = _handle_channels(edges)`, discarding warnings. Users importing a session with one missing channel silently lose all channel data.

**Fix:** compute the warning condition *before* popping; propagate warnings into the `SessionImportResponse`.

### M2. Duplicate layer names pass validation and corrupt the frontend registry
`_validate` (session.py) checks `len({row["name"] for row in layers}) > MAX_LAYERS` but never rejects duplicate names. On import, `ctx.layerGroups[l.name] = i` (network.ts:159) silently keeps only the last index — nodes of the earlier duplicate layer are parented to the wrong plane, and `ctx.layers.length !== |layerGroups|` breaks label indexing (`layerLabelsDivs[i]` mismatch).

**Fix:** reject duplicate layer names in `_validate`.

### M3. Session import derives `source_node` by slicing — garbage for unknown nodes
frontend/src/actions/network.ts:219: `e.src.slice(0, -(ctx.nodeGroups[e.src] ?? '').length - 1)`. When `nodeGroups[e.src]` is undefined (see H2) the fallback `''` makes this `slice(0, -1)` — chops the last character of the id instead of the layer suffix. The mangled `source_node`/`source_layer` rows are stored into `store.network.edges` and later sent back to `/api/layout` and `/api/topology`, silently distorting scopes (`intra_layer_edges` matches on `source_layer`). Also ambiguous when node names themselves contain `_<layer>`.

**Fix:** resolve via the nodes list (`n.name`, `n.layer`) rather than string surgery; fail fast if lookup misses.

### M4. Cluster super-node repulsion collapses to origin when x == 0
backend/app/services/clustering.py `_super_node_coords`: `a = y / x if x != 0 else y / 0.01`, then `result[c] = (x * 3, a * x)` — when `x == 0`, `a * x == 0`, so the community lands exactly at `(0, 0)` regardless of `y`, i.e. the opposite of "repelled from the origin". (Layouts like Circle/Grid routinely produce x = 0.) The whole slope-based scheme also flips the sign of y when x < 0 — `x*3, a*x*… ` preserves the quadrant, fine — but the x == 0 branch is plainly wrong.

**Fix:** scale the vector directly: `result[c] = (x * F, y * F)`.

### M5. `_sweep` race → 500 on `/api/external`
backend/app/routers/external.py:34: `os.path.getmtime(path)` between `listdir` and `remove` — two concurrent POSTs sweeping the same expired file, or a concurrent GET, raise `FileNotFoundError` and fail the request.

**Fix:** wrap the per-file stat/remove in `try/except OSError: continue`.

### M6. Single-edge layers silently get no topology scaling
backend/app/services/topology.py:73: `if len(layer_edges) < 2: continue`. One edge does form a valid graph; a layer with a single edge gets no node scaling and no raw values, with no warning. The comment claims "fewer than 2 edges cannot form a graph", which is false — likely a mis-port of v2's guard (v2 needed ≥2 *rows* for `graph_from_data_frame`?). Verify against v2 intent; if kept, surface a warning to the client.

### M7. `Edge.importedColors` aliases `colors`
frontend/src/three/Edge.ts:999: `this.importedColors = this.colors` — same array reference. Today all writers (`ChangeEdgeColorCommand`, `applyEdgeAttributes`) happen to write both or replace both, so nothing visibly breaks — but any future single-array mutation silently corrupts the "imported" baseline used by `edgeFileColorPriority` and undo.

**Fix:** `this.importedColors = [...this.colors]`.

## Low

### L1. Hovered node gets swept into lasso selection
canvas_controls.ts `clickUp` selects every node with `getOpacity() === 0.5` — but node *hover* also sets opacity 0.5 (node.ts:628). A node hovered at mouse-up outside the lasso rectangle gets selected. Use a dedicated flag/set for lasso membership instead of the opacity sentinel.

### L2. Ctrl+Z fires while typing in inputs
event_listeners.ts `handleUndoRedo` is on `window` with no target check; Ctrl+Z inside the node-search box or any text input undoes scene commands instead of the text edit. Guard on `event.target instanceof HTMLInputElement/…`.

### L3. Ctrl+Z with canvas focused also arms the 'z' axis
canvas_controls.ts `keyPressed` sets `ctx.scene.axisPressed = 'z'` without checking `ctrlKey/metaKey`, so Ctrl+Z (undo) with canvas focus briefly enters held-key transform mode; a drag before keyup moves nodes/layers unintentionally.

### L4. Theme state duplicated and store copy never updated
themes.ts keeps a module-local `currentTheme` while `store.AppState.currentTheme` exists but is never written. Anything reading the store's theme sees a stale `'dark'` forever. Drop one of the two.

### L5. `channelColors[channel]` may be undefined when drawing
Edge.ts `decideColor`: `ctx.channelColors[this.channels[i]]` — a channel missing from the registry (e.g. after a palette reassign with fewer entries, or session edge channels not passed through `initializeChannels`) yields `new THREE.Color(undefined)` → silently white. Fall back to `ctx.edgeDefaultColor`.

### L6. `_BASE_URL` read once at import
external.py reads `ARENA_PUBLIC_URL` at module import; env changes (tests, reconfig) are ignored, and the empty default produces a relative `/?session=…` that is wrong when the API is served on a different origin than the frontend. Read per-request or document the constraint.

## Notes (checked, not bugs)

- `random.seed(req.seed)` in layouts.py does seed igraph — python-igraph's default RNG is Python's `random` module.
- Sugiyama dummy-vertex trimming via `range(graph.vcount())` is correct.
- `disposeSnapshot`/`LoadNetworkCommand.dispose` ownership rules look sound (only `next` disposed, live-scene guard present).
- Parser weight/channel validation paths are solid; limits enforced server-side.
