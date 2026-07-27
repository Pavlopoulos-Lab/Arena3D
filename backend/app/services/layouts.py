"""Layout registry + orchestration — ports functions/igraph/layout.R.

Maps the 11 v2 UI layout names to python-igraph Graph.layout_* calls, runs
the chosen scope, and returns 2D [y, z] coordinates keyed by Node_Layer id.
No weights are passed to layout functions — matches v2 (calculateLayout calls
the layout with defaults even though the graph carries weights).
"""

import random
from collections.abc import Callable

import igraph as ig

from app import config
from app.models.layout import LayoutRequest
from app.models.network import EdgeModel
from app.services import graph as g
from app.services.clustering import clustered_layout

LayoutFn = Callable[[ig.Graph], ig.Layout]

LAYOUTS: dict[str, LayoutFn] = {
    "Fruchterman-Reingold": lambda gr: gr.layout_fruchterman_reingold(),
    "Reingold-Tilford": lambda gr: gr.layout_reingold_tilford(),
    "Circle": lambda gr: gr.layout_circle(),
    "Grid": lambda gr: gr.layout_grid(),
    "Random": lambda gr: gr.layout_random(),
    "DrL": lambda gr: gr.layout_drl(),
    "Graphopt": lambda gr: gr.layout_graphopt(),
    "Kamada-Kawai": lambda gr: gr.layout_kamada_kawai(),
    "Large Graph Layout": lambda gr: gr.layout_lgl(),
    "Multidimensional Scaling": lambda gr: gr.layout_mds(),
    "Sugiyama": lambda gr: gr.layout_sugiyama(),
}


class LayoutError(ValueError):
    """Unknown algorithm or a scope with no computable subgraph."""


def compute_layout(
    req: LayoutRequest,
) -> tuple[dict[str, tuple[float, float]], dict[str, int] | None]:
    if req.algorithm not in LAYOUTS:
        raise LayoutError(f"Unknown layout algorithm: {req.algorithm}")
    if req.clustering and req.clustering.local_layout not in LAYOUTS:
        raise LayoutError(f"Unknown local layout: {req.clustering.local_layout}")

    random.seed(req.seed)  # v2 set.seed(123)
    edges = g.filter_edges(req.edges, req.selected_channels)
    selected = set(req.selected_layers)
    no_edge = req.algorithm in config.NO_EDGE_LAYOUTS

    # nodesPerLayers narrows to selected nodes first (ports runLocalLayout)
    if req.scope == "nodesPerLayers":
        chosen_nodes = set(req.selected_nodes or [])
        edges = [e for e in edges if e.src in chosen_nodes and e.trg in chosen_nodes]

    positions: dict[str, tuple[float, float]] = {}
    clusters: dict[str, int] = {}
    scopes = [selected] if req.scope == "allLayers" else [{layer} for layer in req.selected_layers]
    for layers in scopes:
        if req.scope == "allLayers":
            layer_edges = g.within_layers_edges(edges, layers)
        else:
            layer_edges = g.intra_layer_edges(edges, next(iter(layers)))
        extra = _layer_nodes(req, layers) if no_edge else None
        pos, clu = _layout_subgraph(layer_edges, req, no_edge, extra)
        positions.update(pos)
        clusters.update(clu)

    return positions, (clusters if req.clustering else None)


def _layer_nodes(req: LayoutRequest, layers: set[str]) -> list[str]:
    """All node ids belonging to `layers` (so no-edge layouts place isolated nodes)."""
    ids = [n.id for n in req.nodes if n.layer in layers]
    if req.scope == "nodesPerLayers" and req.selected_nodes is not None:
        chosen = set(req.selected_nodes)
        ids = [i for i in ids if i in chosen]
    return ids


def _layout_subgraph(
    edges: list[EdgeModel],
    req: LayoutRequest,
    no_edge: bool,
    extra_vertices: list[str] | None,
) -> tuple[dict[str, tuple[float, float]], dict[str, int]]:
    if not edges and not extra_vertices:
        return {}, {}  # nothing to place (v2: "cannot form a graph")
    # no channels here → remove parallel edges (edge-based scopes rebuild per layer)
    graph = g.build_graph(edges, remove_multiple=True, extra_vertices=extra_vertices)
    if graph.vcount() == 0:
        return {}, {}

    if req.clustering:
        return clustered_layout(
            graph,
            req.clustering.algorithm,
            LAYOUTS[req.algorithm],
            LAYOUTS[req.clustering.local_layout],
            is_kamada_kawai=req.algorithm == "Kamada-Kawai",
        )

    coords = LAYOUTS[req.algorithm](graph)
    names = graph.vs["name"]
    # Sugiyama appends dummy vertices for edge bends — keep only real vertices
    positions = {
        names[i]: (float(coords[i][0]), float(coords[i][1])) for i in range(graph.vcount())
    }
    return positions, {}
