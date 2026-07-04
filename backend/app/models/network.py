"""Pydantic schemas for a parsed network — response of POST /api/network."""

from pydantic import BaseModel


class NodeModel(BaseModel):
    id: str  # "Node_Layer"
    label: str
    layer: str


class EdgeModel(BaseModel):
    src: str  # "SourceNode_Layer"
    trg: str  # "TargetNode_Layer"
    source_node: str
    source_layer: str
    target_node: str
    target_layer: str
    weight: float
    scaled_weight: float
    channel: str | None = None


class NetworkModel(BaseModel):
    nodes: list[NodeModel]
    edges: list[EdgeModel]
    layers: list[str]
    channels: list[str]
    warnings: list[str] = []
