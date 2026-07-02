import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.layout import ClusteringOptions, LayoutRequest
from app.services.clustering import CLUSTERING
from app.services.layouts import compute_layout

client = TestClient(app)


def _two_cluster_net():
    # two 3-cliques joined by a single bridge edge — clear community structure
    names = ["A", "B", "C", "D", "E", "F"]
    nodes = [{"id": f"{n}_L1", "label": n, "layer": "L1"} for n in names]

    def edge(a, b):
        return {
            "src": f"{a}_L1",
            "trg": f"{b}_L1",
            "source_node": a,
            "source_layer": "L1",
            "target_node": b,
            "target_layer": "L1",
            "weight": 1.0,
            "scaled_weight": 0.5,
            "channel": None,
        }

    edges = [
        edge("A", "B"),
        edge("B", "C"),
        edge("A", "C"),
        edge("D", "E"),
        edge("E", "F"),
        edge("D", "F"),
        edge("C", "D"),  # bridge
    ]
    return nodes, edges


def _req(algo="Louvain", local="Circle"):
    nodes, edges = _two_cluster_net()
    return LayoutRequest(
        nodes=nodes,
        edges=edges,
        algorithm="Fruchterman-Reingold",
        scope="perLayer",
        selected_layers=["L1"],
        clustering=ClusteringOptions(algorithm=algo, local_layout=local),
    )


@pytest.mark.parametrize("algo", list(CLUSTERING))
def test_every_clustering_algo_runs(algo: str) -> None:
    positions, clusters = compute_layout(_req(algo=algo))
    assert clusters is not None
    assert set(positions) == {f"{n}_L1" for n in "ABCDEF"}
    assert set(clusters) == set(positions)


def test_finds_two_communities() -> None:
    _, clusters = compute_layout(_req(algo="Louvain"))
    assert clusters is not None
    # A,B,C in one community; D,E,F in another
    assert clusters["A_L1"] == clusters["B_L1"] == clusters["C_L1"]
    assert clusters["D_L1"] == clusters["E_L1"] == clusters["F_L1"]
    assert clusters["A_L1"] != clusters["D_L1"]


def test_no_clustering_returns_none() -> None:
    nodes, edges = _two_cluster_net()
    _, clusters = compute_layout(
        LayoutRequest(
            nodes=nodes,
            edges=edges,
            algorithm="Circle",
            scope="perLayer",
            selected_layers=["L1"],
        )
    )
    assert clusters is None


def test_unknown_clustering_400() -> None:
    nodes, edges = _two_cluster_net()
    resp = client.post(
        "/api/layout",
        json={
            "nodes": nodes,
            "edges": edges,
            "algorithm": "Fruchterman-Reingold",
            "scope": "perLayer",
            "selected_layers": ["L1"],
            "clustering": {"algorithm": "Nope", "local_layout": "Circle"},
        },
    )
    assert resp.status_code == 400


def test_endpoint_returns_clusters() -> None:
    nodes, edges = _two_cluster_net()
    resp = client.post(
        "/api/layout",
        json={
            "nodes": nodes,
            "edges": edges,
            "algorithm": "Fruchterman-Reingold",
            "scope": "perLayer",
            "selected_layers": ["L1"],
            "clustering": {"algorithm": "Louvain", "local_layout": "Grid"},
        },
    )
    assert resp.status_code == 200
    assert resp.json()["clusters"]
