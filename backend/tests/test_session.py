import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.session import SessionValidationError, normalize_session

client = TestClient(app)
DATA = Path(__file__).resolve().parent / "fixtures"


def _minimal():
    return {
        "layers": [{"name": "L1"}],
        "nodes": [{"name": "A", "layer": "L1"}, {"name": "B", "layer": "L1"}],
        "edges": [{"src": "A_L1", "trg": "B_L1"}],
    }


def test_import_real_api_fixture() -> None:
    fixture = DATA / "Arena3DApp_aspirin.json"
    if not fixture.exists():
        pytest.skip("fixture missing")
    resp = client.post(
        "/api/session/import",
        files={"file": ("net.json", fixture.read_text(), "application/json")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["nodes"] and body["edges"] and body["layers"]


def test_defaults_filled_for_minimal_json() -> None:
    s = normalize_session(_minimal())
    assert s["scene"]["scale"] == "0.9"
    assert s["scene"]["color"] == "#000000"
    assert s["universalLabelColor"] == "#FFFFFF"
    assert s["scramble_nodes"] is True  # no node positions given
    assert s["nodes"][0]["color"]  # palette-assigned
    assert s["layers"][0]["generate_coordinates"] is True


def test_missing_mandatory_object_raises() -> None:
    with pytest.raises(SessionValidationError):
        normalize_session({"layers": [{"name": "L1"}], "nodes": []})


def test_empty_layer_name_raises() -> None:
    bad = _minimal()
    bad["layers"] = [{"name": ""}]
    with pytest.raises(SessionValidationError):
        normalize_session(bad)


def test_duplicate_layer_names_raise() -> None:
    bad = _minimal()
    bad["layers"] = [{"name": "L1"}, {"name": "L1"}]
    with pytest.raises(SessionValidationError):
        normalize_session(bad)


def test_node_referencing_unknown_layer_raises() -> None:
    bad = _minimal()
    bad["nodes"] = [{"name": "A", "layer": "L1"}, {"name": "B", "layer": "MISSING"}]
    with pytest.raises(SessionValidationError):
        normalize_session(bad)


def test_edge_referencing_unknown_node_raises() -> None:
    bad = _minimal()
    bad["edges"] = [{"src": "A_L1", "trg": "GHOST_L1"}]
    with pytest.raises(SessionValidationError):
        normalize_session(bad)


def test_channels_dropped_when_partial() -> None:
    s = _minimal()
    s["edges"] = [
        {"src": "A_L1", "trg": "B_L1", "channel": "x"},
        {"src": "B_L1", "trg": "A_L1", "channel": ""},
    ]
    out = normalize_session(s)
    assert all("channel" not in e for e in out["edges"])
    assert any("channel" in w.lower() for w in out["warnings"])


def test_duplicate_edges_collapsed() -> None:
    s = _minimal()
    s["edges"] = [{"src": "A_L1", "trg": "B_L1"}, {"src": "A_L1", "trg": "B_L1"}]
    assert len(normalize_session(s)["edges"]) == 1


def test_export_is_download() -> None:
    resp = client.post("/api/session/export", json=_minimal())
    assert resp.status_code == 200
    assert "attachment" in resp.headers["content-disposition"]
    assert resp.json()["layers"][0]["name"] == "L1"


def test_external_create_and_resolve(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("app.config.TMP_PATH", str(tmp_path) + "/")
    monkeypatch.setattr("app.routers.external.config.TMP_PATH", str(tmp_path) + "/")
    created = client.post("/api/external", json=_minimal())
    assert created.status_code == 200
    token = created.json()["token"]
    assert token in created.json()["url"]

    resolved = client.get(f"/api/external/{token}")
    assert resolved.status_code == 200
    assert resolved.json()["layers"][0]["name"] == "L1"


def test_external_missing_token_404(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("app.routers.external.config.TMP_PATH", str(tmp_path) + "/")
    assert client.get("/api/external/doesnotexist").status_code == 404


def test_external_rejects_path_traversal(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("app.routers.external.config.TMP_PATH", str(tmp_path) + "/")
    resp = client.get("/api/external/..%2f..%2fetc%2fpasswd")
    assert resp.status_code in (400, 404)


def test_export_fixture_round_trips_through_import(tmp_path) -> None:
    fixture = DATA / "figure1_export.json"
    if not fixture.exists():
        pytest.skip("fixture missing")
    data = json.loads(fixture.read_text())
    # export format uses scene_pan; import treats scene as optional and fills defaults
    resp = client.post(
        "/api/session/import",
        files={"file": ("net.json", json.dumps(data), "application/json")},
    )
    assert resp.status_code == 200
