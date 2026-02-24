from __future__ import annotations

import copy
import logging
import os
import random
import uuid
from pathlib import Path
from typing import Any

from app.engine import balance
from app.engine.checks import roll_check
from app.engine.court import (
    apply_battle_turn_modifier,
    apply_check_outcome_modifier,
    begin_court_session,
    fast_forward_court_session,
    resolve_court_strategy,
    settle_court_session,
    should_trigger_court,
)
from app.engine.conditions import evaluate_condition
from app.engine.effects import add_log, apply_effects
from app.engine.graph import EventGraph, load_graph
from app.engine.map_catalog import PLACE_ORDER
from app.engine.repository import InMemoryRepository, StateRepository
from app.engine.repository_sqlite import SQLiteRepository
from app.models.court import CourtStrategy
from app.models.event_graph import NodeType
from app.models.state import EventView, GameState, OptionView, Outcome, Phase

logger = logging.getLogger(__name__)


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
        self._record_action(session, "new_game", {"seed": seed})
        self._trace(
            session,
            level="info",
            event="new_game",
            action="new_game",
            payload={"seed": seed},
        )

        self._set_node(session.state, self.graph.start_node)
        self._maybe_start_court_on_phase_entry(session)
        self._resolve_checks(session)
        self._evaluate_outcome(session)
        self.repository.save(session)
        return session.state

    def get_state(self, game_id: str) -> GameState:
        session = self._require_session(game_id)
        if self._ensure_court_session(session):
            self.repository.save(session)
        return session.state

    def get_replay(self, game_id: str) -> dict[str, Any]:
        session = self._require_session(game_id)
        return {
            "game_id": session.state.game_id,
            "seed": session.state.seed,
            "actions": copy.deepcopy(session.action_history),
            "diagnostics": copy.deepcopy(session.diagnostics),
        }

    def reset(self, game_id: str | None = None) -> None:
        self.repository.reset(game_id)

    def act(self, game_id: str, action: str, payload: dict[str, Any] | None = None) -> GameState:
        session = self._require_session(game_id)
        state = session.state

        if self._ensure_court_session(session):
            self.repository.save(session)

        if state.outcome != Outcome.ONGOING:
            return state

        payload = payload or {}
        action = self._normalize_action(action)
        before = self._snapshot_state(state)
        self._record_action(session, action, payload)
        self._trace(session, level="info", event="action", action=action, payload=payload)

        if action == "choose_option":
            option_id = payload.get("option_id")
            if not isinstance(option_id, str):
                raise ValueError("choose_option requires payload.option_id")
            if state.court.is_active:
                self._court_strategy(session, self._legacy_option_to_strategy(option_id))
            else:
                self._choose_option(session, option_id)
        elif action == "next_turn":
            if state.court.is_active:
                self._court_fast_forward(session)
            else:
                self._next_turn(session)
        elif action == "court_strategy":
            strategy_raw = payload.get("strategy")
            if not isinstance(strategy_raw, str):
                raise ValueError("court_strategy requires payload.strategy")
            self._court_strategy(session, strategy_raw)
        elif action == "court_statement":
            statement = payload.get("statement")
            strategy_hint = payload.get("strategy_hint")
            if not isinstance(statement, str) or not statement.strip():
                raise ValueError("court_statement requires payload.statement")
            self._court_statement(session, statement.strip(), strategy_hint if isinstance(strategy_hint, str) else None)
        elif action == "court_fast_forward":
            self._court_fast_forward(session)
        else:
            raise ValueError(f"Unsupported action: {action}")

        self._evaluate_outcome(session)
        self._trace_state_diff(session, action, before, state)
        self.repository.save(session)
        return state

    def _record_action(self, session, action: str, payload: dict[str, Any]) -> None:
        session.action_history.append({"action": action, "payload": copy.deepcopy(payload)})

    def _snapshot_state(self, state: GameState) -> dict[str, Any]:
        return state.model_dump(mode="python")

    def _trace(
        self,
        session,
        *,
        level: str,
        event: str,
        action: str | None = None,
        payload: dict[str, Any] | None = None,
        check_key: str | None = None,
        probability: float | None = None,
        roll: float | None = None,
        success: bool | None = None,
        node_id: str | None = None,
        extra: dict[str, Any] | None = None,
    ) -> None:
        state = session.state
        entry: dict[str, Any] = {
            "level": level,
            "event": event,
            "game_id": state.game_id,
            "turn": state.turn,
            "node": node_id or state.current_node_id,
            "action": action,
            "payload": copy.deepcopy(payload) if payload is not None else None,
            "check_key": check_key,
            "probability": probability,
            "roll": roll,
            "success": success,
        }
        if extra:
            entry.update(extra)

        session.diagnostics.append(entry)

        log_level = logging.INFO if level == "info" else logging.DEBUG
        logger.log(log_level, "engine_trace", extra={"trace": entry})

    def _trace_state_diff(self, session, action: str, before: dict[str, Any], state: GameState) -> None:
        after = state.model_dump(mode="python")
        diff: dict[str, dict[str, Any]] = {}
        for key, old_value in before.items():
            new_value = after.get(key)
            if old_value != new_value:
                diff[key] = {"before": old_value, "after": new_value}
        if diff:
            self._trace(
                session,
                level="debug",
                event="state_diff",
                action=action,
                payload=None,
                extra={"changes": diff},
            )

    def _normalize_action(self, action: str) -> str:
        if action in {"recover_choice", "court_choice", "defense_choice"}:
            return "choose_option"
        return action

    def _next_turn(self, session) -> None:
        state = session.state
        if should_trigger_court(state):
            begin_court_session(state, session.rng)
            state.phase = Phase.COURT
            return
        self._advance_battle_turn(session)

    def _court_strategy(self, session, strategy_raw: str) -> None:
        state = session.state
        if not state.court.is_active:
            raise ValueError("Court session is not active.")
        strategy = self._parse_strategy(strategy_raw)
        settled = resolve_court_strategy(state, strategy, session.rng)
        if settled and not state.court.is_active:
            self._restore_phase_after_court(state)
            self._advance_battle_turn(session)

    def _court_statement(self, session, statement: str, strategy_hint: str | None) -> None:
        state = session.state
        if not state.court.is_active:
            raise ValueError("Court session is not active.")

        strategy = self._strategy_from_statement(statement, strategy_hint)
        settled = resolve_court_strategy(state, strategy, session.rng, statement=statement)
        if settled and not state.court.is_active:
            self._restore_phase_after_court(state)
            self._advance_battle_turn(session)

    def _court_fast_forward(self, session) -> None:
        state = session.state
        if not state.court.is_active:
            raise ValueError("Court session is not active.")
        fast_forward_court_session(state, session.rng)
        if state.court.is_active:
            settle_court_session(state, force_timeout=True)
        if not state.court.is_active:
            self._restore_phase_after_court(state)
            self._advance_battle_turn(session)

    def _parse_strategy(self, strategy_raw: str) -> CourtStrategy:
        normalized = strategy_raw.strip().lower()
        aliases = {
            "rational": CourtStrategy.RATIONAL,
            "rational_argument": CourtStrategy.RATIONAL,
            "reason": CourtStrategy.RATIONAL,
            "authority": CourtStrategy.AUTHORITY,
            "authority_pressure": CourtStrategy.AUTHORITY,
            "pressure": CourtStrategy.AUTHORITY,
            "emotional": CourtStrategy.EMOTIONAL,
            "emotional_mobilization": CourtStrategy.EMOTIONAL,
            "emotion": CourtStrategy.EMOTIONAL,
        }
        parsed = aliases.get(normalized)
        if parsed is None:
            raise ValueError("Unknown court strategy. Use rational_argument / authority_pressure / emotional_mobilization")
        return parsed

    def _legacy_option_to_strategy(self, option_id: str) -> str:
        mapping = {
            "appease_court": "rational_argument",
            "suppress_faction": "authority_pressure",
            "ask_budget": "emotional_mobilization",
        }
        return mapping.get(option_id, "rational_argument")

    def _strategy_from_statement(self, statement: str, strategy_hint: str | None) -> CourtStrategy:
        if strategy_hint:
            try:
                return self._parse_strategy(strategy_hint)
            except ValueError:
                pass

        text = statement.lower()
        rational_keywords = [
            "evidence",
            "feasible",
            "supply",
            "logistics",
            "budget",
            "risk",
            "numbers",
            "data",
            "\u7cae",
            "\u8865\u7ed9",
            "\u53ef\u884c",
            "\u8bc1\u636e",
            "\u5236\u5ea6",
            "\u98ce\u9669",
        ]
        authority_keywords = [
            "edict",
            "command",
            "discipline",
            "obey",
            "accountability",
            "authority",
            "order",
            "\u519b\u4ee4",
            "\u547d\u4ee4",
            "\u538b\u5236",
            "\u95ee\u8d23",
            "\u670d\u4ece",
        ]
        emotional_keywords = [
            "morale",
            "troops",
            "people",
            "hope",
            "loyalty",
            "momentum",
            "spirit",
            "\u58eb\u6c14",
            "\u519b\u5fc3",
            "\u6c11\u5fc3",
            "\u5c06\u58eb",
            "\u4e58\u80dc",
        ]

        rational_score = sum(1 for token in rational_keywords if token in text)
        authority_score = sum(1 for token in authority_keywords if token in text)
        emotional_score = sum(1 for token in emotional_keywords if token in text)

        if authority_score > rational_score and authority_score >= emotional_score:
            return CourtStrategy.AUTHORITY
        if emotional_score > rational_score and emotional_score > authority_score:
            return CourtStrategy.EMOTIONAL
        return CourtStrategy.RATIONAL

    def _restore_phase_after_court(self, state: GameState) -> None:
        try:
            state.phase = Phase(state.court.return_phase)
        except ValueError:
            state.phase = Phase.CAMPAIGN

    def _advance_battle_turn(self, session) -> None:
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

        court_turn_delta = apply_battle_turn_modifier(state)
        doom_gain += int(court_turn_delta["doom_delta"])
        doom_gain = max(0, doom_gain)

        state.doom += doom_gain
        add_log(state, f"Turn {state.turn}: battle advances, doom +{doom_gain}.")
        if int(court_turn_delta["food_delta"]) or int(court_turn_delta["morale_delta"]):
            add_log(
                state,
                (
                    "Court edict applied: "
                    f"food {int(court_turn_delta['food_delta']):+d} / "
                    f"morale {int(court_turn_delta['morale_delta']):+d}."
                ),
            )
        if bool(court_turn_delta["expired"]):
            add_log(state, f"Court edict ended: {court_turn_delta['title']}.")

        if state.chapter == 4 and not state.flags.get("post_zhuge_era", False):
            state.health -= 1
            add_log(state, "Wuzhang campaign drags on; Zhuge Liang health worsens.")
            self._trigger_post_zhuge_if_needed(state)

        if state.phase in {Phase.CAMPAIGN, Phase.FINAL} and state.active_route_id:
            state.route_progress = min(1.0, state.route_progress + balance.ROUTE_PROGRESS_STEP_PER_TURN)

        if state.doom >= balance.DOOM_THRESHOLD and not state.flags.get("doom_chain_active", False):
            state.flags["doom_chain_active"] = True
            add_log(state, "State-collapse crisis: Wei launches total offensive.")
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
        self._trace(
            session,
            level="info",
            event="transition",
            action="transition",
            payload={"next_node_id": next_node_id},
            node_id=next_node_id,
        )
        self._set_node(session.state, next_node_id)
        self._maybe_start_court_on_phase_entry(session)
        self._resolve_checks(session)

    def _maybe_start_court_on_phase_entry(self, session) -> None:
        state = session.state
        if state.phase == Phase.COURT and not state.court.is_active:
            begin_court_session(state, session.rng)

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
            roll = None
            probability = None
            if check_key:
                success, roll, probability = roll_check(check_key, state, session.rng)
                add_log(state, f"检定[{check_key}]：{roll:.2f} / {probability:.2f}。")
            else:
                success = True

            self._trace(
                session,
                level="info",
                event="check_resolved",
                action="resolve_check",
                payload=None,
                check_key=check_key or None,
                probability=probability,
                roll=roll,
                success=success,
                node_id=node.id,
            )

            if success:
                apply_effects(state, node.success_effects)
                state.court.momentum = min(4, state.court.momentum + 1)
                next_node = node.success_next
            else:
                apply_effects(state, node.fail_effects)
                state.court.momentum = max(-4, state.court.momentum - 1)
                next_node = node.fail_next

            court_check_delta = apply_check_outcome_modifier(state, success=success)
            if any(court_check_delta.values()):
                add_log(
                    state,
                    (
                        "朝议军令检定修正："
                        f"粮草 {court_check_delta['food']:+d} / "
                        f"士气 {court_check_delta['morale']:+d} / "
                        f"Doom {court_check_delta['doom']:+d}。"
                    ),
                )

            self._trigger_post_zhuge_if_needed(state)

            if not next_node:
                raise ValueError(f"Check node {node.id} missing next target")

            next_location = self.graph.get(next_node).meta.location
            result_text = "SUCCESS" if success else "FAIL"
            self._add_fx_token(state, f"FX_CHECK|node={node.id}|result={result_text}|loc={next_location}")

            self._set_node(state, next_node)
            self._maybe_start_court_on_phase_entry(session)
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

    def _ensure_court_session(self, session) -> bool:
        state = session.state
        if state.outcome != Outcome.ONGOING:
            return False
        if state.phase == Phase.COURT and not state.court.is_active:
            begin_court_session(state, session.rng)
            return True
        return False
