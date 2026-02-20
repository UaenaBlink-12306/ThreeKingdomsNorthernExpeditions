from __future__ import annotations

from app.engine.runtime import GameEngine
from app.models.state import Outcome


def _pick_first_enabled_option(state) -> str | None:
    for option in state.current_event.options:
        if not option.disabled:
            return option.id
    return None


def _run_scripted_game(engine: GameEngine, game_id: str, seed: int):
    state = engine.new_game(game_id=game_id, seed=seed)
    for _ in range(80):
        if state.outcome != Outcome.ONGOING:
            break
        option_id = _pick_first_enabled_option(state)
        if option_id is not None:
            state = engine.act(game_id, "choose_option", {"option_id": option_id})
        else:
            state = engine.act(game_id, "next_turn", {})
    return state


def test_replay_same_seed_and_actions_reaches_same_terminal_fields() -> None:
    seed = 202501
    game_id = "replay-source"

    source_engine = GameEngine()
    source_state = _run_scripted_game(source_engine, game_id=game_id, seed=seed)

    replay_data = source_engine.get_replay(game_id)

    target_engine = GameEngine()
    target_id = "replay-target"
    target_engine.new_game(game_id=target_id, seed=replay_data["seed"])

    for item in replay_data["actions"]:
        if item["action"] == "new_game":
            continue
        target_engine.act(target_id, item["action"], item["payload"])

    target_state = target_engine.get_state(target_id)

    assert target_state.outcome == source_state.outcome
    assert target_state.turn == source_state.turn
    assert target_state.current_node_id == source_state.current_node_id
    assert target_state.roll_count == source_state.roll_count


def test_replay_export_contains_diagnostics_and_action_history() -> None:
    engine = GameEngine()
    game_id = "replay-export"
    state = engine.new_game(game_id=game_id, seed=7)

    option_id = _pick_first_enabled_option(state)
    if option_id is not None:
        engine.act(game_id, "choose_option", {"option_id": option_id})

    replay = engine.get_replay(game_id)

    assert replay["seed"] == 7
    assert any(item["event"] == "new_game" for item in replay["diagnostics"])
    assert any(item["level"] == "info" for item in replay["diagnostics"])
    assert any(item["level"] == "debug" for item in replay["diagnostics"])
    assert replay["actions"][0]["action"] == "new_game"
