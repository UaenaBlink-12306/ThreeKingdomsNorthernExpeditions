from __future__ import annotations

import random

from app.engine.effects import add_log, apply_effects
from app.models.court import (
    CourtBattleModifier,
    CourtHistoryEntry,
    CourtMessage,
    CourtResult,
    CourtResolution,
    CourtState,
    CourtStrategy,
)
from app.models.state import GameState, Outcome, Phase

COURT_TRIGGER_INTERVAL = 3
SUPPORT_PASS_THRESHOLD = 72
SUPPORT_FAIL_THRESHOLD = 18
RESENTMENT_THRESHOLD = 9
MAX_COURT_HISTORY = 8

STRATEGY_PROFILE: dict[CourtStrategy, dict[str, object]] = {
    CourtStrategy.RATIONAL: {
        "label": "理性论证",
        "support_bias": 1.5,
        "temperature_push": -5,
        "resource_stat": "politics",
        "resource_weight": 0.08,
        "issue_bonus": {"supply": 1.2, "stability": 1.1, "risk": 0.8, "governance": 1.0},
        "cost": {"food": -1},
    },
    CourtStrategy.AUTHORITY: {
        "label": "权威压制",
        "support_bias": 0.2,
        "temperature_push": -9,
        "resource_stat": "politics",
        "resource_weight": 0.12,
        "issue_bonus": {"time": 1.0, "conflict": 0.9, "risk": 0.4},
        "cost": {"politics": -4, "morale": -1},
    },
    CourtStrategy.EMOTIONAL: {
        "label": "情感动员",
        "support_bias": 1.0,
        "temperature_push": 11,
        "resource_stat": "morale",
        "resource_weight": 0.1,
        "issue_bonus": {"morale": 1.2, "momentum": 1.1, "offense": 1.0},
        "cost": {"morale": -2, "food": -1},
    },
}

STRATEGY_FRIENDLY_NAMES = {
    CourtStrategy.RATIONAL: "理性论证",
    CourtStrategy.AUTHORITY: "权威压制",
    CourtStrategy.EMOTIONAL: "情感动员",
}

ISSUE_LABELS = {
    "supply": "粮草是否见底",
    "momentum": "是否乘胜追击",
    "setback": "连败后该守还是攻",
    "morale": "军心是否还能支撑远征",
    "risk": "北伐风险是否过高",
    "stability": "朝局稳定优先还是前线优先",
    "offense": "是否批准奇谋突袭",
    "governance": "军政资源如何再分配",
    "time": "议事时限正在逼近",
    "conflict": "主战与保守派冲突升级",
}


def _clamp(value: float, low: int, high: int) -> int:
    return int(max(low, min(high, round(value))))


def _message_id(court: CourtState) -> str:
    court.message_seq += 1
    return f"court-{court.session_id}-{court.message_seq}"


def _append_message(court: CourtState, *, speaker_id: str, speaker_name: str, camp: str, text: str) -> None:
    court.pending_messages.append(
        CourtMessage(
            id=_message_id(court),
            speaker_id=speaker_id,
            speaker_name=speaker_name,
            camp=camp,
            text=text,
        )
    )


def should_trigger_court(state: GameState) -> bool:
    if state.court.is_active or state.outcome != Outcome.ONGOING:
        return False
    if state.phase not in {Phase.CAMPAIGN, Phase.DEFENSE, Phase.FINAL}:
        return False
    if state.turn <= 1:
        return False

    turns_since = state.turn - state.court.last_trigger_turn
    cadence_due = turns_since >= COURT_TRIGGER_INTERVAL
    critical = (
        state.food <= 62
        or state.morale <= 45
        or state.doom >= 8
        or state.court.momentum <= -2
        or state.longyou_collapsed
    )
    return cadence_due or critical


