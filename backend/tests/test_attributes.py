from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _post(kind: str, text: str):
    return client.post(
        f"/api/attributes/{kind}",
        files={"file": ("attrs.tsv", text, "text/tab-separated-values")},
    )


def test_node_attributes_full_row() -> None:
    tsv = (
        "Node\tLayer\tColor\tSize\tUrl\tDescription\n"
        " aspirin \t drugs \t#ff0000\t2.5\thttp://x\thello\n"
    )
    r = _post("nodes", tsv)
    assert r.status_code == 200
    assert r.json() == [
        {
            "node_layer": "aspirin_drugs",
            "color": "#ff0000",
            "size": 2.5,
            "url": "http://x",
            "description": "hello",
        }
    ]


def test_node_attributes_optional_columns_missing() -> None:
    r = _post("nodes", "Node\tLayer\nA\tL1\n")
    assert r.status_code == 200
    assert r.json()[0] == {
        "node_layer": "A_L1",
        "color": None,
        "size": None,
        "url": None,
        "description": None,
    }


def test_node_attributes_missing_mandatory_column() -> None:
    r = _post("nodes", "Node\tColor\nA\t#fff\n")
    assert r.status_code == 400
    assert "Node and Layer" in r.json()["detail"]


def test_node_attributes_non_numeric_size() -> None:
    r = _post("nodes", "Node\tLayer\tSize\nA\tL1\tbig\n")
    assert r.status_code == 400


def test_edge_attributes_with_channel() -> None:
    tsv = (
        "SourceNode\tSourceLayer\tTargetNode\tTargetLayer\tColor\tChannel\n"
        "A\tL1\tB\tL2\t #00ff00 \t ppi \n"
    )
    r = _post("edges", tsv)
    assert r.status_code == 200
    assert r.json() == [{"edge_pair": "A_L1---B_L2", "color": "#00ff00", "channel": "ppi"}]


def test_edge_attributes_without_channel() -> None:
    tsv = "SourceNode\tSourceLayer\tTargetNode\tTargetLayer\tColor\nA\tL1\tB\tL2\t#000\n"
    r = _post("edges", tsv)
    assert r.status_code == 200
    assert r.json()[0]["channel"] is None


def test_edge_attributes_missing_color_column() -> None:
    r = _post("edges", "SourceNode\tSourceLayer\tTargetNode\tTargetLayer\nA\tL1\tB\tL2\n")
    assert r.status_code == 400
