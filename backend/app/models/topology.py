"""Request/response schemas for POST /api/topology."""

from typing import Literal

from pydantic import BaseModel

from app.models.network import EdgeModel, NodeModel

Scope = Literal["perLayer", "allLayers", "nodesPerLayers"]


class TopologyRequest(BaseModel):
    nodes: list[NodeModel]
    edges: list[EdgeModel]
    metric: str  # Degree | Clustering Coefficient | Betweenness Centrality
    scope: Scope = "perLayer"
    selected_layers: list[str]
    selected_nodes: list[str] | None = None
    selected_channels: list[str] | None = None
    directed: bool = False  # v2 edgeDirectionToggle (affects betweenness)


class TopologyResponse(BaseModel):
    # Node_Layer id -> node scale mapped into [0.5, 2.5]
    scales: dict[str, float]
    # Node_Layer id -> raw metric value (for the View Data table)
    raw: dict[str, float]