def begin_court_session(state: GameState, rng: random.Random) -> None:
    court = state.court
    court.is_active = True
    court.session_id += 1
    if state.phase == Phase.COURT:
        court.return_phase = Phase.FINAL.value if state.chapter >= 5 else Phase.CAMPAIGN.value
    else:
        court.return_phase = state.phase.value if isinstance(state.phase, Phase) else str(state.phase)
    court.pending_messages = []
    court.current_rebound_events = []
    court.resentment_event_fired = False
    court.message_seq = 0
    court.last_resolution = None

    issue_tags = _pick_issue_tags(state)
    court.current_issue_tags = issue_tags
    court.current_issues = [ISSUE_LABELS[tag] for tag in issue_tags]

    base_support = 58 + (state.politics - 50) * 0.30 + (state.morale - 50) * 0.15 + state.court.momentum * 3
    court.support = _clamp(base_support + rng.uniform(-3.0, 3.0), 20, 84)

    temp_seed = state.court.temperature * 0.35 + state.court.momentum * 8 + (state.wei_pressure - 4) * 2.8
    if state.food < 65:
        temp_seed -= 6
    if state.morale > 72:
        temp_seed += 5
    court.temperature = _clamp(temp_seed + rng.uniform(-4.0, 4.0), -100, 100)

    court.max_time_pressure = 3 if (state.food < 65 or state.court.momentum <= -2) else 4
    court.time_pressure = court.max_time_pressure

    _append_message(
        court,
        speaker_id="system",
        speaker_name="战报",
        camp="system",
        text="战报传来……成都朝堂紧急议事。",
    )
    _append_message(
        court,
        speaker_id="jiang_wan",
        speaker_name="蒋琬",
        camp="administration",
        text="先报粮数与行军里程，空谈无益。",
    )
    _append_message(
        court,
        speaker_id="yang_yi",
        speaker_name="杨仪",
        camp="bureaucrat",
        text="前线若再失误，谁来担责？",
    )
    _append_message(
        court,
        speaker_id="wei_yan",
        speaker_name="魏延",
        camp="vanguard",
        text="畏首畏尾只会错失战机！",
    )
    _append_message(
        court,
        speaker_id="yang_yi",
        speaker_name="杨仪",
        camp="bureaucrat",
        text="魏延又是赌命奇谋，后患谁收？",
    )
    _append_message(
        court,
        speaker_id="fei_yi",
        speaker_name="费祎",
        camp="moderate",
        text="诸位先定共识，再争攻守。",
    )
    _append_message(
        court,
        speaker_id="dong_yun",
        speaker_name="董允",
        camp="institution",
        text="军令可行，但制度不能失守。",
    )
    _append_message(
        court,
        speaker_id="liu_shan",
        speaker_name="刘禅",
        camp="imperial",
        text="相父，请以三策安众心。",
    )

    add_log(state, "战报传来：朝堂缓冲区开启，需先稳住朝议。")


def resolve_court_strategy(
    state: GameState,
    strategy: CourtStrategy,
    rng: random.Random,
    statement: str | None = None,
) -> bool:
    court = state.court
    if not court.is_active:
        return False

    profile = STRATEGY_PROFILE[strategy]
    strategy_name = STRATEGY_FRIENDLY_NAMES[strategy]
    if statement:
        clean_statement = " ".join(statement.split())[:120]
        _append_message(
            court,
            speaker_id="player",
            speaker_name="诸葛亮",
            camp="player",
            text=clean_statement,
        )
    else:
        _append_message(
            court,
            speaker_id="system",
            speaker_name="军议记录",
            camp="system",
            text=f"诸葛亮采取「{strategy_name}」。",
        )

    _apply_strategy_resource_costs(state, strategy)

    scores = _evaluate_npc_scores(state, strategy, rng)
    support_shift, temp_shift = _aggregate_strategy_effect(state, strategy, scores, rng)
    if statement:
        support_shift += _statement_quality_bonus(statement, strategy, court.current_issue_tags)
    old_support = court.support
    old_temp = court.temperature
    court.support = _clamp(court.support + support_shift, 0, 100)
    court.temperature = _clamp(court.temperature + temp_shift, -100, 100)
    court.time_pressure = max(0, court.time_pressure - 1)

    _update_resentment(state, strategy, scores)
    rebound_events = _trigger_resentment_event_if_needed(state)

    _append_message(
        court,
        speaker_id="system",
        speaker_name="军议记录",
        camp="system",
        text=(
            f"支持度 {old_support}->{court.support}，温度 {old_temp}->{court.temperature}，"
            f"时限剩余 {court.time_pressure}/{court.max_time_pressure}。"
        ),
    )
    _append_reaction_lines(state, strategy, scores)
    if rebound_events:
        for event_text in rebound_events:
            _append_message(
                court,
                speaker_id="system",
                speaker_name="军议记录",
                camp="system",
                text=event_text,
            )

    if _should_settle(court):
        settle_court_session(state)
        return True
    return False


