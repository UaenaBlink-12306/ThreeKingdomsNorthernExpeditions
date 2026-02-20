#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Iterable

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

try:
    from jsonschema import Draft202012Validator
except ModuleNotFoundError as exc:  # pragma: no cover - runtime guard
    raise SystemExit(
        "缺少依赖 jsonschema，请先执行: python -m pip install -r backend/requirements.txt"
    ) from exc

from app.engine.graph import EventGraph, validate_graph
from app.models.event_graph import GraphModel

SCHEMA_PATH = BACKEND_ROOT / "schema" / "events.schema.json"


def _format_path(parts: Iterable[Any]) -> str:
    text = "$"
    for part in parts:
        if isinstance(part, int):
            text += f"[{part}]"
        else:
            text += f".{part}"
    return text


def _extract_node_id(data: dict[str, Any], path: list[Any]) -> str | None:
    if len(path) >= 2 and path[0] == "nodes" and isinstance(path[1], int):
        idx = path[1]
        nodes = data.get("nodes")
        if isinstance(nodes, list) and 0 <= idx < len(nodes) and isinstance(nodes[idx], dict):
            return nodes[idx].get("id")
    return None


def _suggestion(error_message: str, path: list[Any]) -> str:
    path_text = _format_path(path)
    last = path[-1] if path else None

    if "is a required property" in error_message:
        missing = error_message.split("'", maxsplit=2)[1]
        return f"补充缺失字段 `{missing}`（位置：{path_text}）。"
    if "Additional properties are not allowed" in error_message:
        return f"删除未定义字段，或在 schema 中声明它（位置：{path_text}）。"
    if "is not of type" in error_message:
        return f"修正字段类型与 schema 保持一致（位置：{path_text}）。"
    if "is too short" in error_message and isinstance(last, str) and last in {"id", "label", "text", "next", "check", "outcome"}:
        return f"将该字段改为非空字符串（位置：{path_text}）。"
    if "is too short" in error_message or "should be non-empty" in error_message:
        return f"确保数组至少有一个元素（位置：{path_text}）。"

    if last == "route_id":
        return "route_id 需填写已定义 route，且应与 meta.location 匹配。"
    if last in {"success_next", "fail_next", "next"}:
        return "跳转目标必须是存在的节点 id。"
    if last == "location":
        return "location 必须是地图中的合法地点 id。"

    return "按报错路径检查字段命名、类型与必填项。"


def _validate_schema(data_path: Path, data: dict[str, Any]) -> None:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(data), key=lambda e: list(e.absolute_path))

    if not errors:
        print("✅ Step 1/2 JSON Schema 校验通过")
        return

    print(f"❌ Step 1/2 JSON Schema 校验失败，共 {len(errors)} 项：")
    for index, err in enumerate(errors, start=1):
        path = list(err.absolute_path)
        node_id = _extract_node_id(data, path)
        node_text = f"[node={node_id}] " if node_id else ""
        print(
            f"  {index}. {node_text}path={_format_path(path)}\n"
            f"     error: {err.message}\n"
            f"     hint: {_suggestion(err.message, path)}"
        )
    raise SystemExit(1)


def _validate_semantics(data_path: Path, data: dict[str, Any]) -> None:
    try:
        model = GraphModel.model_validate(data)
        graph = EventGraph(model)
        validate_graph(graph)
    except Exception as exc:  # noqa: BLE001
        print("❌ Step 2/2 语义校验失败：")
        print(f"  file: {data_path}")
        print(f"  error: {exc}")
        print(
            "  hint: 检查节点可达性、buffer 区进出边、route 与 location 是否一致，"
            "以及所有 next/success_next/fail_next 是否指向存在节点。"
        )
        raise SystemExit(1) from exc

    print("✅ Step 2/2 validate_graph 语义校验通过")


def main() -> int:
    if len(sys.argv) != 2:
        print("用法: python backend/scripts/validate_events.py backend/app/data/events.json")
        return 2

    data_path = Path(sys.argv[1]).resolve()
    if not data_path.exists():
        print(f"文件不存在: {data_path}")
        return 2

    try:
        data = json.loads(data_path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as exc:
        print(f"JSON 解析失败: {exc}")
        return 1

    if not isinstance(data, dict):
        print("events 根节点必须是对象")
        return 1

    _validate_schema(data_path, data)
    _validate_semantics(data_path, data)
    print("🎉 事件内容校验全部通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
