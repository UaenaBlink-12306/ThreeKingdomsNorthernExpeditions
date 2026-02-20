from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Protocol

from app.models.state import GameState


@dataclass
class GameSession:
    state: GameState
    rng: random.Random


class StateRepository(Protocol):
    def create(self, state: GameState) -> GameSession: ...

    def get(self, game_id: str) -> GameSession | None: ...

    def save(self, session: GameSession) -> None: ...

    def reset(self, game_id: str | None = None) -> None: ...


class InMemoryRepository:
    def __init__(self) -> None:
        self._sessions: dict[str, GameSession] = {}

    def create(self, state: GameState) -> GameSession:
        session = GameSession(state=state, rng=random.Random(state.seed))
        self._sessions[state.game_id] = session
        return session

    def get(self, game_id: str) -> GameSession | None:
        return self._sessions.get(game_id)

    def save(self, session: GameSession) -> None:
        self._sessions[session.state.game_id] = session

    def reset(self, game_id: str | None = None) -> None:
        if game_id is None:
            self._sessions.clear()
            return
        self._sessions.pop(game_id, None)