def fast_forward_court_session(state: GameState, rng: random.Random) -> None:
    safety = 0
    while state.court.is_active and safety < 10:
        strategy = _pick_auto_strategy(state)
        resolve_court_strategy(state, strategy, rng)
        safety += 1
    if state.court.is_active:
        settle_court_session(state, force_timeout=True)


def settle_court_session(state: GameState, force_timeout: bool = False) -> None:
    court = state.court
    if not court.is_active:
        return

    result = _resolve_result(court, force_timeout=force_timeout)
    modifier = _build_modifier_for_result(state, result)
    summary = _summary_for_result(result, modifier.title)

    immediate_delta = _immediate_delta_for_result(result)
    if immediate_delta:
        apply_effects(state, {"delta": immediate_delta})

    court.is_active = False
    court.last_trigger_turn = state.turn
    court.active_modifier = modifier
    court.last_resolution = CourtResolution(
        session_id=court.session_id,
        turn_resolved=state.turn,
        result=result,
        summary=summary,
        support=court.support,
        temperature=court.temperature,
        triggered_events=list(court.current_rebound_events),
        modifier=modifier,
    )

    court.history.append(
        CourtHistoryEntry(
            session_id=court.session_id,
            turn_resolved=state.turn,
            result=result,
            support=court.support,
            temperature=court.temperature,
            modifier_id=modifier.id,
        )
    )
    court.history = court.history[-MAX_COURT_HISTORY:]
    court.time_pressure = 0
    court.current_issues = []
    court.current_issue_tags = []
    court.current_rebound_events = []
    court.resentment_event_fired = False

    for npc in court.npcs.values():
        npc.ignored_rounds = 0
        npc.resentment = max(0, npc.resentment - 1)

    _append_message(
        court,
        speaker_id="liu_shan",
        speaker_name="刘禅",
        camp="imperial",
        text=_liu_shan_settlement_line(result),
    )
    _append_message(
        court,
        speaker_id="system",
        speaker_name="军议结算",
        camp="system",
        text=summary,
    )
    _append_message(
        court,
        speaker_id="system",
        speaker_name="军议结算",
        camp="system",
        text=(
            f"生效：{modifier.title}（{modifier.turns_remaining}回合）"
            f" 检定修正 {modifier.check_modifier:+.2f}，"
            f"每回合 粮草 {modifier.food_per_turn_modifier:+d}/士气 {modifier.morale_per_turn_modifier:+d}/Doom {modifier.doom_per_turn_modifier:+d}。"
        ),
    )

    add_log(state, f"朝议结算：{summary}")
    add_log(state, f"朝议军令生效：{modifier.title}（{modifier.turns_remaining}回合）")


def apply_battle_turn_modifier(state: GameState) -> dict[str, int | bool | str]:
    modifier = state.court.active_modifier
    if modifier is None:
        return {
            "doom_delta": 0,
            "food_delta": 0,
            "morale_delta": 0,
            "expired": False,
            "title": "",
        }

    food_delta = modifier.food_per_turn_modifier
    morale_delta = modifier.morale_per_turn_modifier
    if food_delta or morale_delta:
        apply_effects(state, {"delta": {"food": food_delta, "morale": morale_delta}})

    modifier.turns_remaining -= 1
    expired = modifier.turns_remaining <= 0
    title = modifier.title
    if expired:
        state.court.active_modifier = None

    return {
        "doom_delta": modifier.doom_per_turn_modifier,
        "food_delta": food_delta,
        "morale_delta": morale_delta,
        "expired": expired,
        "title": title,
    }


def check_probability_modifier(state: GameState) -> float:
    modifier = state.court.active_modifier
    if modifier is None:
        return 0.0
    return modifier.check_modifier


def apply_check_outcome_modifier(state: GameState, *, success: bool) -> dict[str, int]:
    modifier = state.court.active_modifier
    if modifier is None:
        return {"food": 0, "morale": 0, "doom": 0}

    if success:
        delta = {
            "food": modifier.success_reward_food,
            "morale": modifier.success_reward_morale,
            "doom": 0,
        }
    else:
        delta = {
            "food": -modifier.failure_penalty_food,
            "morale": -modifier.failure_penalty_morale,
            "doom": modifier.failure_penalty_doom,
        }

    if delta["food"] or delta["morale"] or delta["doom"]:
        apply_effects(
            state,
            {
                "delta": {
                    "food": delta["food"],
                    "morale": delta["morale"],
                    "doom": delta["doom"],
                }
            },
        )
    return delta


