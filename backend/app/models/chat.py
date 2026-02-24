from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field

from app.models.state import GameState


class ChatMode(str, Enum):
    PRETURN_ADVISOR = "preturn_advisor"
    AFTERTURN_INTERPRETER = "afterturn_interpreter"
    SCENARIO_MENTOR = "scenario_mentor"
    ROLEPLAY = "roleplay"


class ChatRequest(BaseModel):
    mode: ChatMode
    game_state: GameState
    previous_state: GameState | None = None
    delta_summary: list[str] = Field(default_factory=list)
    delta_log: list[str] = Field(default_factory=list)
    user_message: str | None = None
    roleplay_character: str | None = None


class ChatResponse(BaseModel):
    mode: ChatMode
    content: str
    model: str
