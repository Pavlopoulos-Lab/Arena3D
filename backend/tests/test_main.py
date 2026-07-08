from fastapi.testclient import TestClient

from app import config
from app.main import app

client = TestClient(app)


def test_oversized_content_length_rejected_before_parsing() -> None:
    headers = {"content-length": str(config.MAX_UPLOAD_BYTES + 1)}
    resp = client.post("/api/layout", headers=headers, content=b"")
    assert resp.status_code == 413


def test_undersized_content_length_reaches_normal_validation() -> None:
    # No node/edge lists -> 422 from Pydantic, proving the middleware let it
    # past the size gate rather than blocking every request.
    resp = client.post("/api/layout", json={})
    assert resp.status_code == 422


def test_malformed_content_length_is_ignored() -> None:
    resp = client.post("/api/layout", headers={"content-length": "not-a-number"}, json={})
    assert resp.status_code == 422