def _pick_issue_tags(state: GameState) -> list[str]:
    candidates: list[tuple[int, str]] = []
    if state.food < 70:
        candidates.append((95, "supply"))
    if state.court.momentum <= -2:
        candidates.append((90, "setback"))
    if state.court.momentum >= 2:
        candidates.append((88, "momentum"))
    if state.morale < 52:
        candidates.append((84, "morale"))
    if state.doom >= 8:
        candidates.append((82, "risk"))
    if state.wei_pressure >= 6:
        candidates.append((78, "offense"))
    if state.longyou_collapsed:
        candidates.append((80, "stability"))

    candidates.extend([(72, "conflict"), (70, "governance"), (66, "time")])
    ordered = [tag for _, tag in sorted(candidates, key=lambda item: item[0], reverse=True)]

    selected: list[str] = []
    for tag in ordered:
        if tag not in selected:
            selected.append(tag)
        if len(selected) >= 5:
            break

    if len(selected) < 2:
        selected.extend(["governance", "time"])
    return selected[:5]


def _statement_quality_bonus(statement: str, strategy: CourtStrategy, issue_tags: list[str]) -> int:
    text = statement.lower()
    length_score = 1 if len(text.strip()) >= 18 else 0

    strategy_keywords: dict[CourtStrategy, list[str]] = {
        CourtStrategy.RATIONAL: [
            "evidence",
            "data",
            "logistics",
            "supply",
            "risk",
            "\u8bc1\u636e",
            "\u53ef\u884c",
            "\u8865\u7ed9",
            "\u98ce\u9669",
            "\u7cae",
        ],
        CourtStrategy.AUTHORITY: [
            "command",
            "discipline",
            "order",
            "authority",
            "\u519b\u4ee4",
            "\u95ee\u8d23",
            "\u547d\u4ee4",
            "\u670d\u4ece",
        ],
        CourtStrategy.EMOTIONAL: [
            "morale",
            "people",
            "hope",
            "spirit",
            "\u58eb\u6c14",
            "\u519b\u5fc3",
            "\u6c11\u5fc3",
            "\u5c06\u58eb",
        ],
    }

    hit_count = sum(1 for token in strategy_keywords[strategy] if token in text)
    issue_hit = 0
    for tag in issue_tags:
        if tag == "supply" and any(token in text for token in ["supply", "logistics", "\u8865\u7ed9", "\u7cae"]):
            issue_hit += 1
        if tag == "morale" and any(token in text for token in ["morale", "\u58eb\u6c14", "\u519b\u5fc3"]):
            issue_hit += 1
        if tag == "risk" and any(token in text for token in ["risk", "\u98ce\u9669"]):
            issue_hit += 1
        if tag == "stability" and any(token in text for token in ["stability", "order", "\u7a33", "\u5236\u5ea6"]):
            issue_hit += 1

    total = length_score + min(2, hit_count) + min(2, issue_hit)
    return min(4, total)


def _apply_strategy_resource_costs(state: GameState, strategy: CourtStrategy) -> None:
    cost = STRATEGY_PROFILE[strategy]["cost"]
    if not isinstance(cost, dict):
        return
    payload: dict[str, int] = {}
    for key, value in cost.items():
        if isinstance(key, str) and isinstance(value, int):
            payload[key] = value
    if payload:
        apply_effects(state, {"delta": payload})


def _resource_modifier_for_strategy(state: GameState, strategy: CourtStrategy) -> float:
    profile = STRATEGY_PROFILE[strategy]
    stat_name = profile["resource_stat"]
    weight = profile["resource_weight"]
    if not isinstance(stat_name, str) or not isinstance(weight, float):
        return 0.0

    base = 50.0
    if stat_name == "food":
        base = 75.0
    current = float(getattr(state, stat_name, 50))
    return (current - base) * weight / 10.0


def _issue_bonus_for_strategy(strategy: CourtStrategy, issue_tags: list[str]) -> float:
    profile = STRATEGY_PROFILE[strategy]
    issue_bonus = profile["issue_bonus"]
    if not isinstance(issue_bonus, dict):
        return 0.0
    total = 0.0
    for tag in issue_tags:
        if tag in issue_bonus:
            total += float(issue_bonus[tag])
    return min(2.6, total)


