"""POST /api/layout — replaces functions/igraph/layout.R."""

from fastapi import APIRouter, HTTPException

from app.models.layout import LayoutRequest, LayoutResponse
from app.services.clustering import ClusteringError
from app.services.layouts import LayoutError, compute_layout

router = APIRouter()


@router.post("/api/layout", response_model=LayoutResponse)
async def run_layout(req: LayoutRequest) -> LayoutResponse:
    try:
        positions, clusters = compute_layout(req)
    except (LayoutError, ClusteringError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return LayoutResponse(positions=positions, clusters=clusters)
