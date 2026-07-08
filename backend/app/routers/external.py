"""External API — ports resolveAPI(). A caller POSTs a session; we store it under a
random token in tmp/ (TTL-swept) and hand back a self-contained URL. GET resolves the
token back to a normalized session, same as a file import.

Token-in-file (not base64-in-URL) because MAX_EDGES=10k sessions blow past URL limits
(SPEC §5). These tmp files are the one deliberate exception to the stateless server.
"""

import json
import os
import secrets
import time
from typing import Any

from fastapi import APIRouter, HTTPException

from app import config
from app.models.session import ExternalCreateResponse, SessionImportResponse
from app.services.session import SessionValidationError, normalize_session

router = APIRouter()

# Handoff tokens are consumed within minutes of creation, so a short TTL keeps
# steady-state storage tiny. MAX_TOKENS is the hard disk-fill DoS guard (H2):
# combined with the per-request MAX_UPLOAD_BYTES cap it bounds tmp/ to at most
# MAX_TOKENS * MAX_UPLOAD_BYTES regardless of request volume.
TTL_SECONDS = 60 * 60
MAX_TOKENS = 1000


def _session_files() -> list[str]:
    if not os.path.isdir(config.TMP_PATH):
        return []
    return [
        os.path.join(config.TMP_PATH, n) for n in os.listdir(config.TMP_PATH) if n.endswith(".json")
    ]


def _sweep() -> None:
    """Delete stored sessions older than the TTL (ports the tmp cleanup intent)."""
    cutoff = time.time() - TTL_SECONDS
    for path in _session_files():
        # A concurrent sweep/resolve may remove or stat the file between the
        # listdir and here; skip rather than 500 the request.
        try:
            if os.path.getmtime(path) < cutoff:
                os.remove(path)
        except OSError:
            continue


def _enforce_cap() -> None:
    """DoS guard (H2): before a new write, evict oldest sessions so at most
    MAX_TOKENS-1 remain. Evict (not reject) so an attacker can't deny the
    feature to legitimate callers by keeping the store full.

    ponytail: TOCTOU under concurrent creates can briefly exceed the cap by the
    concurrency count; the bound is MAX_TOKENS + in-flight, which is fine.
    """
    paths = _session_files()
    if len(paths) < MAX_TOKENS:
        return
    dated: list[tuple[float, str]] = []
    for path in paths:
        try:
            dated.append((os.path.getmtime(path), path))
        except OSError:
            continue
    dated.sort()  # oldest first
    for _, path in dated[: len(dated) - MAX_TOKENS + 1]:
        try:
            os.remove(path)
        except OSError:
            continue


@router.post("/api/external", response_model=ExternalCreateResponse)
async def create_external(session: dict[str, Any]) -> ExternalCreateResponse:
    # DoS fix: validate (incl. MAX_NODES/MAX_EDGES) before anything touches
    # disk — this endpoint used to write any payload straight to disk
    # unvalidated, letting a caller fill server storage with oversized sessions.
    try:
        normalize_session(session)
    except SessionValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    os.makedirs(config.TMP_PATH, exist_ok=True)
    _sweep()
    _enforce_cap()
    token = secrets.token_urlsafe(16)
    with open(os.path.join(config.TMP_PATH, f"{token}.json"), "w") as fh:
        json.dump(session, fh)
    # read per request so redeploys / tests can change it without a restart
    base_url = os.environ.get("ARENA_PUBLIC_URL", "")
    return ExternalCreateResponse(token=token, url=f"{base_url}/?session={token}")


@router.get("/api/external/{token}", response_model=SessionImportResponse)
async def resolve_external(token: str) -> SessionImportResponse:
    # guard against path traversal — tokens are urlsafe base64, never contain / or .
    if not token.isalnum() and not all(c.isalnum() or c in "-_" for c in token):
        raise HTTPException(status_code=400, detail="Invalid token.")
    path = os.path.join(config.TMP_PATH, f"{token}.json")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Session not found or expired.")
    with open(path) as fh:
        data = json.load(fh)
    try:
        return SessionImportResponse(**normalize_session(data))
    except SessionValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