def _evaluate_npc_scores(
    state: GameState,
    strategy: CourtStrategy,
    rng: random.Random,
) -> dict[str, float]:
    court = state.court
    profile = STRATEGY_PROFILE[strategy]
    base_bias = float(profile["support_bias"])
    resource_mod = _resource_modifier_for_strategy(state, strategy)
    issue_mod = _issue_bonus_for_strategy(strategy, court.current_issue_tags)
    momentum_mod = state.court.momentum * (0.09 if strategy == CourtStrategy.EMOTIONAL else 0.04)

    scores: dict[str, float] = {}
    for npc in court.npcs.values():
        preference = float(npc.resistance_by_strategy.get(strategy, 0.0))
        temp_fit = 1.0 - abs(court.temperature - npc.stance) / 140.0
        resentment_penalty = npc.resentment * 0.12
        random_noise = rng.uniform(-0.65, 0.65)
        score = (
            base_bias
            + preference * 2.4
            + resource_mod
            + issue_mod * 0.55
            + temp_fit
            + momentum_mod
            - resentment_penalty
            + random_noise
        )
        scores[npc.id] = score
    return scores


def _aggregate_strategy_effect(
    state: GameState,
    strategy: CourtStrategy,
    scores: dict[str, float],
    rng: random.Random,
) -> tuple[int, int]:
    court = state.court
    weighted_sum = 0.0
    stance_signal = 0.0
    total_influence = 0.0

    for npc in court.npcs.values():
        score = scores[npc.id]
        weighted_sum += score * npc.influence
        direction = 1.0 if score >= 0 else -0.35
        stance_signal += direction * npc.stance * npc.influence
        total_influence += npc.influence

    support_shift = _clamp(weighted_sum / max(1.0, total_influence * 0.9), -18, 18)
    temp_push = float(STRATEGY_PROFILE[strategy]["temperature_push"])
    temp_shift = _clamp(temp_push + stance_signal / 160.0 + rng.uniform(-2.0, 2.0), -20, 20)
    return support_shift, temp_shift


def _update_resentment(state: GameState, strategy: CourtStrategy, scores: dict[str, float]) -> None:
    court = state.court
    for npc in court.npcs.values():
        score = scores[npc.id]
        pref = float(npc.resistance_by_strategy.get(strategy, 0.0))
        rules = npc.resentment_gain_rules
        ignore_gain = max(1, int(rules.get("ignore", 1)))
        oppose_gain = max(1, int(rules.get("oppose", 1)))
        suppressed_gain = max(1, int(rules.get("suppressed", 1)))

        if score >= 1.2:
            npc.resentment = max(0, npc.resentment - 2)
            npc.ignored_rounds = 0
            continue

        if score >= 0:
            npc.resentment = max(0, npc.resentment - 1)
            if pref < 0.2:
                npc.ignored_rounds += 1
            else:
                npc.ignored_rounds = 0
        else:
            gain = oppose_gain
            if strategy == CourtStrategy.AUTHORITY:
                gain += suppressed_gain
            if pref < -0.2:
                gain += 1
            npc.resentment += gain
            npc.ignored_rounds += 1

        if npc.ignored_rounds >= 2 and pref < 0.25:
            npc.resentment += ignore_gain
            npc.ignored_rounds = 0

        npc.resentment = min(20, npc.resentment)


def _trigger_resentment_event_if_needed(state: GameState) -> list[str]:
    court = state.court
    if court.resentment_event_fired:
        return []

    yang = court.npcs["yang_yi"].resentment
    wei = court.npcs["wei_yan"].resentment
    dong = court.npcs["dong_yun"].resentment
    high_count = sum(1 for npc in court.npcs.values() if npc.resentment >= RESENTMENT_THRESHOLD)

    events: list[str] = []
    if yang >= 8 and wei >= 8:
        court.support = max(0, court.support - 8)
        apply_effects(state, {"delta": {"food": -6, "politics": -2}})
        events.append("殿廷争执：杨仪与魏延当殿冲突，临时补给 -6。")
    elif high_count >= 2:
        court.support = max(0, court.support - 10)
        court.time_pressure = max(0, court.time_pressure - 1)
        events.append("群臣掣肘：多派联名阻挠，支持度 -10，议事时限 -1。")
    elif dong >= RESENTMENT_THRESHOLD:
        court.support = max(0, court.support - 4)
        court.time_pressure = max(0, court.time_pressure - 1)
        events.append("制度掣肘：董允坚持复核，议事时限 -1。")
    elif yang >= RESENTMENT_THRESHOLD:
        court.support = max(0, court.support - 7)
        events.append("上奏阻挠：杨仪联名质疑军令，支持度 -7。")

    if events:
        court.resentment_event_fired = True
        court.current_rebound_events.extend(events)
    return events


