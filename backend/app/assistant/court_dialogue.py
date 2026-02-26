from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from typing import Any

import httpx

from app.models.court import CourtNpcState, CourtStrategy
from app.models.state import GameState


class CourtDialogueService:
    """Generate short in-character court lines with DeepSeek and safe fallback."""

    def __init__(self) -> None:
        self.env_file = Path(__file__).resolve().parents[2] / ".env"
        self.enabled = False
        self.api_key = ""
        self.base_url = "https://api.deepseek.com"
        self.model = "deepseek-chat"
        self.max_tokens = 110
        self.temperature = 0.9
        self.support_judge_enabled = False
        self.support_judge_max_tokens = 120
        self.support_judge_temperature = 0.35
        self.timeout_seconds = 1.2
        self.failure_cooldown_seconds = 12.0
        self.settings_refresh_interval_seconds = 3.0
        self._disabled_until = 0.0
        self._judge_disabled_until = 0.0
        self._last_settings_refresh_monotonic = 0.0
        self._http_client: httpx.Client | None = None
        self._http_client_signature = ""
        self._refresh_settings(force=True)

    def generate_line(
        self,
        *,
        state: GameState,
        npc: CourtNpcState,
        fallback_text: str,
        strategy: CourtStrategy | None = None,
        scene: str = "debate",
        player_statement: str | None = None,
    ) -> str:
        fallback = self._sanitize_line(fallback_text, npc.display_name)
        if not fallback:
            fallback = "臣请照既定军议执行。"

        # Keep tests deterministic and fast.
        if os.getenv("PYTEST_CURRENT_TEST"):
            return fallback

        self._refresh_settings()
        if not self.enabled or not self.api_key:
            return fallback

        now = time.monotonic()
        if now < self._disabled_until:
            return fallback

        messages = self._build_messages(
            state=state,
            npc=npc,
            strategy=strategy,
            scene=scene,
            fallback=fallback,
            player_statement=player_statement,
        )

        try:
            content = self._call_deepseek(messages)
        except RuntimeError:
            self._disabled_until = now + self.failure_cooldown_seconds
            return fallback

        candidate = self._sanitize_line(content, npc.display_name)
        if not candidate:
            self._disabled_until = now + self.failure_cooldown_seconds
            return fallback

        self._disabled_until = 0.0
        return candidate

    def judge_support_shift(
        self,
        *,
        state: GameState,
        strategy: CourtStrategy,
        statement: str,
        reaction_lines: list[str],
        heuristic_shift: int,
    ) -> int:
        fallback = self._clamp_support_shift(heuristic_shift)

        # Keep tests deterministic and fast.
        if os.getenv("PYTEST_CURRENT_TEST"):
            return fallback

        self._refresh_settings()
        if not self.enabled or not self.api_key or not self.support_judge_enabled:
            return fallback

        now = time.monotonic()
        if now < self._judge_disabled_until:
            return fallback

        messages = self._build_support_judge_messages(
            state=state,
            strategy=strategy,
            statement=statement,
            reaction_lines=reaction_lines,
            heuristic_shift=fallback,
        )

        try:
            content = self._call_deepseek(
                messages,
                temperature=self.support_judge_temperature,
                max_tokens=self.support_judge_max_tokens,
            )
        except RuntimeError:
            self._judge_disabled_until = now + self.failure_cooldown_seconds
            return fallback

        parsed = self._parse_support_shift(content)
        if parsed is None:
            self._judge_disabled_until = now + self.failure_cooldown_seconds
            return fallback

        self._judge_disabled_until = 0.0
        return self._clamp_support_shift(parsed)

    def _refresh_settings(self, *, force: bool = False) -> None:
        now = time.monotonic()
        if not force and (now - self._last_settings_refresh_monotonic) < self.settings_refresh_interval_seconds:
            return

        values = self._read_env_file_values(self.env_file)

        self.enabled = self._pick_bool_setting("DEEPSEEK_COURT_ENABLED", values, default=True)
        self.api_key = self._pick_setting("DEEPSEEK_API_KEY", values, default="").strip()
        self.base_url = (
            self._pick_setting(
                "DEEPSEEK_COURT_BASE_URL",
                values,
                default=self._pick_setting("DEEPSEEK_BASE_URL", values, default="https://api.deepseek.com"),
            )
            .strip()
            .rstrip("/")
            or "https://api.deepseek.com"
        )
        self.model = (
            self._pick_setting(
                "DEEPSEEK_COURT_MODEL",
                values,
                default=self._pick_setting("DEEPSEEK_MODEL", values, default="deepseek-chat"),
            )
            .strip()
            or "deepseek-chat"
        )
        self.max_tokens = self._pick_int_setting("DEEPSEEK_COURT_MAX_TOKENS", values, default=110)
        self.temperature = self._pick_float_setting("DEEPSEEK_COURT_TEMPERATURE", values, default=0.9)
        self.support_judge_enabled = self._pick_bool_setting(
            "DEEPSEEK_COURT_SUPPORT_JUDGE_ENABLED",
            values,
            default=False,
        )
        self.support_judge_max_tokens = self._pick_int_setting(
            "DEEPSEEK_COURT_SUPPORT_JUDGE_MAX_TOKENS",
            values,
            default=120,
        )
        self.support_judge_temperature = self._pick_float_setting(
            "DEEPSEEK_COURT_SUPPORT_JUDGE_TEMPERATURE",
            values,
            default=0.35,
        )
        self.timeout_seconds = self._pick_float_setting("DEEPSEEK_COURT_TIMEOUT_SECONDS", values, default=1.2)
        self._last_settings_refresh_monotonic = now

    def _get_http_client(self) -> httpx.Client:
        signature = f"{self.base_url}|{self.timeout_seconds:.3f}"
        if self._http_client is not None and self._http_client_signature == signature:
            return self._http_client

        if self._http_client is not None:
            self._http_client.close()

        self._http_client = httpx.Client(timeout=self.timeout_seconds)
        self._http_client_signature = signature
        return self._http_client

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

    def _pick_bool_setting(self, key: str, file_values: dict[str, str], *, default: bool) -> bool:
        raw = self._pick_setting(key, file_values, default="1" if default else "0").strip().lower()
        if raw in {"1", "true", "yes", "on"}:
            return True
        if raw in {"0", "false", "no", "off"}:
            return False
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

    def _build_messages(
        self,
        *,
        state: GameState,
        npc: CourtNpcState,
        strategy: CourtStrategy | None,
        scene: str,
        fallback: str,
        player_statement: str | None,
    ) -> list[dict[str, str]]:
        strategy_label = strategy.value if strategy is not None else "none"
        issue_text = "、".join(state.court.current_issues[:3]) if state.court.current_issues else "朝议分歧"
        style_tags = "、".join(npc.dialogue_style_tags[:4]) if npc.dialogue_style_tags else "无"
        recent_lines = self._recent_dialogue_snippet(state, limit=4)
        statement = " ".join((player_statement or "").split()).strip()
        if len(statement) > 180:
            statement = statement[:180].rstrip("，,。.!?；;：: ") + "。"

        system_prompt = (
            "你是三国朝堂 NPC 台词生成器。"
            "输出 1-3 句中文台词，不要解释，不要编号，不要引号，不要姓名前缀。"
            "语言可白话可半文言，要有人物个性与情绪变化。"
            "总长度不超过 90 个汉字。"
            "若提供了玩家陈词，你的第一句必须直接回应其中的核心主张，"
            "并复用玩家陈词中的至少一个关键词（可同义改写）。"
            "必须严格遵守："
            "1）立场值<=-15 或 反感值>=6 时，台词必须表达质疑/反对/保留；"
            "2）立场值>=20 且 反感值<=3 时，才可明确支持；"
            "3）其余情况用条件式表态（可行才支持）。"
        )
        user_prompt = (
            f"人物：{npc.display_name}\n"
            f"阵营：{npc.camp}\n"
            f"人设：{npc.persona_tag}\n"
            f"风格标签：{style_tags}\n"
            f"立场值：{npc.stance}\n"
            f"反感值：{npc.resentment}\n"
            f"场景：{scene}\n"
            f"朝议议题：{issue_text}\n"
            f"丞相策略：{strategy_label}\n"
            f"支持度：{state.court.support}/100\n"
            f"朝议温度：{state.court.temperature}\n"
            f"时限：{state.court.time_pressure}/{state.court.max_time_pressure}\n"
            f"最近朝议发言：{recent_lines}\n"
            f"玩家陈词：{statement or '无'}\n"
            f"参考句：{fallback}\n"
            "请给出该人物下一句台词。"
        )
        return [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}]

    def _build_support_judge_messages(
        self,
        *,
        state: GameState,
        strategy: CourtStrategy,
        statement: str,
        reaction_lines: list[str],
        heuristic_shift: int,
    ) -> list[dict[str, str]]:
        issue_text = "、".join(state.court.current_issues[:4]) if state.court.current_issues else "朝议分歧"
        reaction_block = "\n".join(
            f"- {' '.join(line.split())[:90]}" for line in reaction_lines[:8] if line.strip()
        ) or "- 无明确反应"

        system_prompt = (
            "你是三国朝堂支持度量化评估器。"
            "任务：根据玩家陈词质量和群臣反应，评估本轮支持度变化。"
            "必须只输出 JSON，不要额外文本。"
            '格式：{"support_shift": 整数, "reason": "不超过24字"}。'
            "support_shift 取值必须在 -10 到 10。"
            "支持度上升用正数，下降用负数。"
        )
        user_prompt = (
            f"策略：{strategy.value}\n"
            f"朝议议题：{issue_text}\n"
            f"当前支持度：{state.court.support}/100\n"
            f"玩家陈词：{statement}\n"
            f"群臣反应：\n{reaction_block}\n"
            f"启发式建议变动：{heuristic_shift}\n"
            "请给出本轮最终 support_shift。"
        )
        return [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}]

    def _call_deepseek(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> str:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": self.temperature if temperature is None else temperature,
            "max_tokens": self.max_tokens if max_tokens is None else max_tokens,
        }
        url = f"{self.base_url}/chat/completions"

        try:
            client = self._get_http_client()
            response = client.post(url, headers=headers, json=payload)
        except httpx.HTTPError as exc:
            raise RuntimeError(f"DeepSeek court request failed: {exc}") from exc

        if response.status_code >= 400:
            raise RuntimeError(f"DeepSeek court API error: {response.status_code}")

        body = response.json()
        choices = body.get("choices")
        if not isinstance(choices, list) or not choices:
            raise RuntimeError("DeepSeek court response missing choices.")

        first = choices[0]
        if not isinstance(first, dict):
            raise RuntimeError("DeepSeek court response malformed.")

        message = first.get("message")
        if not isinstance(message, dict):
            raise RuntimeError("DeepSeek court response missing message.")

        content = message.get("content")
        if not isinstance(content, str) or not content.strip():
            raise RuntimeError("DeepSeek court response empty.")
        return content.strip()

    def _sanitize_line(self, text: str, speaker_name: str) -> str:
        candidate = " ".join(text.replace("\n", " ").split()).strip()
        if not candidate:
            return ""

        # Remove role prefix if model returns one.
        prefixes = (
            f"{speaker_name}：",
            f"{speaker_name}:",
            f"{speaker_name} ",
        )
        for prefix in prefixes:
            if candidate.startswith(prefix):
                candidate = candidate[len(prefix) :].strip()

        candidate = candidate.strip("“”\"' ")
        if len(candidate) < 4:
            return ""
        if len(candidate) > 96:
            candidate = candidate[:96].rstrip("，,。.!?；;：: ") + "。"
        return candidate

    def _parse_support_shift(self, content: str) -> int | None:
        raw = content.strip()
        if not raw:
            return None

        if raw.startswith("```"):
            raw = re.sub(r"^```[a-zA-Z]*\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw).strip()

        try:
            payload = json.loads(raw)
            if isinstance(payload, dict):
                value = payload.get("support_shift")
                if isinstance(value, int):
                    return value
                if isinstance(value, float):
                    return int(round(value))
        except json.JSONDecodeError:
            pass

        matched = re.search(r"-?\d{1,2}", raw)
        if matched is None:
            return None
        try:
            return int(matched.group(0))
        except ValueError:
            return None

    def _clamp_support_shift(self, shift: int) -> int:
        return max(-10, min(10, int(shift)))

    def _recent_dialogue_snippet(self, state: GameState, *, limit: int) -> str:
        items = state.court.pending_messages[-limit:]
        lines: list[str] = []
        for message in items:
            compact = " ".join(message.text.split()).strip()
            if not compact:
                continue
            if len(compact) > 36:
                compact = compact[:36].rstrip("，,。.!?；;：: ") + "…"
            lines.append(f"{message.speaker_name}:{compact}")
        return " | ".join(lines) if lines else "无"
