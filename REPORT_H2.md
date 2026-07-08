# Arena3D v3.0.0 Pre-Release Audit — High finding H2

Date: 2026-07-08. Companion to `AUDIT_REPORT_2026-07-08.md` (H1 = quadratic blow-up in clustered layout). Reproduced empirically against the code in `backend/.venv`.

---

## High

### H2. Unbounded token-session storage — unauthenticated disk-exhaustion DoS
`backend/app/routers/external.py:44-60` (`create_external`)

`POST /api/external` validates a caller-supplied session, then writes it to `tmp/<token>.json` unconditionally:

```python
os.makedirs(config.TMP_PATH, exist_ok=True)
_sweep()
token = secrets.token_urlsafe(16)
with open(os.path.join(config.TMP_PATH, f"{token}.json"), "w") as fh:
    json.dump(session, fh)
```

There is **no cap on the number of stored sessions, no cap on total bytes on disk, and no per-caller limit.** The only reclamation is `_sweep()`, which deletes files **older than 24 h** (`TTL_SECONDS = 86400`). So between sweeps, storage grows without bound.

Each stored file is capped only by `MAX_UPLOAD_BYTES` (default **20 MB** — the Content-Length middleware and the per-endpoint checks bound one request, not the count of requests). An unauthenticated attacker scripting `POST /api/external` with near-20 MB valid sessions fills disk at ~20 MB/request, hundreds of GB within minutes, and nothing evicts it for 24 h. Disk exhaustion takes down the uvicorn worker, nginx logging, and anything else sharing the volume.

Reproduced — five posts, five files, no cap, sweep is age-only:

```
files written: 5
any count/total-size limit in create_external?  NO — writes unconditionally
sweep TTL seconds: 86400
per-file bytes: 99  -> capped only by MAX_UPLOAD_BYTES = 20971520
```

This is distinct from H1: H1 is in-request memory/CPU (transient, one request); H2 is **persistent shared-disk exhaustion** that outlives the request and compounds across requests. Both are unauthenticated.

**Aggravating factor.** `_sweep()` runs inline on every create (`os.listdir` + `getmtime` per entry). As the directory grows into the millions of files, each new create walks the whole directory — so the attack also degrades create latency super-linearly, and the sweep itself becomes a cost multiplier rather than a mitigation.

**Fix options (defense in depth — apply more than one):**
- Cap concurrent stored sessions: before writing, if `len(os.listdir(TMP_PATH))` ≥ a ceiling (e.g. a few thousand), reject with 429/503, or evict oldest.
- Cap total bytes on disk (sum of file sizes) with the same reject/evict.
- Shorten the TTL well below 24 h (a handoff token is consumed within minutes — an hour is generous), and/or delete the token file on first successful `resolve_external` (single-use handoff).
- Rate-limit `/api/external` at the reverse proxy (nginx `limit_req`), since the endpoint writes to disk on every hit.
- Move token storage off the same volume as logs/app, and/or to a size-bounded store, so exhaustion can't cascade.

Note the same content-length caveat documented in `main.py` applies here: a **chunked** (no Content-Length) request bypasses the middleware and is buffered fully before the per-endpoint check, so pairing the storage cap with a proxy-level body/rate limit is worthwhile.