def _append_reaction_lines(state: GameState, strategy: CourtStrategy, scores: dict[str, float]) -> None:
    court = state.court
    ordered = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    supports = [npc_id for npc_id, score in ordered if score >= 0.5][:2]
    opposes = [npc_id for npc_id, score in reversed(ordered) if score < 0][:2]

    for npc_id in opposes:
        npc = court.npcs[npc_id]
        _append_message(
            court,
            speaker_id=npc.id,
            speaker_name=npc.display_name,
            camp=npc.camp,
            text=_negative_line(npc.id, strategy),
        )
    for npc_id in supports:
        npc = court.npcs[npc_id]
        _append_message(
            court,
            speaker_id=npc.id,
            speaker_name=npc.display_name,
            camp=npc.camp,
            text=_positive_line(npc.id, strategy),
        )

    if "yang_yi" in supports and "wei_yan" in opposes:
        _append_message(
            court,
            speaker_id="wei_yan",
            speaker_name="魏延",
            camp="vanguard",
            text="魏延：只会算账，不会打仗！",
        )
    elif "wei_yan" in supports and "yang_yi" in opposes:
        _append_message(
            court,
            speaker_id="yang_yi",
            speaker_name="杨仪",
            camp="bureaucrat",
            text="杨仪：奇兵若败，国库先崩。",
        )

    _append_message(
        court,
        speaker_id="liu_shan",
        speaker_name="刘禅",
        camp="imperial",
        text=_liu_shan_progress_line(court.support, court.time_pressure),
    )


def _positive_line(npc_id: str, strategy: CourtStrategy) -> str:
    table: dict[str, dict[CourtStrategy, str]] = {
        "liu_shan": {
            CourtStrategy.RATIONAL: "刘禅：条理清楚，朕可据此发诏。",
            CourtStrategy.AUTHORITY: "刘禅：可先定令，但勿伤众心。",
            CourtStrategy.EMOTIONAL: "刘禅：军心可用，朕愿再给时机。",
        },
        "jiang_wan": {
            CourtStrategy.RATIONAL: "蒋琬：账目可核，这策可行。",
            CourtStrategy.AUTHORITY: "蒋琬：若令已定，我来补流程。",
            CourtStrategy.EMOTIONAL: "蒋琬：只要补给表能闭环，我支持。",
        },
        "fei_yi": {
            CourtStrategy.RATIONAL: "费祎：先稳后动，诸公都能接受。",
            CourtStrategy.AUTHORITY: "费祎：快刀可用，但我来缓冲众意。",
            CourtStrategy.EMOTIONAL: "费祎：此言能安军心，也能安民心。",
        },
        "yang_yi": {
            CourtStrategy.RATIONAL: "杨仪：至少这次证据齐全。",
            CourtStrategy.AUTHORITY: "杨仪：令出一门，效率会高。",
            CourtStrategy.EMOTIONAL: "杨仪：若真能控损，我暂且不驳。",
        },
        "dong_yun": {
            CourtStrategy.RATIONAL: "董允：依制可行，我可签押。",
            CourtStrategy.AUTHORITY: "董允：先补文书，再执行军令。",
            CourtStrategy.EMOTIONAL: "董允：若不越矩，可试一回。",
        },
        "jiang_wei": {
            CourtStrategy.RATIONAL: "姜维：给我明确窗口，我就出击。",
            CourtStrategy.AUTHORITY: "姜维：有令可依，前线更敢打。",
            CourtStrategy.EMOTIONAL: "姜维：将士愿随相父再进。",
        },
        "wei_yan": {
            CourtStrategy.RATIONAL: "魏延：既然有数，那就快打。",
            CourtStrategy.AUTHORITY: "魏延：只要放权，我立刻动兵。",
            CourtStrategy.EMOTIONAL: "魏延：此言痛快！给我奇兵！",
        },
    }
    return table[npc_id][strategy]


