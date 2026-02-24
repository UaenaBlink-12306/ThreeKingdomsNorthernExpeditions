import type { AssistantRequest, AssistantResponse, GameState } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
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
