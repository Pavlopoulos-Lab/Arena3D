# Arena3D v3.0.0 Pre-Release Audit — 2026-07-08

Scope: full repo (backend FastAPI app, frontend Vite/TS/Three.js app, Docker/nginx deployment config, dependencies). Method: manual code review of all backend modules and all security-relevant frontend modules, plus empirical reproduction of every crash-path finding against the code in `backend/.venv` (all "verified" findings below were actually reproduced). Backend test suite passes (65 passed). `npm audit`: 0 vulnerabilities. Key Python deps (FastAPI, Starlette, pydantic, pandas, igraph, python-multipart) are current versions.

Overall: the codebase is in good shape for release. Prior hardening passes clearly landed (upload size caps, node/edge/layer count limits, HTML escaping in UI panels, `textContent` for labels/descriptions, URL scheme allowlist + `noopener`, path-traversal guard on tokens, CSP, `secrets.token_urlsafe`). The findings below are ranked.

---

## High

### H1. Quadratic blow-up in clustered layout — unauthenticated memory/CPU DoS
`backend/app/services/clustering.py:117-120` (`_local_group_coords`)

The local layout adds a tiny edge between **every pair** of community members:

```python
for i in range(len(members)):
    for j in range(i + 1, len(members)):
        edge_pairs.append((i, j))
```

`LayoutRequest` caps nodes at `MAX_NODES` (20 000) and edges at `MAX_EDGES` (10 000), but community sizes are not bounded. A crafted `/api/layout` request with clustering enabled and one large, densely-connected community (or a no-edge layout over 20k isolated nodes that Label Propagation puts in few clusters — worst case a single community of ~20 000 members) builds up to **≈2×10⁸ Python tuples + floats** (multiple GB) before igraph even runs, then hands igraph a graph with 2×10⁸ edges. One request can OOM the worker. Even 5 000 members ≈ 12.5M tuples is seconds of CPU and hundreds of MB per request, unauthenticated.

**Fix options:** cap community size for the all-pairs step (e.g. above N members, connect members to a virtual hub or sample pairs); or cap `len(members)² ` work with a validation error; or build the tiny-edge graph directly in igraph (`Graph.Full`