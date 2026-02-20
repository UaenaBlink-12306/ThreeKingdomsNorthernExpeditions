from __future__ import annotations

import os
import random
import uuid
from pathlib import Path
from typing import Any

from app.engine import balance
from app.engine.checks import roll_check
from app.engine.conditions import evaluate_condition
from app.engine.effects import add_log, apply_effects
from app.engine.graph import EventGraph, load_graph
from app.engine.map_catalog import PLACE_ORDER
from app.engine.repository import InMemoryRepository, StateRepository
from app.engine.repository_sqlite import SQLiteRepository
from app.models.event_graph import NodeType
from app.models.state import EventView, GameState, OptionView, Outcome, Phase


class GameEngine:
    def __init__(self, repository: StateRepository | None = None, graph: EventGraph | None = None) -> None:
        self.repository = repository or self._build_repository_from_env()
        if graph is not None:
            self.graph = graph
        else:
            data_path = Path(__file__).resolve().parent.parent / "data" / "events.json"
            self.graph = load_graph(data_path)

    def _build_repository_from_env(self) -> StateRepository:
        backend = os.getenv("REPOSITORY_BACKEND", "inmemory").strip().lower()
        if backend == "sqlite":
            default_path = Path(__file__).resolve().parents[2] / "data" / "game_sessions.db"
            db_path = os.getenv("SQLITE_PATH", str(default_path))
            return SQLiteRepository(db_path=db_path)
        return InMemoryRepository()

    def new_game(self, game_id: str | None = None, seed: int | None = None) -> GameState:
        gid = game_id or str(uuid.uuid4())
        if seed is None:
            seed = random.SystemRandom().randint(1, 2_147_483_647)

        initial = GameState(
            game_id=gid,
            chapter=1,
            turn=1,
            phase=Phase.CAMPAIGN,
            outcome=Outcome.ONGOING,
            food=balance.INITIAL_FOOD,
            morale=balance.INITIAL_MORALE,
            politics=balance.INITIAL_POLITICS,
            wei_pressure=balance.INITIAL_WEI_PRESSURE,
            health=balance.INITIAL_HEALTH,
            doom=balance.INITIAL_DOOM,
            longyou_turns=0,
            guanzhong_turns=0,
            longyou_collapsed=False,
            flags={
                "wood_ox_done": False,
                "jieting_held": False,
                "post_zhuge_era": False,
                "core_lost": False,
                "doom_chain_active": False,
            },
            log=["新局开启：丞相北伐，先取陇右，再图关中。"],
            current_node_id=self.graph.start_node,
            current_event=EventView(text="", options=[]),
            current_location="chengdu",
            controlled_locations=["chengdu", "hanzhong"],
            active_route_id=None,
            route_progress=0.0,
            seed=seed,
            roll_count=0,
        )
        session = self.repository.create(initial)
        self._set_node(session.state, self.graph.start_node)
        self._resolve_checks(session)
        self._evaluate_outcome(session)
        self.repository.save(session)
        return session.state

    def get_state(self, game_id: str) -> GameState:
        session = self._require_session(game_id)
        return session.state

    def reset(self, game_id: str | None = None) -> None:
        self.repository.reset(game_id)

    def act(self, game_id: str, action: str, payload: dict[str, Any] | None = None) -> GameState:
        session = self._require_session(game_id)
        state = session.state

        if state.outcome != Outcome.ONGOING:
            return state

        payload = payload or {}
        action = self._normalize_action(action)

        if action == "choose_option":
            option_id = payload.get("option_id")
            if not isinstance(option_id, str):
                raise ValueError("choose_option requires payload.option_id")
            self._choose_option(session, option_id)
        elif action == "next_turn":
            self._next_turn(session)
        else:
            raise ValueError(f"Unsupported action: {action}")

        self._evaluate_outcome(session)
        self.repository.save(session)
        return state

    def _normalize_action(self, action: str) -> str:
        if action in {"recover_choice", "court_choice", "defense_choice"}:
            return "choose_option"
        return action

    def _next_turn(self, session) -> None:
        state = session.state
        state.turn += 1

        doom_gain = 1
        if state.food < 60:
            doom_gain += 1
        if state.wei_pressure >= 6:
            doom_gain += 1
        if state.longyou_collapsed:
            doom_gain += 1
        if state.flags.get("post_zhuge_era", False):
            doom_gain += balance.POST_ZHUGE_DOOM_BONUS
            state.politics = max(0, state.politics - balance.POST_ZHUGE_POLITICS_BONUS)

        state.doom += doom_gain
        add_log(state, f"第{state.turn}回合：战局推进，危机值 +{doom_gain}。")

        if state.chapter == 4 and not state.flags.get("post_zhuge_era", False):
            state.health -= 1
            add_log(state, "五丈原对峙拖长，丞相积劳成疾。")
            self._trigger_post_zhuge_if_needed(state)

        if state.phase in {Phase.CAMPAIGN, Phase.FINAL} and state.active_route_id:
            state.route_progress = min(1.0, state.route_progress + balance.ROUTE_PROGRESS_STEP_PER_TURN)

        if state.doom >= balance.DOOM_THRESHOLD and not state.flags.get("doom_chain_active", False):
            state.flags["doom_chain_active"] = True
            add_log(state, "亡国危机爆发：魏国发动总攻。")
            self._transition(session, "doom_total_offensive")

    def _choose_option(self, session, option_id: str) -> None:
        state = session.state
        node = self.graph.get(state.current_node_id)
        if node.node_type != NodeType.CHOICE:
            raise ValueError("Current node is not a choice node")

        options = {opt.id: opt for opt in node.options}
        option = options.get(option_id)
        if option is None:
            raise ValueError("Unknown option id")

        if not evaluate_condition(option.condition, state):
            raise ValueError("Option condition not satisfied")

        apply_effects(state, option.effects)
        self._transition(session, option.next)

    def _transition(self, session, next_node_id: str) -> None:
        self._set_node(session.state, next_node_id)
        self._resolve_checks(session)

    def _add_fx_token(self, state: GameState, token: str) -> None:
        add_log(state, token)

    def _sorted_controlled_locations(self, places: set[str]) -> list[str]:
        order = {place_id: index for index, place_id in enumerate(PLACE_ORDER)}
        return sorted(places, key=lambda item: order.get(item, 10_000))

    def apply_node_meta(self, state: GameState, node) -> None:
        prev_route = state.active_route_id
        state.current_location = node.meta.location

        controlled = set(state.controlled_locations)
        controlled.update(node.meta.gain_control)
        for place_id in node.meta.lose_control:
            controlled.discard(place_id)
        state.controlled_locations = self._sorted_controlled_locations(controlled)

        state.active_route_id = node.meta.route_id
        if prev_route != state.active_route_id:
            state.route_progress = 0.0
            if state.active_route_id:
                self._add_fx_token(state, f"FX_ROUTE|route={state.active_route_id}")
        elif state.active_route_id is None:
            state.route_progress = 0.0

    def _set_node(self, state: GameState, node_id: str) -> None:
        node = self.graph.get(node_id)
        state.current_node_id = node_id

        if node.chapter is not None:
            state.chapter = node.chapter
        if node.phase is not None:
            state.phase = Phase(node.phase)

        self.apply_node_meta(state, node)

        if node.node_type == NodeType.TERMINAL:
            if node.id == "WIN":
                state.outcome = Outcome.WIN
                self._add_fx_token(state, "FX_OUTCOME|result=WIN")
            elif node.id == "DEFEAT_SHU":
                state.outcome = Outcome.DEFEAT_SHU
                self._add_fx_token(state, "FX_OUTCOME|result=DEFEAT_SHU")

        options: list[OptionView] = []
        if node.node_type == NodeType.CHOICE:
            for opt in node.options:
                options.append(
                    OptionView(
                        id=opt.id,
                        label=opt.label,
                        disabled=not evaluate_condition(opt.condition, state),
                    )
                )

        state.current_event = EventView(text=node.text, options=options)

    def _resolve_checks(self, session) -> None:
        state = session.state
        for _ in range(32):
            node = self.graph.get(state.current_node_id)
            if node.node_type != NodeType.CHECK or state.outcome != Outcome.ONGOING:
                break

            check_key = node.check or ""
            if check_key:
                success, roll, probability = roll_check(check_key, state, session.rng)
                add_log(state, f"检定[{check_key}]：{roll:.2f} / {probability:.2f}。")
            else:
                success = True

            if success:
                apply_effects(state, node.success_effects)
                next_node = node.success_next
            else:
                apply_effects(state, node.fail_effects)
                next_node = node.fail_next

            self._trigger_post_zhuge_if_needed(state)

            if not next_node:
                raise ValueError(f"Check node {node.id} missing next target")

            next_location = self.graph.get(next_node).meta.location
            result_text = "SUCCESS" if success else "FAIL"
            self._add_fx_token(state, f"FX_CHECK|node={node.id}|result={result_text}|loc={next_location}")

            self._set_node(state, next_node)
            self._evaluate_outcome(session)
            if state.outcome != Outcome.ONGOING:
                break

    def _trigger_post_zhuge_if_needed(self, state: GameState) -> None:
        if state.health > 0 or state.flags.get("post_zhuge_era", False):
            return
        state.flags["post_zhuge_era"] = True
        state.health = 0
        state.food = min(state.food, balance.MAX_FOOD_POST_ZHUGE)
        state.wei_pressure = min(balance.MAX_WEI_PRESSURE, state.wei_pressure + 1)
        add_log(state, "丞相薨逝，后诸葛时代开启：中枢效率下降，政争加剧。")

    def _evaluate_outcome(self, session) -> None:
        state = session.state
        if state.outcome != Outcome.ONGOING:
            return

        self._trigger_post_zhuge_if_needed(state)

        if state.flags.get("core_lost", False):
            self._set_node(state, "DEFEAT_SHU")
            return

        if state.guanzhong_turns >= 3 and not state.longyou_collapsed:
            self._set_node(state, "WIN")
            return

        if state.doom >= balance.DOOM_THRESHOLD and state.current_node_id not in {"doom_total_offensive", "doom_defense_check", "DEFEAT_SHU"}:
            state.flags["doom_chain_active"] = True
            self._set_node(state, "doom_total_offensive")

    def _require_session(self, game_id: str):
        session = self.repository.get(game_id)
        if session is None:
            raise KeyError(f"game_id not found: {game_id}")
        return session
