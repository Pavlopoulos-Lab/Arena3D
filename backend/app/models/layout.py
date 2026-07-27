"""Request/response schemas for POST /api/layout."""

from typing import Literal

from pydantic import BaseModel, Field

from app import config
from app.models.network import EdgeModel, NodeModel

Scope = Literal["perLayer", "allLayers", "nodesPerLayers"]


class ClusteringOptions(BaseModel):
    algorithm: str  # Louvain | Walktrap | Fast Greedy | Label Propagation
    local_layout: str  # layout name for members within a cluster


class LayoutRequest(BaseModel):
    # Unauthenticated DoS fix: this endpoint is reachable directly (not just via
    # the TSV-upload flow), so the MAX_EDGES/MAX_NODES cap must be enforced here
    # too, or a caller can force an O(V*E) layout algorithm over an arbitrarily
    # large graph.
    nodes: list[NodeModel] = Field(max_length=config.MAX_NODES)
    edges: list[EdgeModel] = Field(max_length=config.MAX_EDGES)
    algorithm: str
    scope: Scope = "perLayer"
    selected_layers: list[str]
    selected_nodes: list[str] | None = None  # Node_Layer ids, for nodesPerLayers
    selected_channels: list[str] | None = None
    clustering: ClusteringOptions | None = None
    seed: int = 123  # v2 uses set.seed(123)


class LayoutResponse(BaseModel):
    # Node_Layer id -> [y, z] within the layer plane (x is fixed by the layer)
    positions: dict[str, tuple[float, float]]
    # Node_Layer id -> cluster id, only when clustering was requested
    clusters: dict[str, int] | None = None
