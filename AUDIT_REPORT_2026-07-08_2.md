# Arena3D — Pre-release Code Audit (v3.0.0)

**Date:** 2026-07-08
**Scope:** Full repo — FastAPI backend (`backend/app`), TypeScript/Three.js frontend (`frontend/src`), Docker/nginx deploy config.
**Method:** Manual review + targeted runtime reproduction of suspect paths. Backend test suite (65 tests) passes; `npm audit` clean.

## Summary

The codebase is in good shape. Prior XSS/DoS hardening (escaping in innerHTML templates, upload-size caps, node/edge count limits on every JSON entry point, `javascript:`/`data:` URL blocking, CSP) is present and holds up. No critical vulnerabilities found.

The findings are mostly **input-validation gaps that turn malformed uploads into HTTP 500s** (crash / stack-trace leak) instead of clean 400s, plus a couple of correctness/robustness nits. All backend crashes below are **reproduced**, not theoretical.

| # | Severity | Area | Issue |
|---|----------|------|-------|
| 1 | Medium | backend/parser | Malformed TSV → uncaught exceptions → HTTP 500 (3 variants) |
| 2 | Medium | backend/session | Non-object list members in session JSON → `AttributeError` → 500 |
| 3 | Medium | backend/layout+topology | Negative edge weights → igraph `InternalError` → 500 |
| 4 | Low | backend/models | `inf`/`nan` weights accepted by Pydantic, propagate as invalid JSON |
| 5 | Low | frontend/utils | `escapeHtml` does not escape `'` (single quote) |
| 6 | Low | frontend/edge.ts | Channel color interpolated into `value="…"` attribute unescaped |
| 7 | Low | frontend/api | `resolveExternal` token not URL-encoded into path |
| 8 | Info | deploy | No rate limiting on compute-heavy endpoints; CSP allows `style-src 'unsafe-inline'` |

---

## Findings

### 1. Malformed TSV upload → HTTP 500 (Medium)

`backend/app/services/parser.py`

Three distinct crash paths, all reachable from `POST /api/network` (and the attribute endpoints share the pattern):

**1a. Empty file.** `parse_network_tsv("")` → pandas `EmptyDataError: No columns to parse from file`. Not caught by `NetworkValidationError`, so it escapes as a 500.

```
TSV 500!: ''  EmptyDataError  No columns to parse from file
```

**1b. Empty mandatory cell.** A row with a blank `SourceLayer` (etc.) becomes `NaN` after pandas parse. `_validate` only checks column *presence*, not cell content, so the `NaN` reaches `EdgeModel(...)` and Pydantic raises `ValidationError` (`Input should be a valid string ... input_value=nan`) → 500.

```
tsv = "SourceNode\tSourceLayer\tTargetNode\tTargetLayer\nA\t\tB\tL2\n"
→ pydantic_core.ValidationError: 2 validation errors for EdgeModel  (src, source_layer = nan)
```

**Fix:** wrap `pd.read_csv` and reject empty input in `_read`/`parse_network_tsv` with `NetworkValidationError`; in `_validate`, reject rows where any mandatory column is empty/NaN (mirror the session validator, which *does* check this). Root cause is shared — one guard in the parse path covers `/api/network` and both attribute uploads.

### 2. Non-object members in session JSON → HTTP 500 (Medium)

`backend/app/services/session.py:41,58,64`

`_validate` assumes every element of `layers`/`nodes`/`edges` is a dict and calls `.get()`/subscripts on it. A payload like `{"layers": ["x"], "nodes": [], "edges": []}` — valid JSON, passes the `MANDATORY_JSON_OBJECTS` subset check — crashes:

```
{"layers": ["x"], ...}                 → AttributeError: 'str' object has no attribute 'get'
{"layers": "abc", ...}                 → AttributeError: 'str' object has no attribute 'get'
{"layers":[{"name":"L"}],"nodes":["n"]} → AttributeError: 'str' object has no attribute 'get'
```

Reachable from `POST /api/session/import` **and** `POST /api/external` (which calls `normalize_session` on caller-supplied JSON). The latter is the more exposed surface — an external partner app posts arbitrary JSON.

**Fix:** at the top of `_validate`, assert `layers`/`nodes`/`edges` are lists and every member is a dict, raising `SessionValidationError` otherwise.

### 3. Negative edge weights → HTTP 500 (Medium)

`backend/app/services/topology.py:32` (betweenness), and layout algorithms that consume weights.

Nothing constrains `weight`/`scaled_weight` to be positive. igraph's weighted betweenness (and several weighted layouts) require positive weights:

```
g.betweenness(weights=[-1.0, 2.0]) → InternalError: Edge weights must be positive for betweenness
```

`POST /api/layout` and `POST /api/topology` accept `edges` directly (not only via the TSV flow), so a caller can send negative `scaled_weight` and 500 the endpoint. The TSV upload path scales weights into `[0.1, 1.0]` so it's safe, but the direct JSON endpoints are not.

