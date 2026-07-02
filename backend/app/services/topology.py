"""Topology metrics + node scaling — ports functions/igraph/topology.R.

Three metrics (raw igraph values, not normalized centralities), then per-subgraph
mapping into [TARGET_NODE_SCALE_MIN, TARGET_NODE_SCALE_MAX] as v2's scaleTopology does.
"""

import igraph as ig

from app import config
from app.models.topology import TopologyRequest
from app.services import graph as g


class TopologyError(ValueError):
    """Unknown metric."""


def _degree(graph: ig.Graph, directed: bool) -> list[float]:
    # v2: degree(mode="all", loops=T, normalized=F) — raw degree, self-loops counted
    return [float(d) for d in graph.degree(loops=True)]


def _clustering_coefficient(graph: ig.Graph, directed: bool) -> list[float]:
    # v2: transitivity(type="weighted", isolates="zero")
    vals = graph.transitivity_local_undirected(weights="weight", mode="zero")
    return [float(v) for v in vals]


def _betweenness(graph: ig.Graph, directed: bool) -> list[float]:
    # v2: betweenness(directed=edgeDirectionToggle, weights=E$weight, normalized=F)
    weights = graph.es["weight"] if graph.ecount() else None
    return [float(b) for b in graph.betweenness(directed=directed, weights=weights)]


METRICS = {
    "Degree": _degree,
    "Clustering Coefficient": _clustering_coefficient,
    "Betweenness Centrality": _betweenness,
}


def _mapper(values: list[float], out_min: float, out_max: float, default: float) -> list[float]:
    """Linear-rescale into [out_min, out_max]; constant input → default.

    Ports functions/general.R mapper() (topology uses default 1).
    """
    lo, hi = min(values), max(values)
    if hi - lo == 0:
        return [default] * len(values)
    return [(v - lo) * (out_max - out_min) / (hi - lo) + out_min for v in values]


def compute_topology(req: TopologyRequest) -> tuple[dict[str, float], dict[str, float]]:
    if req.metric not in METRICS:
        raise TopologyError(f"Unknown topology metric: {req.metric}")

    edges = g.filter_edges(req.edges, req.selected_channels)
    if req.scope == "nodesPerLayers":
        chosen = set(req.selected_nodes or [])
        edges = [e for e in edges if e.src in chosen and e.trg in chosen]

    selected = set(req.selected_layers)
    if req.scope == "allLayers":
        scopes = [selected]
    else:
        scopes = [{layer} for layer in req.selected_layers]

    scales: dict[str, float] = {}
    raw: dict[str, float] = {}
    for layers in scopes:
        if req.scope == "allLayers":
            layer_edges = g.within_layers_edges(edges, layers)
        else:
            layer_edges = g.intra_layer_edges(edges, next(iter(layers)))
        if len(layer_edges) < 2:
            continue  # v2: fewer than 2 edges cannot form a graph
        graph = g.build_graph(layer_edges, remove_multiple=True)
        names = graph.vs["name"]
        values = METRICS[req.metric](graph, req.directed)
        mapped = _mapper(
            values, config.TARGET_NODE_SCALE_MIN, config.TARGET_NODE_SCALE_MAX, default=1.0
        )
        for name, r, m in zip(names, values, mapped, strict=True):
            raw[name] = r
            scales[name] = m
    return scales, raw
