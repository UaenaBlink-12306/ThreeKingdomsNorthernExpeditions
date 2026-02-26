import type { AssistantRequest, AssistantResponse, GameState } from "./types";
import { reportConsoleError } from "./utils/errorLogger";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000/api";
const DEFAULT_API_TIMEOUT_MS = 45_000;

function getApiTimeoutMs(): number {
  const raw = import.meta.env.VITE_API_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_API_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_API_TIMEOUT_MS;
  }
  return parsed;
}

async function readErrorDetail(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return "";
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      const detail = json.detail;
      if (typeof detail === "string" && detail.trim()) {
        return detail.trim();
      }
      const message = json.message;
      if (typeof message === "string" && message.trim()) {
        return message.trim();
      }
    } catch (err) {
      reportConsoleError("api.error_detail_parse_failed", err, {
        responseText: text.slice(0, 500),
      });
    }
  }

  return text.trim();
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const method = init?.method ?? "GET";
  const timeoutMs = getApiTimeoutMs();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();
  let responseStatus: number | undefined;
  let responseStatusText: string | undefined;

  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      ...init,
      signal: controller.signal,
    });

    responseStatus = response.status;
    responseStatusText = response.statusText;

    if (!response.ok) {
      const detail = await readErrorDetail(response);
      throw new Error(detail || `Request failed: ${response.status}`);
    }

    try {
      return (await response.json()) as T;
    } catch (err) {
      throw new Error(`Response JSON parse failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  } catch (err) {
    const durationMs = Math.round(performance.now() - startedAt);
    if (err instanceof DOMException && err.name === "AbortError") {
      const timeoutError = new Error(`Request timed out after ${timeoutMs}ms`);
      reportConsoleError("api.request_timeout", timeoutError, {
        url,
        path,
        method,
        timeoutMs,
        durationMs,
      });
      throw timeoutError;
    }

    reportConsoleError("api.request_failed", err, {
      url,
      path,
      method,
      timeoutMs,
      durationMs,
      status: responseStatus,
      statusText: responseStatusText,
    });
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

export function newGame(game_id?: string): Promise<GameState> {
  return request<GameState>("/new_game", {
    method: "POST",
    body: JSON.stringify({ game_id }),
  });
}

export function getState(game_id: string): Promise<GameState> {
  return request<GameState>(`/state?game_id=${encodeURIComponent(game_id)}`);
}

export function act(
  game_id: string,
  action: string,
  payload?: Record<string, unknown>
): Promise<GameState> {
  return request<GameState>("/act", {
    method: "POST",
    body: JSON.stringify({ game_id, action, payload: payload ?? {} }),
  });
}

export function reset(game_id?: string): Promise<{ status: string }> {
  return request<{ status: string }>("/reset", {
    method: "POST",
    body: JSON.stringify({ game_id }),
  });
}

export function chatAssistant(payload: AssistantRequest): Promise<AssistantResponse> {
  return request<AssistantResponse>("/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
