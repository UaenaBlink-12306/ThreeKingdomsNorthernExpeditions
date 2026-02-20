from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _assert_core_fields(payload: dict) -> None:
    assert "game_id" in payload
    assert "outcome" in payload
    assert "current_event" in payload
    assert "options" in payload["current_event"]
    assert isinstance(payload["current_event"]["options"], list)
    assert "seed" in payload
    assert "roll_count" in payload


def _new_game(game_id: str = "api-flow-game", seed: int = 12345) -> dict:
    response = client.post("/api/new_game", json={"game_id": game_id, "seed": seed})
    assert response.status_code == 200
    payload = response.json()
    _assert_core_fields(payload)
    assert payload["game_id"] == game_id
    assert payload["seed"] == seed
    return payload


def _reset_all_games() -> None:
    response = client.post("/api/reset", json={})
    assert response.status_code == 200


def test_new_game_state_and_act_flow_updates_state() -> None:
    _reset_all_games()

    initial = _new_game(game_id="flow-main", seed=2024)

    state_response = client.get("/api/state", params={"game_id": initial["game_id"]})
    assert state_response.status_code == 200
    state_payload = state_response.json()
    _assert_core_fields(state_payload)

    assert state_payload["game_id"] == initial["game_id"]
    assert state_payload["outcome"] == initial["outcome"]
    assert state_payload["current_event"] == initial["current_event"]
    assert state_payload["seed"] == initial["seed"]
    assert state_payload["roll_count"] == initial["roll_count"]

    options = state_payload["current_event"]["options"]
    assert options, "new_game should start from a choice event with options"

    act_response = client.post(
        "/api/act",
        json={
            "game_id": initial["game_id"],
            "action": "choose_option",
            "payload": {"option_id": options[0]["id"]},
        },
    )
    assert act_response.status_code == 200
    act_payload = act_response.json()
    _assert_core_fields(act_payload)

    after_act_response = client.get("/api/state", params={"game_id": initial["game_id"]})
    assert after_act_response.status_code == 200
    after_act = after_act_response.json()
    _assert_core_fields(after_act)

    assert after_act["game_id"] == initial["game_id"]
    assert after_act["seed"] == initial["seed"]
    assert after_act["roll_count"] >= initial["roll_count"]
    assert after_act["current_node_id"] != initial["current_node_id"]
    assert len(after_act["log"]) > len(initial["log"])

    next_turn_response = client.post(
        "/api/act",
        json={"game_id": initial["game_id"], "action": "next_turn", "payload": {}},
    )
    assert next_turn_response.status_code == 200
    next_turn_payload = next_turn_response.json()
    _assert_core_fields(next_turn_payload)

    assert next_turn_payload["turn"] == after_act["turn"] + 1
    assert len(next_turn_payload["log"]) > len(after_act["log"])



def test_state_returns_404_for_unknown_game_id() -> None:
    _reset_all_games()

    response = client.get("/api/state", params={"game_id": "missing-game"})
    assert response.status_code == 404



def test_act_returns_404_for_unknown_game_id() -> None:
    _reset_all_games()

    response = client.post(
        "/api/act",
        json={"game_id": "missing-game", "action": "next_turn", "payload": {}},
    )
    assert response.status_code == 404



def test_act_returns_400_for_invalid_action() -> None:
    _reset_all_games()
    created = _new_game(game_id="invalid-action", seed=7)

    response = client.post(
        "/api/act",
        json={"game_id": created["game_id"], "action": "invalid_action", "payload": {}},
    )
    assert response.status_code == 400



def test_act_returns_400_for_missing_option_id() -> None:
    _reset_all_games()
    created = _new_game(game_id="missing-option", seed=8)

    response = client.post(
        "/api/act",
        json={"game_id": created["game_id"], "action": "choose_option", "payload": {}},
    )
    assert response.status_code == 400
