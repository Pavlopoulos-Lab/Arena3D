"""POST /api/network — TSV upload. Replaces handleUploadNetwork() (functions/input.R)."""

from fastapi import APIRouter, HTTPException, UploadFile

from app import config
from app.models.network import NetworkModel
from app.services.parser import NetworkValidationError, parse_network_tsv

router = APIRouter()


@router.post("/api/network", response_model=NetworkModel)
async def upload_network(file: UploadFile) -> NetworkModel:
    raw_bytes = await file.read()
    # DoS fix: reject oversized uploads before pandas parses the whole file
    # into memory — MAX_EDGES was only checked *after* the parse completed.
    if len(raw_bytes) > config.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large.")
    raw = raw_bytes.decode("utf-8", errors="replace")
    try:
        return parse_network_tsv(raw)
    except NetworkValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
