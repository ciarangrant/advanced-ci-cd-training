from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)


def test_health_returns_200():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert isinstance(data["uptime"], int)


def test_get_data_returns_records():
    response = client.get("/api/data")
    assert response.status_code == 200
    data = response.json()
    assert "records" in data
    assert len(data["records"]) > 0
    assert data["count"] == len(data["records"])
