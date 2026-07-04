"""Session import/export — ports loadNetworkFromJSONFilepath() and
convertSessionToJSON() from functions/input.R.

Export is a thin packaging endpoint: in the stateless design the frontend already
holds the full scene state, so the server just returns it as a JSON download.
"""

import json
from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.models.session import SessionImportResponse
from app.services.session import SessionValidationError, normalize_session

router = APIRouter()


@router.post("/api/session/import", response_model=SessionImportResponse)
async def import_session(file: UploadFile) -> SessionImportResponse:
    try:
        data = json.loads((await file.read()).decode("utf-8", errors="replace"))
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail="Bad imported network file format.") from e
    try:
        return SessionImportResponse(**normalize_session(data))
    except SessionValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/api/session/export")
async def export_session(session: dict[str, Any]) -> JSONResponse:
    return JSONResponse(
        content=session,
        headers={"Content-Disposition": 'attachment; filename="network.json"'},
    )
