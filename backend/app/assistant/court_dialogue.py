from __future__ import annotations

import os
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
        self.max_tokens = 90
        self.timeout_seconds = 8.0
        self.failure_cooldown_seconds = 20.0
        self._disabled_until = 0.0
        self._refresh_settings()

    def generate_line(
        self,
        *,
        state: GameState,
        npc: CourtNpcState,
        fallback_text: str,
        strategy: CourtStrategy | None = None,
        scene: str = "debate",
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

    def _refresh_settings(self) -> None:
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
        self.max_tokens = self._pick_int_setting("DEEPSEEK_COURT_MAX_TOKENS", values, default=90)
        self.timeout_seconds = self._pick_float_setting("DEEPSEEK_COURT_TIMEOUT_SECONDS", values, default=8.0)

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
    ) -> list[dict[str, str]]:
        strategy_label = strategy.value if strategy is not None else "none"
        issue_text = "、".join(state.court.current_issues[:3]) if state.court.current_issues else "朝议分歧"

        system_prompt = (
            "你是三国朝堂 NPC 台词生成器。"
            "只输出一句中文台词，不要解释，不要编号，不要引号，不要姓名前缀。"
            "要求克制、简洁、符合人物立场，不超过 32 个汉字。"
            "必须严格遵守："
            "1）立场值<=-15 或 反感值>=6 时，台词必须表达质疑/反对/保留；"
            "2）立场值>=20 且 反感值<=3 时，才可明确支持；"
            "3）其余情况用条件式表态（可行才支持）。"
        )
        user_prompt = (
            f"人物：{npc.display_name}\n"
            f"阵营：{npc.camp}\n"
            f"人设：{npc.persona_tag}\n"
            f"立场值：{npc.stance}\n"
            f"反感值：{npc.resentment}\n"
            f"场景：{scene}\n"
            f"朝议议题：{issue_text}\n"
            f"丞相策略：{strategy_label}\n"
            f"支持度：{state.court.support}/100\n"
            f"朝议温度：{state.court.temperature}\n"
            f"时限：{state.court.time_pressure}/{state.court.max_time_pressure}\n"
            f"参考句：{fallback}\n"
            "请给出该人物下一句台词。"
        )
        return [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}]

    def _call_deepseek(self, messages: list[dict[str, str]]) -> str:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.85,
            "max_tokens": self.max_tokens,
        }
        url = f"{self.base_url}/chat/completions"

        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
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
        if len(candidate) > 48:
            candidate = candidate[:48].rstrip("，,。.!?；;：: ") + "。"
        return candidate
