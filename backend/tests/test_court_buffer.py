from __future__ import annotations

from app.engine.runtime import GameEngine


def test_court_buffer_scenario_1_win_streak_can_yield_high_risk_high_reward_buff() -> None:
    engine = GameEngine()
    state = engine.new_game(game_id="court-s1", seed=2026)

    state.turn = 4
    state.food = 132
    state.morale = 84
    state.politics = 64
    state.wei_pressure = 6
    state.doom = 3
    state.court.momentum = 3
    state.court.last_trigger_turn = 1

    state = engine.act(state.game_id, "next_turn", {})
    assert state.court.is_active is True

    for _ in range(6):
        if not state.court.is_active:
            break
        state = engine.act(
            state.game_id,
            "court_statement",
            {
                "statement": "将士士气正盛，请准乘胜追击，以军心与民心争取速胜。",
                "strategy_hint": "emotional_mobilization",
            },
        )

    assert state.court.is_active is False
    assert state.court.last_resolution is not None
    assert state.court.last_resolution.result in {"pass", "timeout_pass"}
    assert state.court.active_modifier is not None
    assert state.court.active_modifier.check_modifier > 0
    assert state.court.active_modifier.success_reward_morale > 0
    assert state.court.active_modifier.failure_penalty_doom >= 1
    assert state.turn >= 5


def test_court_buffer_scenario_2_losing_streak_and_low_food_can_trigger_obstruction_debuff() -> None:
    engine = GameEngine()
    state = engine.new_game(game_id="court-s2", seed=9090)

    state.turn = 5
    state.food = 48
    state.morale = 39
    state.politics = 42
    state.wei_pressure = 7
    state.doom = 9
    state.court.momentum = -3
    state.court.last_trigger_turn = 1

    state = engine.act(state.game_id, "next_turn", {})
    assert state.court.is_active is True

    for _ in range(6):
        if not state.court.is_active:
            break
        state = engine.act(
            state.game_id,
            "court_statement",
            {
                "statement": "立刻服从军令，不得质疑，违令追责。今日必须压住所有反对声。",
                "strategy_hint": "authority_pressure",
            },
        )

    assert state.court.is_active is False
    assert state.court.last_resolution is not None
    assert state.court.last_resolution.result in {"fail", "timeout_fail"}
    assert state.court.active_modifier is not None
    assert state.court.active_modifier.check_modifier < 0
    assert state.court.active_modifier.food_per_turn_modifier < 0
    assert state.court.active_modifier.morale_per_turn_modifier <= 0


def test_court_buffer_each_round_keeps_core_opposition_voice() -> None:
    engine = GameEngine()
    state = engine.new_game(game_id="court-voice", seed=2027)

    state.turn = 4
    state.food = 80
    state.morale = 66
    state.politics = 56
    state.wei_pressure = 5
    state.doom = 4
    state.court.momentum = 0
    state.court.last_trigger_turn = 1

    state = engine.act(state.game_id, "next_turn", {})
    assert state.court.is_active is True

    before_count = len(state.court.pending_messages)
    state = engine.act(
        state.game_id,
        "court_statement",
        {
            "statement": "先核粮道与兵站里程，再给前线增援，避免空耗。",
            "strategy_hint": "rational_argument",
        },
    )

    new_messages = state.court.pending_messages[before_count:]
    speakers = {message.speaker_id for message in new_messages}
    assert speakers.intersection({"yang_yi", "dong_yun"}), (
        "Expected at least one core opposition speaker (yang_yi/dong_yun) in each court reaction round."
    )
