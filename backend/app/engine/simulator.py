from __future__ import annotations

import random
from dataclasses import dataclass

from app.engine import balance
from app.engine.runtime import GameEngine
from app.models.event_graph import NodeType
from app.models.state import Outcome


@dataclass
class SimulationSummary:
    runs: int
    wins: int
    defeats: int
    stuck_runs: int
    avg_turns: float

    @property
    def win_rate(self) -> float:
        return self.wins / self.runs if self.runs else 0.0

    @property
    def defeat_rate(self) -> float:
        return self.defeats / self.runs if self.runs else 0.0


def simulate(n: int = 2000, seed: int = 42) -> SimulationSummary:
    wins = 0
    defeats = 0
    stuck = 0
    total_turns = 0

    for i in range(n):
        engine = GameEngine()
        game_seed = seed + i
        state = engine.new_game(game_id=f"sim-{i}", seed=game_seed)
        policy_rng = random.Random(seed * 1000 + i)

        steps = 0
        while state.outcome == Outcome.ONGOING and steps < balance.MAX_TURNS_PER_RUN:
            node = engine.graph.get(state.current_node_id)
            if node.node_type == NodeType.CHOICE:
                enabled = [opt for opt in state.current_event.options if not opt.disabled]
                if enabled and policy_rng.random() < 0.95:
                    chosen = _weighted_choice(enabled, policy_rng)
                    state = engine.act(state.game_id, "choose_option", {"option_id": chosen.id})
                else:
                    state = engine.act(state.game_id, "next_turn", {})
            else:
                state = engine.act(state.game_id, "next_turn", {})
            steps += 1

        if state.outcome == Outcome.ONGOING:
            for _ in range(balance.MAX_TURNS_PER_RUN):
                state = engine.act(state.game_id, "next_turn", {})
                if state.outcome != Outcome.ONGOING:
                    break

        total_turns += state.turn

        if state.outcome == Outcome.WIN:
            wins += 1
        elif state.outcome == Outcome.DEFEAT_SHU:
            defeats += 1
        else:
            defeats += 1

    return SimulationSummary(
        runs=n,
        wins=wins,
        defeats=defeats,
        stuck_runs=stuck,
        avg_turns=total_turns / n if n else 0.0,
    )


def _weighted_choice(options, rng: random.Random):
    danger_ids = {"field_battle", "cede_outskirts", "postpone_attack", "fallback_defense", "reorganize", "pull_back"}
    progress_ids = {
        "advance_ch3",
        "launch_final",
        "steady_siege",
        "hold_one_turn",
        "claim_victory",
        "continue_hold",
        "enter_ch4",
        "enter_ch2",
    }
    rebuild_ids = {"recover_food", "recover_morale", "appease_court", "stabilize_front"}

    weighted: list[tuple[float, object]] = []
    total = 0.0
    for opt in options:
        weight = 1.0
        if opt.id in danger_ids:
            weight = 0.2
        elif opt.id in progress_ids:
            weight = 2.2
        elif opt.id in rebuild_ids:
            weight = 1.3
        weighted.append((weight, opt))
        total += weight

    ticket = rng.uniform(0, total)
    cursor = 0.0
    for weight, opt in weighted:
        cursor += weight
        if ticket <= cursor:
            return opt
    return weighted[-1][1]
