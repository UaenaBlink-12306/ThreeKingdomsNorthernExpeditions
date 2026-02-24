from __future__ import annotations

from app.engine.simulator import simulate


def test_simulate_runs_without_stuck_and_winrate_in_target_band() -> None:
    summary = simulate(n=2000, seed=42)

    assert summary.stuck_runs == 0
    assert 0.015 <= summary.win_rate <= 0.08
