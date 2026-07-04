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

TTL_SECONDS = 24 * 60 * 60
_BASE_URL = os.environ.get("ARENA_PUBLIC_URL", "")


def _sweep() -> None:
    """Delete stored sessions older than the TTL (ports the tmp cleanup intent)."""
    if not os.path.isdir(config.TMP_PATH):
        return
    cutoff = time.time() - TTL_SECONDS
    for name in os.listdir(config.TMP_PATH):
        if not name.endswith(".json"):
            continue
        path = os.path.join(config.TMP_PATH, name)
        # A concurrent sweep/resolve may remove or stat the file between the
        # listdir and here; skip rather than 500 the request.
        try:
            if os.path.getmtime(path) < cutoff:
                os.remove(path)
        except OSError:
            continue


@router.post("/api/external", response_model=ExternalCreateResponse)
async def create_external(session: dict[str, Any]) -> ExternalCreateResponse:
    os.makedirs(config.TMP_PATH, exist_ok=True)
    _sweep()
    token = secrets.token_urlsafe(16)
    with open(os.path.join(config.TMP_PATH, f"{token}.json"), "w") as fh:
        json.dump(session, fh)
    return ExternalCreateResponse(token=token, url=f"{_BASE_URL}/?session={token}")


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
