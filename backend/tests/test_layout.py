import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.layout import LayoutRequest
from app.services.layouts import LAYOUTS, compute_layout

client = TestClient(app)


def _net():
    # two layers, a small clique each, one inter-layer edge
    nodes = [
        {"id": "A_L1", "label": "A", "layer": "L1"},
        {"id": "B_L1", "label": "B", "layer": "L1"},
        {"id": "C_L1", "label": "C", "layer": "L1"},
        {"id": "D_L2", "label": "D", "layer": "L2"},
        {"id": "E_L2", "label": "E", "layer": "L2"},
    ]

    def edge(src, trg, sl, tl):
        s, t = src.split("_")[0], trg.split("_")[0]
        return {
            "src": src,
            "trg": trg,
            "source_node": s,
            "source_layer": sl,
            "target_node": t,
            "target_layer": tl,
            "weight": 1.0,
            "scaled_weight": 0.5,
            "channel": None,
        }

    edges = [
        edge("A_L1", "B_L1", "L1", "L1"),
        edge("B_L1", "C_L1", "L1", "L1"),
        edge("A_L1", "C_L1", "L1", "L1"),
        edge("D_L2", "E_L2", "L2", "L2"),
        edge("C_L1", "D_L2", "L1", "L2"),  # inter-layer
    ]
    return nodes, edges


def _req(**kw):
    nodes, edges = _net()
    base = dict(
        nodes=nodes,
        edges=edges,
        algorithm="Fruchterman-Reingold",
        scope="perLayer",
        selected_layers=["L1", "L2"],
    )
    base.update(kw)
    return LayoutRequest(**base)


def test_all_registered_algorithms_run() -> None:
    for algo in LAYOUTS:
        pos, _ = compute_layout(_req(algorithm=algo))
        assert pos, f"{algo} produced no positions"
        for coord in pos.values():
            assert len(coord) == 2


def test_per_layer_excludes_inter_layer_edges() -> None:
    # perLayer L1 should place only L1 nodes reachable via intra-layer edges
    pos, _ = compute_layout(_req(selected_layers=["L1"]))
    assert set(pos) == {"A_L1", "B_L1", "C_L1"}


def test_all_layers_scope_places_both_layers() -> None:
    pos, _ = compute_layout(_req(scope="allLayers"))
    assert {"A_L1", "D_L2"} <= set(pos)


def test_no_edge_layout_places_isolated_nodes() -> None:
    # add a node with no intra-layer edge; Grid must still place it
    nodes, edges = _net()
    nodes.append({"id": "Z_L1", "label": "Z", "layer": "L1"})
    req = LayoutRequest(
        nodes=nodes,
        edges=edges,
        algorithm="Grid",
        scope="perLayer",
        selected_layers=["L1"],
    )
    pos, _ = compute_layout(req)
    assert "Z_L1" in pos


def test_seed_is_deterministic() -> None:
    a, _ = compute_layout(_req(algorithm="Fruchterman-Reingold", seed=7))
    b, _ = compute_layout(_req(algorithm="Fruchterman-Reingold", seed=7))
    assert a == b


def test_channel_filter_drops_unselected() -> None:
    nodes, edges = _net()
    for e in edges:
        e["channel"] = "keep"
    edges[0]["channel"] = "drop"  # A_L1-B_L1
    req = LayoutRequest(
        nodes=nodes,
        edges=edges,
        algorithm="Circle",
        scope="perLayer",
        selected_layers=["L1"],
        selected_channels=["keep"],
    )
    pos, _ = compute_layout(req)
    # A-B edge dropped but A,B still reachable via C's edges → all three present
    assert set(pos) == {"A_L1", "B_L1", "C_L1"}


def test_unknown_algorithm_400() -> None:
    resp = client.post(
        "/api/layout",
        json={
            "nodes": _net()[0],
            "edges": _net()[1],
            "algorithm": "Nope",
            "scope": "perLayer",
            "selected_layers": ["L1"],
        },
    )
    assert resp.status_code == 400


def test_endpoint_returns_positions() -> None:
    nodes, edges = _net()
    resp = client.post(
        "/api/layout",
        json={
            "nodes": nodes,
            "edges": edges,
            "algorithm": "Kamada-Kawai",
            "scope": "allLayers",
            "selected_layers": ["L1", "L2"],
        },
    )
    assert resp.status_code == 200
    assert resp.json()["positions"]


def test_nodes_per_layer_scope() -> None:
    pos, _ = compute_layout(
        _req(
            scope="nodesPerLayers",
            selected_layers=["L1"],
            selected_nodes=["A_L1", "B_L1", "C_L1"],
            algorithm="Circle",
        )
    )
    assert set(pos) <= {"A_L1", "B_L1", "C_L1"}


@pytest.mark.parametrize("algo", ["Circle", "Grid", "Random"])
def test_no_edge_layouts_registered(algo: str) -> None:
    assert algo in LAYOUTS
