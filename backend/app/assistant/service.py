from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import httpx

from app.models.chat import ChatMode, ChatRequest, ChatResponse
from app.models.state import GameState


class DeepSeekConfigError(RuntimeError):
    pass


class GameAssistantService:
    def __init__(self) -> None:
        self.env_file = Path(__file__).resolve().parents[2] / ".env"
        self.api_key = ""
        self.base_url = "https://api.deepseek.com"
        self.model = "deepseek-chat"
        self.max_tokens = 500
        self.timeout_seconds = 30.0
        self._refresh_settings()

    def reply(self, request: ChatRequest) -> ChatResponse:
        self._refresh_settings()
        if not self.api_key:
            raise DeepSeekConfigError(
                "未检测到 DEEPSEEK_API_KEY。请在 backend/.env 中填写后重试。"
            )

        messages = self._build_messages(request)
        content, model = self._call_deepseek(messages, temperature=self._temperature_for_mode(request.mode))
        return ChatResponse(mode=request.mode, content=content, model=model)

    def _refresh_settings(self) -> None:
        file_values = self._read_env_file_values(self.env_file)
        self.api_key = self._pick_setting("DEEPSEEK_API_KEY", file_values, default="").strip()
        self.base_url = self._pick_setting("DEEPSEEK_BASE_URL", file_values, default="https://api.deepseek.com").rstrip("/")
        self.model = self._pick_setting("DEEPSEEK_MODEL", file_values, default="deepseek-chat").strip() or "deepseek-chat"
        self.max_tokens = self._pick_int_setting("DEEPSEEK_MAX_TOKENS", file_values, default=500)
        self.timeout_seconds = self._pick_float_setting("DEEPSEEK_TIMEOUT_SECONDS", file_values, default=30.0)

    def _pick_setting(self, key: str, file_values: dict[str, str], *, default: str) -> str:
        value = os.getenv(key)
        if value is not None and value.strip():
            return value.strip()
        file_value = file_values.get(key)
        if file_value is not None and file_value.strip():
            return file_value.strip()
        return default

    def _pick_int_setting(self, key: str, file_values: dict[str, str], *, default: int) -> int:
        raw = self._pick_setting(key, file_values, default=str(default))
        try:
            return int(raw)
        except (TypeError, ValueError):
            return default

    def _pick_float_setting(self, key: str, file_values: dict[str, str], *, default: float) -> float:
        raw = self._pick_setting(key, file_values, default=str(default))
        try:
            return float(raw)
        except (TypeError, ValueError):
            return default

    def _read_env_file_values(self, path: Path) -> dict[str, str]:
        values: dict[str, str] = {}
        if not path.exists():
            return values

        text = path.read_text(encoding="utf-8", errors="ignore")
        for line in text.splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            key = key.strip()
            value = value.strip()
            if len(value) >= 2 and ((value[0] == value[-1] == '"') or (value[0] == value[-1] == "'")):
                value = value[1:-1]
            if key:
                values[key] = value
        return values

    def _temperature_for_mode(self, mode: ChatMode) -> float:
        if mode == ChatMode.ROLEPLAY:
            return 0.85
        if mode == ChatMode.SCENARIO_MENTOR:
            return 0.45
        return 0.35

    def _build_messages(self, request: ChatRequest) -> list[dict[str, str]]:
        return [
            {"role": "system", "content": self._system_prompt(request.mode)},
            {
                "role": "user",
                "content": self._user_prompt(
                    request.mode,
                    state=request.game_state,
                    previous_state=request.previous_state,
                    delta_summary=request.delta_summary,
                    delta_log=request.delta_log,
                    user_message=request.user_message,
                    roleplay_character=request.roleplay_character,
                ),
            },
        ]

    def _system_prompt(self, mode: ChatMode) -> str:
        if mode == ChatMode.PRETURN_ADVISOR:
            return (
                "你是三国北伐回合制游戏的战略参谋。"
                "只能基于提供的状态与选项分析，禁止虚构隐藏规则、额外事件或后台概率。"
                "请使用简洁中文 Markdown，包含三个小节："
                "1）取舍分析 2）推荐行动 3）风险提醒。"
            )

        if mode == ChatMode.AFTERTURN_INTERPRETER:
            return (
                "你是回合复盘解说员。"
                "只解释本回合已发生变化，不得虚构机制。"
                "请使用简洁中文 Markdown，包含三个小节："
                "1）发生了什么 2）为什么重要 3）下一步建议。"
            )

        if mode == ChatMode.SCENARIO_MENTOR:
            return (
                "你是新手导师。"
                "请用清晰、可执行的中文回答玩家问题，且仅依据给定上下文。"
                "如果信息不足，必须明确说明，不要猜测。"
            )

        return (
            "你将扮演三国时代谋臣，与玩家进行角色化对话。"
            "保持角色语气，但建议必须基于当前游戏状态。"
            "禁止声称你改变了游戏机制或结果。"
        )

    def _user_prompt(
        self,
        mode: ChatMode,
        *,
        state: GameState,
        previous_state: GameState | None,
        delta_summary: list[str],
        delta_log: list[str],
        user_message: str | None,
        roleplay_character: str | None,
    ) -> str:
        context_parts = [
            "当前游戏状态：",
            self._state_block(state),
            "",
            "目标快照：",
            self._objective_block(state),
        ]

        if state.current_event.options:
            context_parts.extend(["", "当前可选行动：", self._options_block(state)])

        if previous_state is not None:
            context_parts.extend(["", "上一状态：", self._state_block(previous_state)])

        if delta_summary:
            context_parts.extend(["", "状态增量摘要：", self._list_block(delta_summary, max_items=10)])
        if delta_log:
            context_parts.extend(["", "日志增量：", self._list_block(delta_log, max_items=14)])

        if mode == ChatMode.PRETURN_ADVISOR:
            task = "任务：针对当前决策点给出回合前建议，优先兼顾主目标推进与崩盘风险控制。"
        elif mode == ChatMode.AFTERTURN_INTERPRETER:
            task = "任务：解释本回合变化，并给出下一步最可执行建议。"
        elif mode == ChatMode.SCENARIO_MENTOR:
            message = (user_message or "").strip() or "请解释核心属性分别代表什么，以及如何提高生存率。"
            task = f"玩家问题：{message}"
        else:
            character = (roleplay_character or "前线统帅").strip() or "前线统帅"
            message = (user_message or "").strip() or "请为当前局势给我谏言。"
            task = f"角色：{character}\n玩家发言：{message}"

        return "\n".join(context_parts + ["", task])

    def _state_block(self, state: GameState) -> str:
        return "\n".join(
            [
                f"- game_id: {state.game_id}",
                f"- 回合/章节/阶段: {state.turn}/{state.chapter}/{state.phase}",
                f"- 节点/位置: {state.current_node_id}/{state.current_location}",
                f"- 结局状态: {state.outcome}",
                (
                    "- 资源: "
                    f"粮草={state.food}, 士气={state.morale}, 政争={state.politics}, "
                    f"魏压={state.wei_pressure}, Doom={state.doom}, 健康={state.health}"
                ),
                (
                    "- 进度: "
                    f"关中回合={state.guanzhong_turns}, 陇右回合={state.longyou_turns}, "
                    f"陇右崩盘={state.longyou_collapsed}"
                ),
                f"- 控制地: {', '.join(state.controlled_locations) if state.controlled_locations else '无'}",
            ]
        )

    def _objective_block(self, state: GameState) -> str:
        longyou_status = "崩盘" if state.longyou_collapsed else "稳定"
        return (
            f"- 主目标：关中稳固 3 回合（当前 {state.guanzhong_turns}/3）\n"
            f"- 陇右状态：{longyou_status}\n"
            f"- Doom 压力：{state.doom}/12"
        )

    def _options_block(self, state: GameState) -> str:
        lines = []
        for option in state.current_event.options:
            status = "不可选" if option.disabled else "可选"
            lines.append(f"- {option.id}: {option.label} [{status}]")
        return "\n".join(lines)

    def _list_block(self, entries: list[str], *, max_items: int) -> str:
        lines = []
        for entry in entries[-max_items:]:
            compact = " ".join(entry.split())
            lines.append(f"- {compact}")
        return "\n".join(lines) if lines else "- 无"

    def _call_deepseek(self, messages: list[dict[str, str]], *, temperature: float) -> tuple[str, str]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": self.max_tokens,
        }
        url = f"{self.base_url}/chat/completions"

        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                response = client.post(url, headers=headers, json=payload)
        except httpx.HTTPError as exc:
            raise RuntimeError(f"DeepSeek 请求失败：{exc}") from exc

        if response.status_code >= 400:
            detail = self._extract_error_detail(response)
            raise RuntimeError(f"DeepSeek 接口错误（{response.status_code}）：{detail}")

        body = response.json()
        choices = body.get("choices")
        if not isinstance(choices, list) or not choices:
            raise RuntimeError("DeepSeek 返回缺少 choices 字段。")

        first = choices[0]
        if not isinstance(first, dict):
            raise RuntimeError("DeepSeek 返回格式异常。")

        message = first.get("message")
        if not isinstance(message, dict):
            raise RuntimeError("DeepSeek 返回缺少 message 字段。")

        content = message.get("content")
        if not isinstance(content, str) or not content.strip():
            raise RuntimeError("DeepSeek 返回内容为空。")

        model = body.get("model")
        model_name = model if isinstance(model, str) and model else self.model
        return content.strip(), model_name

    def _extract_error_detail(self, response: httpx.Response) -> str:
        try:
            payload = response.json()
        except ValueError:
            text = response.text.strip()
            return text or "未知错误"

        if isinstance(payload, dict):
            error = payload.get("error")
            if isinstance(error, dict):
                message = error.get("message")
                if isinstance(message, str) and message.strip():
                    return message.strip()
            message = payload.get("message")
            if isinstance(message, str) and message.strip():
                return message.strip()

        return "未知错误"
