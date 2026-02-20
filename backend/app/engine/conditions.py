from __future__ import annotations

from app.models.state import GameState


def evaluate_condition(condition: str | None, state: GameState) -> bool:
    if not condition:
        return True

    mapping = {
        "longyou_ready": lambda s: s.longyou_turns >= 5 and not s.longyou_collapsed,
        "guanzhong_ready": lambda s: s.guanzhong_turns >= 3 and not s.longyou_collapsed,
        "chapter_is_1": lambda s: s.chapter == 1,
        "chapter_is_2": lambda s: s.chapter == 2,
        "chapter_is_3": lambda s: s.chapter == 3,
        "chapter_is_4": lambda s: s.chapter == 4,
        "chapter_ge_5": lambda s: s.chapter >= 5,
        "can_enter_final": lambda s: s.longyou_turns >= 5 and s.wei_pressure >= 3 and s.food >= 65 and not s.longyou_collapsed,
        "can_attack_changan": lambda s: s.longyou_turns >= 5 and s.wei_pressure >= 3 and s.food >= 70 and not s.longyou_collapsed,
        "post_zhuge": lambda s: bool(s.flags.get("post_zhuge_era", False)),
        "not_post_zhuge": lambda s: not bool(s.flags.get("post_zhuge_era", False)),
    }
    checker = mapping.get(condition)
    if checker is None:
        return False
    return checker(state)
