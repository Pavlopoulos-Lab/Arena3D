"""Request/response schemas for POST /api/topology."""

from typing import Literal

from pydantic import BaseModel, Field

from app import config
from app.models.network import EdgeModel, NodeModel

Scope = Literal["perLayer", "allLayers", "nodesPerLayers"]


class TopologyRequest(BaseModel):
    # Same unauthenticated-DoS fix as LayoutRequest — Betweenness Centrality is
    # O(V*E) and this endpoint had no size limit of its own.
    nodes: list[NodeModel] = Field(max_length=config.MAX_NODES)
    edges: list[EdgeModel] = Field(max_length=config.MAX_EDGES)
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
