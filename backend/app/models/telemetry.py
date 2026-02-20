from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ReplayAction(BaseModel):
    action: str
    payload: dict[str, Any] = Field(default_factory=dict)


class TraceEntry(BaseModel):
    level: str
    event: str
    game_id: str
    turn: int
    node: str
    action: str | None = None
    payload: dict[str, Any] | None = None
    check_key: str | None = None
    probability: float | None = None
    roll: float | None = None
    success: bool | None = None
    changes: dict[str, Any] | None = None


class ReplayView(BaseModel):
    game_id: str
    seed: int
    actions: list[ReplayAction] = Field(default_factory=list)
    diagnostics: list[TraceEntry] = Field(default_factory=list)
