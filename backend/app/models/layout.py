"""Request/response schemas for POST /api/layout."""

from typing import Literal

from pydantic import BaseModel

from app.models.network import EdgeModel, NodeModel

Scope = Literal["perLayer", "allLayers", "nodesPerLayers"]


class ClusteringOptions(BaseModel):
    algorithm: str  # Louvain | Walktrap | Fast Greedy | Label Propagation
    local_layout: str  # layout name for members within a cluster


class LayoutRequest(BaseModel):
    nodes: list[NodeModel]
    edges: list[EdgeModel]
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
