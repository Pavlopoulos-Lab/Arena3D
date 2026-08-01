"""Session schemas. JSON is loose/stringly-typed (ports v2 export format), so the
import model is permissive — validation + defaulting lives in services/session.py."""

from typing import Any

from pydantic import BaseModel


class SessionImportResponse(BaseModel):
    """Normalized session returned to the frontend (ports parseUploadedJSON output)."""

    scene: dict[str, Any]
    layers: list[dict[str, Any]]
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    universalLabelColor: str
    direction: bool
    edgeOpacityByWeight: bool
    edgeWidthByWeight: bool
    scramble_nodes: bool
    warnings: list[str] = []


class ExternalCreateResponse(BaseModel):
    token: str
    url: str
