"""POST /api/network — TSV upload. Replaces handleUploadNetwork() (functions/input.R)."""

from fastapi import APIRouter, HTTPException, UploadFile

from app.models.network import NetworkModel
from app.services.parser import NetworkValidationError, parse_network_tsv

router = APIRouter()


@router.post("/api/network", response_model=NetworkModel)
async def upload_network(file: UploadFile) -> NetworkModel:
    raw = (await file.read()).decode("utf-8", errors="replace")
    try:
        return parse_network_tsv(raw)
    except NetworkValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
