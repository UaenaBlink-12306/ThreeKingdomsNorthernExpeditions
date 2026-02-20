from __future__ import annotations

from app.engine import balance
from app.models.state import GameState, Outcome, Phase


def _scaled_delta(state: GameState, key: str, value: int) -> int:
    if value <= 0:
        return value
    if not state.flags.get("post_zhuge_era", False):
        return value
    if key in {"food", "morale", "politics"}:
        scaled = int(round(value * balance.POST_ZHUGE_EFFICIENCY_MULTIPLIER))
        return max(0, scaled)
    return value


def _clamp_state(state: GameState) -> None:
    max_food = balance.MAX_FOOD_POST_ZHUGE if state.flags.get("post_zhuge_era", False) else balance.MAX_FOOD_BASE
    state.food = max(0, min(max_food, state.food))
    state.morale = max(0, min(balance.MAX_MORALE, state.morale))
    state.politics = max(0, min(balance.MAX_POLITICS, state.politics))
    state.wei_pressure = max(0, min(balance.MAX_WEI_PRESSURE, state.wei_pressure))
    state.doom = max(0, min(balance.MAX_DOOM, state.doom))
    state.health = max(0, state.health)
    state.longyou_turns = max(0, state.longyou_turns)
    state.guanzhong_turns = max(0, state.guanzhong_turns)


def add_log(state: GameState, text: str) -> None:
    if not text:
        return
    state.log.append(text)
    state.log = state.log[-10:]


def apply_effects(state: GameState, effects: dict | None) -> None:
    if not effects:
        return

    delta = effects.get("delta", {})
    for key, value in delta.items():
        if not hasattr(state, key):
            continue
        current = getattr(state, key)
        if not isinstance(current, int):
            continue
        setattr(state, key, current + _scaled_delta(state, key, int(value)))

    set_values = effects.get("set_values", {})
    for key, value in set_values.items():
        if hasattr(state, key):
            setattr(state, key, value)

    set_flags = effects.get("set_flags", {})
    for key, value in set_flags.items():
        state.flags[key] = bool(value)

    if "set_phase" in effects:
        state.phase = Phase(effects["set_phase"])

    if "set_chapter" in effects:
        state.chapter = int(effects["set_chapter"])

    if "set_outcome" in effects:
        state.outcome = Outcome(effects["set_outcome"])

    if "set_longyou_collapsed" in effects:
        state.longyou_collapsed = bool(effects["set_longyou_collapsed"])

    if "set_guanzhong_reset" in effects and effects["set_guanzhong_reset"]:
        state.guanzhong_turns = 0

    log_text = effects.get("log")
    if isinstance(log_text, str):
        add_log(state, log_text)

    append_log = effects.get("append_log", [])
    for item in append_log:
        if isinstance(item, str):
            add_log(state, item)

    _clamp_state(state)
