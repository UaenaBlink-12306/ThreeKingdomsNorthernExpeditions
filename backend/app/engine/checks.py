from __future__ import annotations

import random

from app.engine import balance
from app.models.state import GameState


def _clamp(value: float, low: float = 0.05, high: float = 0.95) -> float:
    return max(low, min(high, value))


def probability_for_check(check_key: str, state: GameState) -> float:
    base = balance.CHECK_BASE_PROB.get(check_key, 0.5)

    if check_key.startswith("jieting"):
        base += (state.morale - 60) * 0.002
    elif check_key == "longyou_rebellion":
        base += (state.politics - 50) * 0.004
    elif check_key == "supply_harass":
        base += (state.food - 90) * 0.002
        base += (state.morale - 60) * 0.001
    elif check_key == "court_infighting":
        base += (state.politics - 50) * 0.005
    elif check_key in {"wei_sortie", "wuzhang_sortie"}:
        base += state.wei_pressure * 0.05
    elif check_key.startswith("changan_assault"):
        base += (state.food - 80) * 0.002
        base += (state.morale - 60) * 0.003
        base += (state.wei_pressure - 3) * 0.01
    elif check_key == "guanzhong_hold":
        base += (state.food - 70) * 0.002
        base += (state.morale - 60) * 0.002
        base -= state.wei_pressure * 0.015
    elif check_key == "doom_defense":
        base += (state.food - 60) * 0.002
        base += (state.morale - 55) * 0.003
        base += (state.politics - 45) * 0.002

    if state.flags.get("post_zhuge_era", False):
        base *= balance.POST_ZHUGE_SUCCESS_MULTIPLIER

    if state.court.active_modifier is not None:
        base += state.court.active_modifier.check_modifier

    return _clamp(base)


def roll_check(check_key: str, state: GameState, rng: random.Random) -> tuple[bool, float, float]:
    probability = probability_for_check(check_key, state)
    roll = rng.random()
    state.roll_count += 1
    return roll <= probability, roll, probability
