from __future__ import annotations

from fastapi.testclient import TestClient

from app.api import routes
from app.assistant import DeepSeekConfigError
from app.main import app
from app.models.chat import ChatResponse


def _new_game_state(client: TestClient, game_id: str) -> dict:
    response = client.post("/api/new_game", json={"game_id": game_id, "seed": 99})
    assert response.status_code == 200
    return response.json()


def test_chat_endpoint_returns_model_response(monkeypatch) -> None:
    client = TestClient(app)
    state = _new_game_state(client, "chat-success")

    def fake_reply(request):  # noqa: ANN001
        return ChatResponse(mode=request.mode, content="mocked advice", model="mock-model")

    monkeypatch.setattr(routes.assistant, "reply", fake_reply)

    response = client.post(
        "/api/chat",
        json={
            "mode": "preturn_advisor",
            "game_state": state,
            "delta_summary": [],
            "delta_log": [],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "preturn_advisor"
    assert payload["content"] == "mocked advice"
    assert payload["model"] == "mock-model"


def test_chat_endpoint_maps_missing_key_to_503(monkeypatch) -> None:
    client = TestClient(app)
    state = _new_game_state(client, "chat-no-key")

    def fake_reply(_request):  # noqa: ANN001
        raise DeepSeekConfigError("missing key")

    monkeypatch.setattr(routes.assistant, "reply", fake_reply)

    response = client.post(
        "/api/chat",
        json={
            "mode": "scenario_mentor",
            "game_state": state,
            "delta_summary": [],
            "delta_log": [],
            "user_message": "What does doom mean?",
        },
    )

    assert response.status_code == 503
    assert "missing key" in response.text
