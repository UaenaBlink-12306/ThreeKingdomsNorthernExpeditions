from __future__ import annotations

import random
import sqlite3
from pathlib import Path

from app.engine.repository import GameSession
from app.models.state import GameState


class SQLiteRepository:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    game_id TEXT PRIMARY KEY,
                    state_json TEXT NOT NULL,
                    rng_state TEXT NOT NULL,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

    def create(self, state: GameState) -> GameSession:
        session = GameSession(state=state, rng=random.Random(state.seed))
        self.save(session)
        return session

    def get(self, game_id: str) -> GameSession | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT state_json, rng_state FROM sessions WHERE game_id = ?", (game_id,)
            ).fetchone()

        if row is None:
            return None

        return GameSession.from_serialized(row["state_json"], row["rng_state"])

    def save(self, session: GameSession) -> None:
        state_json = session.serialize_state()
        rng_state = session.serialize_rng()

        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO sessions (game_id, state_json, rng_state, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(game_id) DO UPDATE SET
                    state_json = excluded.state_json,
                    rng_state = excluded.rng_state,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (session.state.game_id, state_json, rng_state),
            )

    def reset(self, game_id: str | None = None) -> None:
        with self._connect() as conn:
            if game_id is None:
                conn.execute("DELETE FROM sessions")
                return
            conn.execute("DELETE FROM sessions WHERE game_id = ?", (game_id,))
