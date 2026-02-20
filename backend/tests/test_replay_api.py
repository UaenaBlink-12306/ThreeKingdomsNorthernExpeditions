from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_replay_endpoint_returns_seed_actions_and_diagnostics() -> None:
    client = TestClient(app)
    game_id = "api-replay"

    create_resp = client.post("/api/new_game", json={"game_id": game_id, "seed": 11})
    assert create_resp.status_code == 200

    replay_resp = client.get("/api/replay", params={"game_id": game_id})
    assert replay_resp.status_code == 200

    body = replay_resp.json()
    assert body["game_id"] == game_id
    assert body["seed"] == 11
    assert body["actions"][0]["action"] == "new_game"
    assert body["diagnostics"][0]["event"] == "new_game"
