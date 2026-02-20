from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class NewGameRequest(BaseModel):
    game_id: str | None = None
    seed: int | None = None


class ActRequest(BaseModel):
    game_id: str
    action: str
    payload: dict[str, Any] | None = None


class ResetRequest(BaseModel):
    game_id: str | None = None
