"""Attribute-file TSV parsing — ports functions/input.R
handleInputNodeAttributeFileUpload() / handleInputEdgeAttributeFileUpload().
"""

from io import StringIO

import pandas as pd

from app.models.attributes import EdgeAttributeRow, NodeAttributeRow
from app.services.parser import NetworkValidationError


def _read(text: str) -> pd.DataFrame:
    try:
        df = pd.read_csv(StringIO(text), sep="\t", dtype=str)
    except Exception as e:
        raise NetworkValidationError("Bad attributes file format.") from e
    return df


def _cell(row: pd.Series, column: str) -> str | None:
    value = str(row[column]).strip() if column in row.index and pd.notna(row[column]) else ""
    return value or None


def parse_node_attributes_tsv(text: str) -> list[NodeAttributeRow]:
    df = _read(text)
    if not {"Node", "Layer"}.issubset(df.columns):
        raise NetworkValidationError(
            "Your node attribute file must contain at least two columns: Node and Layer"
        )
    rows = []
    for _, row in df.iterrows():
        size = _cell(row, "Size")
        try:
            size_value = float(size) if size is not None else None
        except ValueError as e:
            raise NetworkValidationError("Make sure all Size values are numeric.") from e
        rows.append(
            NodeAttributeRow(
                node_layer=f"{str(row['Node']).strip()}_{str(row['Layer']).strip()}",
                color=_cell(row, "Color"),
                size=size_value,
                url=_cell(row, "Url"),
                description=_cell(row, "Description"),
            )
        )
    return rows


def parse_edge_attributes_tsv(text: str) -> list[EdgeAttributeRow]:
    df = _read(text)
    mandatory = {"SourceNode", "SourceLayer", "TargetNode", "TargetLayer", "Color"}
    if not mandatory.issubset(df.columns):
        raise NetworkValidationError(
            "Your edge attribute file must contain at least these five columns: "
            "SourceNode, SourceLayer, TargetNode, TargetLayer and Color, "
            "and optionally a Channel name."
        )
    rows = []
    for _, row in df.iterrows():
        source = f"{str(row['SourceNode']).strip()}_{str(row['SourceLayer']).strip()}"
        target = f"{str(row['TargetNode']).strip()}_{str(row['TargetLayer']).strip()}"
        color = _cell(row, "Color")
        if color is None:
            raise NetworkValidationError("Make sure all edge attribute rows have a Color.")
        rows.append(
            EdgeAttributeRow(
                edge_pair=f"{source}---{target}",
                color=color,
                channel=_cell(row, "Channel"),
            )
        )
    return rows