def _negative_line(npc_id: str, strategy: CourtStrategy) -> str:
    table: dict[str, dict[CourtStrategy, str]] = {
        "liu_shan": {
            CourtStrategy.RATIONAL: "刘禅：朕仍担心后继粮道。",
            CourtStrategy.AUTHORITY: "刘禅：强压可速，但恐伤和气。",
            CourtStrategy.EMOTIONAL: "刘禅：只凭血气，朕难安心。",
        },
        "jiang_wan": {
            CourtStrategy.RATIONAL: "蒋琬：数字还不够，风险未封顶。",
            CourtStrategy.AUTHORITY: "蒋琬：压令太急，执行会走样。",
            CourtStrategy.EMOTIONAL: "蒋琬：情绪不能替代里程与粮秣。",
        },
        "fei_yi": {
            CourtStrategy.RATIONAL: "费祎：此策恐激化朝争。",
            CourtStrategy.AUTHORITY: "费祎：压得越急，反弹越大。",
            CourtStrategy.EMOTIONAL: "费祎：此言鼓舞有余，落地不足。",
        },
        "yang_yi": {
            CourtStrategy.RATIONAL: "杨仪：证据链还有缺口。",
            CourtStrategy.AUTHORITY: "杨仪：动辄压制，只会逼人反弹。",
            CourtStrategy.EMOTIONAL: "杨仪：热血不是军令，别拿国运下注。",
        },
        "dong_yun": {
            CourtStrategy.RATIONAL: "董允：流程未完，不可强行。",
            CourtStrategy.AUTHORITY: "董允：越制行令，我必反对。",
            CourtStrategy.EMOTIONAL: "董允：鼓噪易，治国难。",
        },
        "jiang_wei": {
            CourtStrategy.RATIONAL: "姜维：过度保守会丢窗口。",
            CourtStrategy.AUTHORITY: "姜维：压令不等于真进攻。",
            CourtStrategy.EMOTIONAL: "姜维：若只喊口号，前线会失望。",
        },
        "wei_yan": {
            CourtStrategy.RATIONAL: "魏延：算到天黑也打不下城。",
            CourtStrategy.AUTHORITY: "魏延：只会压人，不如给兵。",
            CourtStrategy.EMOTIONAL: "魏延：说得好听，放手我才信。",
        },
    }
    return table[npc_id][strategy]


def _liu_shan_progress_line(support: int, time_pressure: int) -> str:
    if support >= SUPPORT_PASS_THRESHOLD - 8:
        return "刘禅：朝意渐齐，可议拍板。"
    if support <= SUPPORT_FAIL_THRESHOLD + 8:
        return "刘禅：分歧太大，朕忧前线。"
    if time_pressure <= 1:
        return "刘禅：时限将尽，速给可执行方案。"
    return "刘禅：继续辩，朕看谁更能服众。"


def _liu_shan_settlement_line(result: CourtResult) -> str:
    if result in {CourtResult.PASS, CourtResult.TIMEOUT_PASS}:
        return "刘禅：朕准此议，速发军令。"
    return "刘禅：此议未稳，先收权限再议北伐。"


def _should_settle(court: CourtState) -> bool:
    return (
        court.support >= SUPPORT_PASS_THRESHOLD
        or court.support <= SUPPORT_FAIL_THRESHOLD
        or court.time_pressure <= 0
    )


def _resolve_result(court: CourtState, force_timeout: bool = False) -> CourtResult:
    if court.support >= SUPPORT_PASS_THRESHOLD and not force_timeout:
        return CourtResult.PASS
    if court.support <= SUPPORT_FAIL_THRESHOLD and not force_timeout:
        return CourtResult.FAIL
    if court.support >= 52:
        return CourtResult.TIMEOUT_PASS
    return CourtResult.TIMEOUT_FAIL


