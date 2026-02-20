from __future__ import annotations

from app.engine.graph import EventGraph, validate_graph
from app.models.event_graph import GraphModel, NodeModel, NodeType


def _meta(location: str = "hanzhong", route_id: str | None = None) -> dict:
    return {
        "location": location,
        "gain_control": [],
        "lose_control": [],
        "route_id": route_id,
    }


def test_validate_graph_passes_for_main_graph() -> None:
    from pathlib import Path

    from app.engine.graph import load_graph

    graph = load_graph(Path(__file__).resolve().parents[1] / "app" / "data" / "events.json")
    validate_graph(graph)


def test_validate_graph_rejects_node_without_outgoing_edge() -> None:
    model = GraphModel(
        start_node="start",
        nodes=[
            NodeModel(id="start", node_type=NodeType.CHOICE, text="bad", meta=_meta(), options=[]),
            NodeModel(id="WIN", node_type=NodeType.TERMINAL, text="win", meta=_meta("changan"), outcome="WIN"),
            NodeModel(
                id="DEFEAT_SHU",
                node_type=NodeType.TERMINAL,
                text="lose",
                meta=_meta("chengdu"),
                outcome="DEFEAT_SHU",
            ),
            NodeModel(
                id="recover_dummy",
                node_type=NodeType.CHOICE,
                text="recover",
                phase="recover",
                meta=_meta("hanzhong"),
                options=[{"id": "r", "label": "r", "next": "WIN"}],
            ),
            NodeModel(
                id="court_dummy",
                node_type=NodeType.CHOICE,
                text="court",
                phase="court",
                meta=_meta("chengdu"),
                options=[{"id": "c", "label": "c", "next": "WIN"}],
            ),
            NodeModel(
                id="defense_dummy",
                node_type=NodeType.CHOICE,
                text="defense",
                phase="defense",
                meta=_meta("hanzhong"),
                options=[{"id": "d", "label": "d", "next": "WIN"}],
            ),
        ],
    )
    graph = EventGraph(model)

    try:
        validate_graph(graph)
        raise AssertionError("validate_graph should fail")
    except ValueError as exc:
        assert "no outgoing edge" in str(exc)


def test_validate_graph_rejects_unknown_meta_location() -> None:
    model = GraphModel(
        start_node="start",
        nodes=[
            NodeModel(
                id="start",
                node_type=NodeType.CHOICE,
                text="ok",
                meta=_meta("unknown_place"),
                options=[{"id": "to_win", "label": "to win", "next": "WIN"}],
            ),
            NodeModel(id="WIN", node_type=NodeType.TERMINAL, text="win", meta=_meta("changan"), outcome="WIN"),
            NodeModel(
                id="DEFEAT_SHU",
                node_type=NodeType.TERMINAL,
                text="lose",
                meta=_meta("chengdu"),
                outcome="DEFEAT_SHU",
            ),
            NodeModel(
                id="recover_dummy",
                node_type=NodeType.CHOICE,
                text="recover",
                phase="recover",
                meta=_meta("hanzhong"),
                options=[{"id": "r", "label": "r", "next": "WIN"}],
            ),
            NodeModel(
                id="court_dummy",
                node_type=NodeType.CHOICE,
                text="court",
                phase="court",
                meta=_meta("chengdu"),
                options=[{"id": "c", "label": "c", "next": "WIN"}],
            ),
            NodeModel(
                id="defense_dummy",
                node_type=NodeType.CHOICE,
                text="defense",
                phase="defense",
                meta=_meta("hanzhong"),
                options=[{"id": "d", "label": "d", "next": "WIN"}],
            ),
        ],
    )
    graph = EventGraph(model)

    try:
        validate_graph(graph)
        raise AssertionError("validate_graph should fail for bad location")
    except ValueError as exc:
        assert "meta.location" in str(exc)


