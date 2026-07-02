"""POST /api/topology — replaces functions/igraph/topology.R."""

from fastapi import APIRouter, HTTPException

from app.models.topology import TopologyRequest, TopologyResponse
from app.services.topology import TopologyError, compute_topology

router = APIRouter()


@router.post("/api/topology", response_model=TopologyResponse)
async def run_topology(req: TopologyRequest) -> TopologyResponse:
    try:
        scales, raw = compute_topology(req)
    except TopologyError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return TopologyResponse(scales=scales, raw=raw)
