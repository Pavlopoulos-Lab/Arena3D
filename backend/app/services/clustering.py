"""Clustering + clustered layout — ports functions/igraph/cluster.R.

Clustering is an optional step of a layout run (v2 calculateClusteredLayout):
detect communities, lay the community super-nodes out with the global algorithm
(repelled from the origin), lay each community's members out locally with the
local algorithm, then translate members into their super-node's position.
"""

from collections.abc import Callable

import igraph as ig

REPELLING_FORCE = 3.0

CLUSTERING: dict[str, Callable[[ig.Graph], ig.VertexClustering]] = {
    "Louvain": lambda gr: gr.community_multilevel(),
    "Walktrap": lambda gr: gr.community_walktrap().as_clustering(),
    "Fast Greedy": lambda gr: gr.community_fastgreedy().as_clustering(),
    "Label Propagation": lambda gr: gr.community_label_propagation(),
}


class ClusteringError(ValueError):
    """Unknown clustering algorithm."""


def clustered_layout(
    graph: ig.Graph,
    cluster_algo: str,
    global_layout: Callable[[ig.Graph], ig.Layout],
    local_layout: Callable[[ig.Graph], ig.Layout],
    is_kamada_kawai: bool,
) -> tuple[dict[str, tuple[float, float]], dict[str, int]]:
    """Return ({name: (y, z)}, {name: cluster_id}) for one subgraph.

    Ports execute_strategy3_superNodes_strictPartitioning.
    """
    if cluster_algo not in CLUSTERING:
        raise ClusteringError(f"Unknown clustering algorithm: {cluster_algo}")

    names = graph.vs["name"]
    membership = CLUSTERING[cluster_algo](graph).membership
    groups: dict[int, list[str]] = {}
    for name, cid in zip(names, membership, strict=True):
        groups.setdefault(cid, []).append(name)

    super_coords = _super_node_coords(graph, membership, groups, global_layout)

    weights = graph.es["weight"] if graph.ecount() else [1.0]
    tiny = min(weights) / 100
    tiny_w = tiny * REPELLING_FORCE if is_kamada_kawai else tiny / REPELLING_FORCE

    positions: dict[str, tuple[float, float]] = {}
    for cid, members in groups.items():
        local = _local_group_coords(graph, membership, cid, members, local_layout, tiny_w)
        gx, gy = super_coords[cid]
        for name, (x, y) in local.items():
            positions[name] = (x + gx, y + gy)

    clusters = dict(zip(names, membership, strict=True))
    return positions, clusters


def _super_node_coords(
    graph: ig.Graph,
    membership: list[int],
    groups: dict[int, list[str]],
    global_layout: Callable[[ig.Graph], ig.Layout],
) -> dict[int, tuple[float, float]]:
    """Lay out the community graph, then repel every super-node from the origin."""
    cluster_ids = sorted(groups)
    idx = {c: i for i, c in enumerate(cluster_ids)}
    edges = [(idx[membership[e.source]], idx[membership[e.target]]) for e in graph.es]
    sg = ig.Graph(n=len(cluster_ids), edges=edges)
    if graph.ecount():
        sg.es["weight"] = graph.es["weight"]
        sg.simplify(multiple=True, loops=False, combine_edges={"weight": "mean"})
    else:
        sg.simplify(multiple=True, loops=False)

    coords = global_layout(sg)
    result: dict[int, tuple[float, float]] = {}
    for c in cluster_ids:
        x, y = float(coords[idx[c]][0]), float(coords[idx[c]][1])
        # Push the super-node radially away from the origin. The old slope-based
        # form (x*F, (y/x)*x*F) equals this for x != 0 but collapsed to (0, 0)
        # when x == 0 (Circle/Grid layouts routinely place nodes there).
        result[c] = (x * REPELLING_FORCE, y * REPELLING_FORCE)
    return result


def _local_group_coords(
    graph: ig.Graph,
    membership: list[int],
    cid: int,
    members: list[str],
    local_layout: Callable[[ig.Graph], ig.Layout],
    tiny_w: float,
) -> dict[str, tuple[float, float]]:
    """Lay out one community's members: real intra edges + tiny all-pairs edges.

    The tiny complete-graph edges (ports calculateGroupNetworkWithAllEdges) keep
    disconnected members spread out; real edges win under simplify(max).
    """
    index = {name: i for i, name in enumerate(members)}
    edge_pairs: list[tuple[int, int]] = []
    weights: list[float] = []

    # real intra-community edges
    for e in graph.es:
        if membership[e.source] == cid and membership[e.target] == cid:
            u, v = graph.vs[e.source]["name"], graph.vs[e.target]["name"]
            edge_pairs.append((index[u], index[v]))
            weights.append(e["weight"])

    # tiny edges between every pair of members
    for i in range(len(members)):
        for j in range(i + 1, len(members)):
            edge_pairs.append((i, j))
            weights.append(tiny_w)

    lg = ig.Graph(n=len(members), edges=edge_pairs)
    lg.vs["name"] = members
    if edge_pairs:
        lg.es["weight"] = weights
        lg.simplify(multiple=True, loops=False, combine_edges={"weight": "max"})

    coords = local_layout(lg)
    return {
        lg.vs[i]["name"]: (float(coords[i][0]), float(coords[i][1])) for i in range(lg.vcount())
    }
