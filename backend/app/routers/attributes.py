"""POST /api/attributes/{nodes,edges} — attribute-file TSV uploads.

Replaces handleInput{Node,Edge}AttributeFileUpload() (functions/input.R).
"""

from fastapi import APIRouter, HTTPException, UploadFile

from app.models.attributes import EdgeAttributeRow, NodeAttributeRow
from app.services.attributes import parse_edge_attributes_tsv, parse_node_attributes_tsv
from app.services.parser import NetworkValidationError

router = APIRouter()


@router.post("/api/attributes/nodes", response_model=list[NodeAttributeRow])
async def upload_node_attributes(file: UploadFile) -> list[NodeAttributeRow]:
    raw = (await file.read()).decode("utf-8", errors="replace")
    try:
        return parse_node_attributes_tsv(raw)
    except NetworkValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/api/attributes/edges", response_model=list[EdgeAttributeRow])
async def upload_edge_attributes(file: UploadFile) -> list[EdgeAttributeRow]:
    raw = (await file.read()).decode("utf-8", errors="replace")
    try:
        return parse_edge_attributes_tsv(raw)
    except NetworkValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
