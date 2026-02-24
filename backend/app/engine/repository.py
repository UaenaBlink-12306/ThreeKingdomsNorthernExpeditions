from __future__ import annotations

import base64
import pickle
import random
from dataclasses import dataclass, field
from typing import Any, Protocol

from app.models.state import GameState


@dataclass
class GameSession:
    state: GameState
    rng: random.Random
    diagnostics: list[dict[str, Any]] = field(default_factory=list)
    action_history: list[dict[str, Any]] = field(default_factory=list)

    def serialize_state(self) -> str:
        return self.state.model_dump_json()

    def serialize_rng(self) -> str:
        payload = pickle.dumps(self.rng.getstate())
        return base64.b64encode(payload).decode("ascii")

    @classmethod
    def from_serialized(cls, state_json: str, rng_state: str) -> GameSession:
        state = GameState.model_validate_json(state_json)
        rng = random.Random()
        payload = base64.b64decode(rng_state.encode("ascii"))
        rng.setstate(pickle.loads(payload))
        return cls(state=state, rng=rng)


class StateRepository(Protocol):
    def create(self, state: GameState) -> GameSession: ...

    def get(self, game_id: str) -> GameSession | None: ...

    def save(self, session: GameSession) -> None: ...

    def reset(self, game_id: str | None = None) -> None: ...


class InMemoryRepository:
    def __init__(self) -> None:
        self._sessions: dict[str, GameSession] = {}

    def create(self, state: GameState) -> GameSession:
        session = GameSession(
            state=state,
            rng=random.Random(state.seed),
            diagnostics=[],
            action_history=[],
        )
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
