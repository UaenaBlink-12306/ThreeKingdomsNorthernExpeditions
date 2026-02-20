from __future__ import annotations

import random

from app.engine.repository_sqlite import SQLiteRepository
from app.models.state import EventView, GameState, Outcome, Phase


def _make_state(game_id: str, seed: int = 123) -> GameState:
    return GameState(
        game_id=game_id,
        chapter=1,
        turn=1,
        phase=Phase.CAMPAIGN,
        outcome=Outcome.ONGOING,
        food=100,
        morale=70,
        politics=60,
        wei_pressure=2,
        health=3,
        doom=0,
        longyou_turns=0,
        guanzhong_turns=0,
        longyou_collapsed=False,
        flags={"wood_ox_done": False},
        log=["start"],
        current_node_id="start",
        current_event=EventView(text="t", options=[]),
        current_location="chengdu",
        controlled_locations=["chengdu"],
        active_route_id=None,
        route_progress=0.0,
        seed=seed,
        roll_count=0,
    )


def test_sqlite_repository_create_get_save_reset(tmp_path) -> None:
    repo = SQLiteRepository(str(tmp_path / "sessions.db"))
    state = _make_state("g-1")

    session = repo.create(state)
    loaded = repo.get("g-1")

    assert loaded is not None
    assert loaded.state.game_id == "g-1"
    assert loaded.state.seed == state.seed

    session.state.turn = 2
    session.state.log.append("after")
    repo.save(session)

    loaded_after = repo.get("g-1")
    assert loaded_after is not None
    assert loaded_after.state.turn == 2
    assert loaded_after.state.log[-1] == "after"

    repo.reset("g-1")
    assert repo.get("g-1") is None

    repo.create(_make_state("g-2"))
    repo.create(_make_state("g-3"))
    repo.reset()
    assert repo.get("g-2") is None
    assert repo.get("g-3") is None


def test_sqlite_repository_recover_after_restart(tmp_path) -> None:
    db_path = str(tmp_path / "sessions.db")
    repo_1 = SQLiteRepository(db_path)
    session = repo_1.create(_make_state("g-restart", seed=2024))
    session.state.turn = 5
    session.rng.random()
    session.state.roll_count += 1
    repo_1.save(session)

    repo_2 = SQLiteRepository(db_path)
    loaded = repo_2.get("g-restart")

    assert loaded is not None
    assert loaded.state.turn == 5
    assert loaded.state.roll_count == 1


def test_sqlite_repository_rng_sequence_continuity(tmp_path) -> None:
    seed = 77
    consumed_roll_count = 6
    db_path = str(tmp_path / "sessions.db")

    repo = SQLiteRepository(db_path)
    session = repo.create(_make_state("g-rng", seed=seed))
    for _ in range(consumed_roll_count):
        session.rng.random()
        session.state.roll_count += 1
    repo.save(session)

    repo_restarted = SQLiteRepository(db_path)
    loaded = repo_restarted.get("g-rng")
    assert loaded is not None
    assert loaded.state.roll_count == consumed_roll_count

    expected_rng = random.Random(seed)
    for _ in range(consumed_roll_count):
        expected_rng.random()

    for _ in range(3):
        assert loaded.rng.random() == expected_rng.random()
