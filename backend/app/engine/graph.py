from __future__ import annotations

import json
from pathlib import Path

from app.engine.map_catalog import KNOWN_PLACE_IDS, KNOWN_ROUTE_IDS, ROUTE_ENDPOINTS
from app.models.event_graph import GraphModel, NodeModel, NodeType

ALLOWED_TERMINALS = {"WIN", "DEFEAT_SHU"}
BUFFER_PHASES = {"recover", "court", "defense"}


class EventGraph:
    def __init__(self, model: GraphModel) -> None:
        self.start_node = model.start_node
        self.nodes: dict[str, NodeModel] = {n.id: n for n in model.nodes}

    def get(self, node_id: str) -> NodeModel:
        node = self.nodes.get(node_id)
        if node is None:
            raise KeyError(f"Unknown node: {node_id}")
        return node


def load_graph(path: Path) -> EventGraph:
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    model = GraphModel.model_validate(data)
    return EventGraph(model)


def node_edges(node: NodeModel) -> list[str]:
    if node.node_type == NodeType.CHOICE:
        return [opt.next for opt in node.options]
    if node.node_type == NodeType.CHECK:
        edges: list[str] = []
        if node.success_next:
            edges.append(node.success_next)
        if node.fail_next:
            edges.append(node.fail_next)
        return edges
    return []


def validate_graph(graph: EventGraph) -> None:
    if graph.start_node not in graph.nodes:
        raise ValueError("start_node does not exist")

    terminal_nodes: set[str] = set()

    for route_id, endpoints in ROUTE_ENDPOINTS.items():
        if route_id not in KNOWN_ROUTE_IDS:
            raise ValueError(f"Unknown route in ROUTE_ENDPOINTS: {route_id}")
        from_place, to_place = endpoints
        if from_place not in KNOWN_PLACE_IDS or to_place not in KNOWN_PLACE_IDS:
            raise ValueError(f"Invalid route endpoints for {route_id}: {from_place}->{to_place}")

    for node in graph.nodes.values():
        edges = node_edges(node)
        if node.node_type != NodeType.TERMINAL and len(edges) < 1:
            raise ValueError(f"Node {node.id} has no outgoing edge")

        if node.node_type == NodeType.TERMINAL:
            terminal_nodes.add(node.id)
            if node.id not in ALLOWED_TERMINALS:
                raise ValueError(f"Illegal terminal node: {node.id}")

        if node.meta.location not in KNOWN_PLACE_IDS:
            raise ValueError(f"Node {node.id} has invalid meta.location={node.meta.location}")

        for place_id in node.meta.gain_control:
            if place_id not in KNOWN_PLACE_IDS:
                raise ValueError(f"Node {node.id} has invalid meta.gain_control={place_id}")

        for place_id in node.meta.lose_control:
            if place_id not in KNOWN_PLACE_IDS:
                raise ValueError(f"Node {node.id} has invalid meta.lose_control={place_id}")

        if node.meta.route_id is not None:
            if node.meta.route_id not in KNOWN_ROUTE_IDS:
                raise ValueError(f"Node {node.id} has invalid meta.route_id={node.meta.route_id}")
            from_place, _ = ROUTE_ENDPOINTS[node.meta.route_id]
            if node.meta.location != from_place:
                raise ValueError(
                    f"Node {node.id} route location mismatch: {node.meta.location} != {from_place}"
                )

        for nxt in edges:
            if nxt not in graph.nodes:
                raise ValueError(f"Node {node.id} points to missing node {nxt}")

    if not ALLOWED_TERMINALS.issubset(set(graph.nodes)):
        raise ValueError("WIN and DEFEAT_SHU terminal nodes are required")

    adjacency = {node_id: node_edges(node) for node_id, node in graph.nodes.items()}

    reachable: set[str] = set()
    stack = [graph.start_node]
    while stack:
        cur = stack.pop()
        if cur in reachable:
            continue
        reachable.add(cur)
        stack.extend(adjacency[cur])

    if "WIN" not in reachable and "DEFEAT_SHU" not in reachable:
        raise ValueError("No terminal path from start node")

    for phase in BUFFER_PHASES:
        zone_nodes = {n.id for n in graph.nodes.values() if n.phase == phase}
        if not zone_nodes:
            raise ValueError(f"Missing buffer zone node for phase={phase}")

        has_entry = False
        has_exit = False
        for src_id, edges in adjacency.items():
            src_phase = graph.nodes[src_id].phase
            for dst_id in edges:
                dst_phase = graph.nodes[dst_id].phase
                if dst_id in zone_nodes and src_phase != phase:
                    has_entry = True
                if src_id in zone_nodes and dst_phase != phase:
                    has_exit = True
        if not has_entry or not has_exit:
            raise ValueError(f"Buffer zone {phase} lacks entry or exit")
