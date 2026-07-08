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
    # Non-positive/non-finite scaled_weight is sanitized in build_graph rather
    # than rejected here: a Field(allow_inf_nan=False) constraint makes FastAPI's
    # 422 handler try to echo the inf input and itself 500. The TSV path already
    # rejects non-finite weights at parse time (services/parser.py).
    weight: float
    scaled_weight: float
    channel: str | None = None


class NetworkModel(BaseModel):
    nodes: list[NodeModel]
    edges: list[EdgeModel]
    layers: list[str]
    channels: list[str]
    warnings: list[str] = []
