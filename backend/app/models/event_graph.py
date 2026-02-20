from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class NodeType(str, Enum):
    CHOICE = "choice"
    CHECK = "check"
    TERMINAL = "terminal"


class OptionModel(BaseModel):
    id: str
    label: str
    next: str
    effects: dict[str, Any] = Field(default_factory=dict)
    condition: str | None = None


class NodeMeta(BaseModel):
    location: str
    gain_control: list[str] = Field(default_factory=list)
    lose_control: list[str] = Field(default_factory=list)
    route_id: str | None = None


class NodeModel(BaseModel):
    id: str
    node_type: NodeType
    text: str
    meta: NodeMeta
    chapter: int | None = None
    phase: str | None = None
    options: list[OptionModel] = Field(default_factory=list)
    check: str | None = None
    success_next: str | None = None
    fail_next: str | None = None
    success_effects: dict[str, Any] = Field(default_factory=dict)
    fail_effects: dict[str, Any] = Field(default_factory=dict)
    outcome: str | None = None


class GraphModel(BaseModel):
    start_node: str
    nodes: list[NodeModel]
