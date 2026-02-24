from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class CourtStrategy(str, Enum):
    RATIONAL = "rational_argument"
    AUTHORITY = "authority_pressure"
    EMOTIONAL = "emotional_mobilization"


class CourtResult(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    TIMEOUT_PASS = "timeout_pass"
    TIMEOUT_FAIL = "timeout_fail"


class CourtNpcConfig(BaseModel):
    id: str
    display_name: str
    persona_tag: str
    camp: str
    base_stance: int
    influence: int
    resistance_by_strategy: dict[CourtStrategy, float]
    resentment_gain_rules: dict[str, int]
    dialogue_style_tags: list[str] = Field(default_factory=list)
    event_hooks: list[str] = Field(default_factory=list)


class CourtNpcState(BaseModel):
    id: str
    display_name: str
    persona_tag: str
    camp: str
    stance: int
    influence: int
    resistance_by_strategy: dict[CourtStrategy, float]
    resentment_gain_rules: dict[str, int]
    dialogue_style_tags: list[str] = Field(default_factory=list)
    event_hooks: list[str] = Field(default_factory=list)
    resentment: int = 0
    ignored_rounds: int = 0


class CourtMessage(BaseModel):
    id: str
    speaker_id: str
    speaker_name: str
    camp: str
    text: str


class CourtBattleModifier(BaseModel):
    id: str
    title: str
    description: str
    turns_remaining: int
    check_modifier: float = 0.0
    doom_per_turn_modifier: int = 0
    food_per_turn_modifier: int = 0
    morale_per_turn_modifier: int = 0
    success_reward_food: int = 0
    success_reward_morale: int = 0
    failure_penalty_food: int = 0
    failure_penalty_morale: int = 0
    failure_penalty_doom: int = 0
    answer_tolerance_modifier: int = 0
    risk_level: str = "medium"


class CourtResolution(BaseModel):
    session_id: int
    turn_resolved: int
    result: CourtResult
    summary: str
    support: int
    temperature: int
    triggered_events: list[str] = Field(default_factory=list)
    modifier: CourtBattleModifier | None = None


class CourtHistoryEntry(BaseModel):
    session_id: int
    turn_resolved: int
    result: CourtResult
    support: int
    temperature: int
    modifier_id: str | None = None


COURT_NPC_CONFIGS: tuple[CourtNpcConfig, ...] = (
    CourtNpcConfig(
        id="liu_shan",
        display_name="刘禅",
        persona_tag="温和拍板",
        camp="imperial",
        base_stance=12,
        influence=5,
        resistance_by_strategy={
            CourtStrategy.RATIONAL: 0.45,
            CourtStrategy.AUTHORITY: 0.35,
            CourtStrategy.EMOTIONAL: 0.5,
        },
        resentment_gain_rules={"ignore": 1, "oppose": 1, "suppressed": 1},
        dialogue_style_tags=["温和", "支持北伐", "最终拍板"],
        event_hooks=["imperial_question"],
    ),
    CourtNpcConfig(
        id="jiang_wan",
        display_name="蒋琬",
        persona_tag="务实行政治理",
        camp="administration",
        base_stance=-8,
        influence=4,
        resistance_by_strategy={
            CourtStrategy.RATIONAL: 0.9,
            CourtStrategy.AUTHORITY: -0.15,
            CourtStrategy.EMOTIONAL: -0.2,
        },
        resentment_gain_rules={"ignore": 1, "oppose": 2, "suppressed": 2},
        dialogue_style_tags=["务实", "要证据", "重可行性"],
        event_hooks=["supply_pressure"],
    ),
    CourtNpcConfig(
        id="fei_yi",
        display_name="费祎",
        persona_tag="温和外交",
        camp="moderate",
        base_stance=4,
        influence=3,
        resistance_by_strategy={
            CourtStrategy.RATIONAL: 0.55,
            CourtStrategy.AUTHORITY: 0.1,
            CourtStrategy.EMOTIONAL: 0.45,
        },
        resentment_gain_rules={"ignore": 1, "oppose": 1, "suppressed": 1},
        dialogue_style_tags=["缓和冲突", "偏支持"],
        event_hooks=["mediate_conflict"],
    ),
    CourtNpcConfig(
        id="yang_yi",
        display_name="杨仪",
        persona_tag="尖锐官僚",
        camp="bureaucrat",
        base_stance=-26,
        influence=4,
        resistance_by_strategy={
            CourtStrategy.RATIONAL: 0.15,
            CourtStrategy.AUTHORITY: -0.6,
            CourtStrategy.EMOTIONAL: -0.65,
        },
        resentment_gain_rules={"ignore": 2, "oppose": 2, "suppressed": 3},
        dialogue_style_tags=["挑刺", "制造压力"],
        event_hooks=["conflict_with_wei_yan"],
    ),
    CourtNpcConfig(
        id="dong_yun",
        display_name="董允",
        persona_tag="制度刚直",
        camp="institution",
        base_stance=-34,
        influence=4,
        resistance_by_strategy={
            CourtStrategy.RATIONAL: 0.7,
            CourtStrategy.AUTHORITY: -0.5,
            CourtStrategy.EMOTIONAL: -0.8,
        },
        resentment_gain_rules={"ignore": 2, "oppose": 2, "suppressed": 3},
        dialogue_style_tags=["重规制", "重稳定"],
        event_hooks=["institutional_brake"],
    ),
    CourtNpcConfig(
        id="jiang_wei",
        display_name="姜维",
        persona_tag="主战进取",
        camp="hawk",
        base_stance=38,
        influence=3,
        resistance_by_strategy={
            CourtStrategy.RATIONAL: 0.2,
            CourtStrategy.AUTHORITY: 0.25,
            CourtStrategy.EMOTIONAL: 0.9,
        },
        resentment_gain_rules={"ignore": 1, "oppose": 2, "suppressed": 2},
        dialogue_style_tags=["乘胜追击", "支持进攻"],
        event_hooks=["offensive_push"],
    ),
    CourtNpcConfig(
        id="wei_yan",
        display_name="魏延",
        persona_tag="奇谋冒进",
        camp="vanguard",
        base_stance=58,
        influence=4,
        resistance_by_strategy={
            CourtStrategy.RATIONAL: -0.35,
            CourtStrategy.AUTHORITY: -0.3,
            CourtStrategy.EMOTIONAL: 1.0,
        },
        resentment_gain_rules={"ignore": 2, "oppose": 2, "suppressed": 3},
        dialogue_style_tags=["高风险奇谋", "争议人物", "与杨仪冲突"],
        event_hooks=["conflict_with_yang_yi", "high_risk_plan"],
    ),
)


def default_court_npc_states() -> dict[str, CourtNpcState]:
    states: dict[str, CourtNpcState] = {}
    for config in COURT_NPC_CONFIGS:
        states[config.id] = CourtNpcState(
            id=config.id,
            display_name=config.display_name,
            persona_tag=config.persona_tag,
            camp=config.camp,
            stance=config.base_stance,
            influence=config.influence,
            resistance_by_strategy=dict(config.resistance_by_strategy),
            resentment_gain_rules=dict(config.resentment_gain_rules),
            dialogue_style_tags=list(config.dialogue_style_tags),
            event_hooks=list(config.event_hooks),
        )
    return states


class CourtState(BaseModel):
    is_active: bool = False
    session_id: int = 0
    return_phase: str = "campaign"
    temperature: int = 0
    support: int = 55
    time_pressure: int = 0
    max_time_pressure: int = 0
    npcs: dict[str, CourtNpcState] = Field(default_factory=default_court_npc_states)
    history: list[CourtHistoryEntry] = Field(default_factory=list)
    pending_messages: list[CourtMessage] = Field(default_factory=list)
    current_issues: list[str] = Field(default_factory=list)
    current_issue_tags: list[str] = Field(default_factory=list)
    active_modifier: CourtBattleModifier | None = None
    last_resolution: CourtResolution | None = None
    last_trigger_turn: int = 0
    message_seq: int = 0
    resentment_event_fired: bool = False
    momentum: int = 0
    current_rebound_events: list[str] = Field(default_factory=list)
