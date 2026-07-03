"""Node/edge attribute-file rows — ports functions/input.R attribute uploads."""

from pydantic import BaseModel


class NodeAttributeRow(BaseModel):
    node_layer: str  # "Node_Layer" key, as v2 nodeAttributes$NodeLayer
    color: str | None = None
    size: float | None = None
    url: str | None = None
    description: str | None = None


class EdgeAttributeRow(BaseModel):
    edge_pair: str  # "Source_Layer---Target_Layer", as v2 edgeAttributes$EdgePair
    color: str
    channel: str | None = None