def _build_modifier_for_result(state: GameState, result: CourtResult) -> CourtBattleModifier:
    court = state.court
    aggressive = court.temperature >= 32
    conservative = court.temperature <= -26
    severe_rebound = len(court.current_rebound_events) > 0

    if result in {CourtResult.PASS, CourtResult.TIMEOUT_PASS}:
        if aggressive:
            return CourtBattleModifier(
                id="edict_rapid_strike",
                title="锐进诏令",
                description="激进派获胜：战果上限更高，但失败惩罚同步放大。",
                turns_remaining=3,
                check_modifier=0.08,
                doom_per_turn_modifier=1,
                food_per_turn_modifier=-2,
                morale_per_turn_modifier=1,
                success_reward_food=4,
                success_reward_morale=3,
                failure_penalty_food=6,
                failure_penalty_morale=5,
                failure_penalty_doom=1,
                answer_tolerance_modifier=-1,
                risk_level="high",
            )
        if conservative:
            return CourtBattleModifier(
                id="edict_stable_front",
                title="守成诏令",
                description="保守派主导：推进变慢，但损失更可控。",
                turns_remaining=3,
                check_modifier=0.02,
                doom_per_turn_modifier=-1,
                food_per_turn_modifier=2,
                morale_per_turn_modifier=1,
                success_reward_food=1,
                success_reward_morale=1,
                failure_penalty_food=2,
                failure_penalty_morale=1,
                failure_penalty_doom=0,
                answer_tolerance_modifier=1,
                risk_level="low",
            )
        return CourtBattleModifier(
            id="edict_balanced_push",
            title="均衡北伐令",
            description="中间派达成共识：稳健增益，风险可控。",
            turns_remaining=3,
            check_modifier=0.05,
            doom_per_turn_modifier=0,
            food_per_turn_modifier=1,
            morale_per_turn_modifier=1,
            success_reward_food=2,
            success_reward_morale=2,
            failure_penalty_food=3,
            failure_penalty_morale=2,
            failure_penalty_doom=0,
            answer_tolerance_modifier=0,
            risk_level="medium",
        )

    if severe_rebound or state.food < 65:
        return CourtBattleModifier(
            id="court_obstruction",
            title="朝堂掣肘",
            description="反弹事件触发：军令受阻，补给与士气持续受压。",
            turns_remaining=3,
            check_modifier=-0.1,
            doom_per_turn_modifier=1,
            food_per_turn_modifier=-3,
            morale_per_turn_modifier=-2,
            success_reward_food=0,
            success_reward_morale=0,
            failure_penalty_food=4,
            failure_penalty_morale=3,
            failure_penalty_doom=1,
            answer_tolerance_modifier=-2,
            risk_level="high",
        )

    return CourtBattleModifier(
        id="court_drag",
        title="议而未决",
        description="朝议失衡：推进效率下降，战场容错变低。",
        turns_remaining=2,
        check_modifier=-0.06,
        doom_per_turn_modifier=1,
        food_per_turn_modifier=-2,
        morale_per_turn_modifier=-1,
        success_reward_food=0,
        success_reward_morale=1,
        failure_penalty_food=3,
        failure_penalty_morale=2,
        failure_penalty_doom=1,
        answer_tolerance_modifier=-1,
        risk_level="medium",
    )


def _immediate_delta_for_result(result: CourtResult) -> dict[str, int]:
    if result == CourtResult.PASS:
        return {"morale": 4, "politics": 3}
    if result == CourtResult.TIMEOUT_PASS:
        return {"morale": 2, "politics": 1}
    if result == CourtResult.FAIL:
        return {"food": -8, "morale": -6, "politics": -4}
    return {"food": -5, "morale": -4, "politics": -3}


def _summary_for_result(result: CourtResult, modifier_title: str) -> str:
    if result == CourtResult.PASS:
        return f"朝议通过，获「{modifier_title}」。"
    if result == CourtResult.TIMEOUT_PASS:
        return f"压线通过，获「{modifier_title}」。"
    if result == CourtResult.FAIL:
        return f"朝议失利，触发「{modifier_title}」。"
    return f"时限耗尽，触发「{modifier_title}」。"


def _pick_auto_strategy(state: GameState) -> CourtStrategy:
    court = state.court
    tags = set(court.current_issue_tags)
    if court.support < 42 and ("morale" in tags or "momentum" in tags):
        return CourtStrategy.EMOTIONAL
    if "supply" in tags or "stability" in tags or "risk" in tags:
        return CourtStrategy.RATIONAL
    if court.time_pressure <= 1 and court.support < 60:
        return CourtStrategy.AUTHORITY
    if court.temperature < 15 and court.support >= 60:
        return CourtStrategy.EMOTIONAL
    return CourtStrategy.RATIONAL
