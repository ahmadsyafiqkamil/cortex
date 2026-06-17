import pytest

import api_server
from chat.types import ChatResponse, Citation


@pytest.fixture
def client():
    api_server.app.config["TESTING"] = True
    return api_server.app.test_client()


def test_chat_requires_messages(client):
    resp = client.post("/api/chat", json={})
    assert resp.status_code == 400


def test_chat_returns_answer(client, monkeypatch):
    fake = ChatResponse(
        answer="Go to embassy [[lost-passport]].",
        citations=(Citation("lost-passport", "PB1", "RAW1", "Permenlu"),),
        pages_used=("lost-passport",),
        refused=False,
    )
    monkeypatch.setattr(api_server, "_run_chat", lambda messages: fake)

    resp = client.post("/api/chat", json={"messages": [{"role": "user", "content": "lost passport"}]})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["refused"] is False
    assert data["pages_used"] == ["lost-passport"]
    assert data["citations"][0]["source_blob_id"] == "RAW1"
    assert data["error"] is None
