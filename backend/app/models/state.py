from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field

from app.models.court import CourtState

class Phase(str, Enum):
    CAMPAIGN = "campaign"
    RECOVER = "recover"
    COURT = "court"
    DEFENSE = "defense"
    FINAL = "final"


class Outcome(str, Enum):
    ONGOING = "ONGOING"
    WIN = "WIN"
    DEFEAT_SHU = "DEFEAT_SHU"


class OptionView(BaseModel):
    id: str
    label: str
    disabled: bool = False


class EventView(BaseModel):
    text: str
    options: list[OptionView] = Field(default_factory=list)


class GameState(BaseModel):
    game_id: str
    chapter: int
    turn: int
    phase: Phase
    outcome: Outcome
    food: int
    morale: int
    politics: int
    wei_pressure: int
    health: int
    doom: int
    longyou_turns: int
    guanzhong_turns: int
    longyou_collapsed: bool
    flags: dict[str, bool] = Field(default_factory=dict)
    log: list[str] = Field(default_factory=list)
    current_node_id: str
    current_event: EventView
    current_location: str
    controlled_locations: list[str] = Field(default_factory=list)
    active_route_id: str | None = None
    route_progress: float = 0.0
    seed: int
    roll_count: int
    court: CourtState = Field(default_factory=CourtState)