def test_validate_graph_rejects_route_location_mismatch() -> None:
    model = GraphModel(
        start_node="start",
        nodes=[
            NodeModel(
                id="start",
                node_type=NodeType.CHOICE,
                text="march",
                meta=_meta("jieting", route_id="hanzhong_to_jieting"),
                options=[{"id": "to_win", "label": "to win", "next": "WIN"}],
            ),
            NodeModel(id="WIN", node_type=NodeType.TERMINAL, text="win", meta=_meta("changan"), outcome="WIN"),
            NodeModel(
                id="DEFEAT_SHU",
                node_type=NodeType.TERMINAL,
                text="lose",
                meta=_meta("chengdu"),
                outcome="DEFEAT_SHU",
            ),
            NodeModel(
                id="recover_dummy",
                node_type=NodeType.CHOICE,
                text="recover",
                phase="recover",
                meta=_meta("hanzhong"),
                options=[{"id": "r", "label": "r", "next": "WIN"}],
            ),
            NodeModel(
                id="court_dummy",
                node_type=NodeType.CHOICE,
                text="court",
                phase="court",
                meta=_meta("chengdu"),
                options=[{"id": "c", "label": "c", "next": "WIN"}],
            ),
            NodeModel(
                id="defense_dummy",
                node_type=NodeType.CHOICE,
                text="defense",
                phase="defense",
                meta=_meta("hanzhong"),
                options=[{"id": "d", "label": "d", "next": "WIN"}],
            ),
        ],
    )
    graph = EventGraph(model)

    try:
        validate_graph(graph)
        raise AssertionError("validate_graph should fail for route location mismatch")
    except ValueError as exc:
        assert "route location mismatch" in str(exc)


def test_validate_graph_rejects_unknown_route_id() -> None:
    model = GraphModel(
        start_node="start",
        nodes=[
            NodeModel(
                id="start",
                node_type=NodeType.CHOICE,
                text="march",
                meta=_meta("hanzhong", route_id="bad_route"),
                options=[{"id": "to_win", "label": "to win", "next": "WIN"}],
            ),
            NodeModel(id="WIN", node_type=NodeType.TERMINAL, text="win", meta=_meta("changan"), outcome="WIN"),
            NodeModel(
                id="DEFEAT_SHU",
                node_type=NodeType.TERMINAL,
                text="lose",
                meta=_meta("chengdu"),
                outcome="DEFEAT_SHU",
            ),
            NodeModel(
                id="recover_dummy",
                node_type=NodeType.CHOICE,
                text="recover",
                phase="recover",
                meta=_meta("hanzhong"),
                options=[{"id": "r", "label": "r", "next": "WIN"}],
            ),
            NodeModel(
                id="court_dummy",
                node_type=NodeType.CHOICE,
                text="court",
                phase="court",
                meta=_meta("chengdu"),
                options=[{"id": "c", "label": "c", "next": "WIN"}],
            ),
            NodeModel(
                id="defense_dummy",
                node_type=NodeType.CHOICE,
                text="defense",
                phase="defense",
                meta=_meta("hanzhong"),
                options=[{"id": "d", "label": "d", "next": "WIN"}],
            ),
        ],
    )
    graph = EventGraph(model)

    try:
        validate_graph(graph)
        raise AssertionError("validate_graph should fail for unknown route id")
    except ValueError as exc:
        assert "meta.route_id" in str(exc)


def test_validate_graph_rejects_invalid_catalog_endpoints(monkeypatch) -> None:
    from app.engine import graph as graph_module

    model = GraphModel(
        start_node="start",
        nodes=[
            NodeModel(
                id="start",
                node_type=NodeType.CHOICE,
                text="ok",
                meta=_meta("hanzhong"),
                options=[{"id": "to_win", "label": "to win", "next": "WIN"}],
            ),
            NodeModel(id="WIN", node_type=NodeType.TERMINAL, text="win", meta=_meta("changan"), outcome="WIN"),
            NodeModel(
                id="DEFEAT_SHU",
                node_type=NodeType.TERMINAL,
                text="lose",
                meta=_meta("chengdu"),
                outcome="DEFEAT_SHU",
            ),
            NodeModel(
                id="recover_dummy",
                node_type=NodeType.CHOICE,
                text="recover",
                phase="recover",
                meta=_meta("hanzhong"),
                options=[{"id": "r", "label": "r", "next": "WIN"}],
            ),
            NodeModel(
                id="court_dummy",
                node_type=NodeType.CHOICE,
                text="court",
                phase="court",
                meta=_meta("chengdu"),
                options=[{"id": "c", "label": "c", "next": "WIN"}],
            ),
            NodeModel(
                id="defense_dummy",
                node_type=NodeType.CHOICE,
                text="defense",
                phase="defense",
                meta=_meta("hanzhong"),
                options=[{"id": "d", "label": "d", "next": "WIN"}],
            ),
        ],
    )
    graph = EventGraph(model)

    bad_catalog = dict(graph_module.ROUTE_ENDPOINTS)
    bad_catalog["hanzhong_to_jieting"] = ("hanzhong", "bad_place")
    monkeypatch.setattr(graph_module, "ROUTE_ENDPOINTS", bad_catalog)

    try:
        validate_graph(graph)
        raise AssertionError("validate_graph should fail for invalid catalog endpoint")
    except ValueError as exc:
        assert "Invalid route endpoints" in str(exc)