**Fix:** validate `scaled_weight > 0` (and `weight` finite) in `EdgeModel`, or clamp/reject in `build_graph`.

### 4. `inf`/`nan` weights accepted by Pydantic (Low)

`backend/app/models/network.py:19-20`

```
EdgeModel(..., weight=inf, scaled_weight=nan) → accepted
```

Python floats `inf`/`nan` serialize to invalid JSON (`Infinity`/`NaN`), which breaks strict JSON consumers and can propagate NaN coordinates to the frontend. Add `Field(allow_inf_nan=False)` on `weight`/`scaled_weight` (and the same on topology/layout numeric fields). Overlaps with #3 — a single positive-finite constraint on `scaled_weight` closes both.

### 5. `escapeHtml` omits the single quote (Low)

`frontend/src/utils.ts:6`

Escapes `& < > "` but not `'`. Current call sites interpolate into double-quoted attributes and element text, so this is not currently exploitable — but it's a latent footgun: any future single-quoted attribute template (`id='...'`, inline `onclick='...'`) becomes injectable. Add `.replace(/'/g, '&#39;')` for defense-in-depth; it's a one-line change and makes the helper safe by default.

### 6. Channel color interpolated into attribute unescaped (Low)

`frontend/src/ui/edge.ts:96`

```ts
value="${ctx.channelColors[ch] ?? '#cfcfcf'}"
```

`ch` is escaped, but the color value is not. Today `channelColors` values come from the config palette or a `<input type=color>` (always `#rrggbb`), so it's safe. But session-import edge colors flow into channel color state (`network.ts`), and `_default(e.get("color"), EDGE_DEFAULT_COLOR)` on the backend does **not** validate that a color is a real hex string — an imported session can carry `color: '"><img src=x onerror=...>'`. It lands in a `type="color"` input value inside `innerHTML`. The CSP (`script-src 'self'`) blocks the payload from executing, so this is defense-in-depth, not an active hole. Escape it, or validate colors are `#rrggbb` on import.

### 7. External token not URL-encoded (Low)

`frontend/src/api/client.ts:192`

```ts
fetch(`/api/external/${token}`)
```

`token` comes from the `?session=` query param, unencoded. The backend validates the token charset server-side (so no traversal), but a token containing `/` or `?` on the client side builds a malformed URL / wrong path. Wrap with `encodeURIComponent(token)`. Cosmetic robustness.

### 8. Deployment notes (Info)

- **No rate limiting.** `/api/layout` and `/api/topology` run O(V·E) algorithms (betweenness) up to `MAX_EDGES=10000` / `MAX_NODES=20000` per request, unauthenticated. Size caps bound a single request, but nothing bounds request *rate* — a small script can saturate CPU. Consider a reverse-proxy rate limit (nginx `limit_req`) for `/api/`.
- **CSP `style-src 'unsafe-inline'`** (nginx.conf:23) is required by the current inline-style approach (labels, panels set `style.*`) and Bootstrap. Acceptable, but worth noting it weakens the CSP against style-based exfiltration. Not actionable without removing inline styles.
- **`_sweep()` runs inline on every `POST /api/external`** (external.py:54) — an `os.listdir` + `getmtime` per create. Fine at low volume; if the tmp dir grows large it adds latency to each create. Low priority.

---

## What was checked and found clean

- **XSS in innerHTML templates:** layer names, channel names, node/edge data all routed through `escapeHtml` before interpolation (`ui/layouts.ts`, `ui/edge.ts`, `ui/data.ts`); node descriptions/labels use `textContent`. Good.
- **`javascript:`/`data:` URL injection:** `openNodeLink` allow-lists `http(s)`/`mailto` and opens with `noopener,noreferrer` (`right_click_menu.ts:231`). Good.
- **Path traversal on external tokens:** server-side charset guard in `resolve_external` (external.py:66). Good.
- **Upload-size DoS:** Content-Length middleware + per-endpoint `MAX_UPLOAD_BYTES` checks + nginx `client_max_body_size`. Layered correctly.
- **Node/edge count DoS:** `Field(max_length=…)` on layout/topology requests, count checks in the session validator and TSV parser. Covers all JSON entry points.
- **Dependencies:** `npm audit` clean; backend on current FastAPI/Starlette/Pydantic/pandas/igraph. No known CVEs surfaced.
- **`combine_edges`/simplify, clustering super-node repel:** the x==0 collapse bug is already fixed (clustering.py:86-88).

## Recommended priority for v3.0.0

Fix **#1, #2, #3** before release — they're trivially triggered by a malformed upload or a crafted `/api/external` payload and turn into 500s (bad UX + stack-trace leakage in a non-debug deploy is limited, but the crashes are real). #4–#7 are hardening; batch them in. #8 is deployment guidance.
