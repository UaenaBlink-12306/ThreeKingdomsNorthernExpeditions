import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import App from "../src/App";
import type { GameState } from "../src/types";
import { GAME_ID_KEY, useGameStore } from "../src/store/gameStore";

vi.mock("../src/components/MapPanel", () => ({
  default: () => <div>map</div>,
}));

const api = vi.hoisted(() => ({
  newGame: vi.fn(),
  getState: vi.fn(),
  act: vi.fn(),
  chatAssistant: vi.fn(),
}));

vi.mock("../src/api", () => api);

function buildState(overrides: Partial<GameState> = {}): GameState {
  return {
    game_id: "g1",
    chapter: 1,
    turn: 1,
    phase: "campaign",
    outcome: "ONGOING",
    food: 10,
    morale: 10,
    politics: 10,
    wei_pressure: 10,
    health: 10,
    doom: 0,
    longyou_turns: 0,
    guanzhong_turns: 0,
    longyou_collapsed: false,
    flags: {},
    log: ["start"],
    current_node_id: "n1",
    current_event: {
      text: "event",
      options: [{ id: "opt1", label: "Option 1" }],
    },
    current_location: "loc",
    controlled_locations: [],
    active_route_id: null,
    route_progress: 0,
    seed: 1,
    roll_count: 0,
    court: {
      is_active: false,
      session_id: 0,
      return_phase: "campaign",
      temperature: 0,
      support: 55,
      time_pressure: 0,
      max_time_pressure: 0,
      npcs: {},
      history: [],
      pending_messages: [],
      current_issues: [],
      current_issue_tags: [],
      active_modifier: null,
      last_resolution: null,
      last_trigger_turn: 0,
      message_seq: 0,
      resentment_event_fired: false,
      momentum: 0,
      current_rebound_events: [],
    },
    ...overrides,
  };
}

function renderApp(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("zhuge_state_schema_version", "court-buffer-v1");
  vi.clearAllMocks();
  api.chatAssistant.mockResolvedValue({
    mode: "preturn_advisor",
    content: "mock",
    model: "mock-model",
  });
  useGameStore.setState({
    gameId: null,
    busy: false,
    error: "",
    helpOpen: false,
    audioEnabled: false,
    disableAutoHelp: false,
  });
});

describe("App + query integration", () => {
  it("calls newGame on fresh boot and shows game id", async () => {
    api.newGame.mockResolvedValue(buildState());

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderApp(client);

    const gameIds = await screen.findAllByText(/Game ID: g1/);
    expect(gameIds.length).toBeGreaterThan(0);
    expect(api.newGame).toHaveBeenCalledTimes(1);
  });

  it("calls act on option click and updates state", async () => {
    localStorage.setItem(GAME_ID_KEY, "g1");
    api.getState.mockResolvedValue(buildState());
    api.act.mockResolvedValue(
      buildState({
        turn: 2,
        current_event: { text: "next event", options: [] },
      })
    );

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderApp(client);

    const buttons = await screen.findAllByRole("button", { name: "Option 1" });
    fireEvent.click(buttons[0]);

    await waitFor(
      () => expect(api.act).toHaveBeenCalledWith("g1", "choose_option", { option_id: "opt1" }),
      { timeout: 3000 }
    );
    expect(await screen.findByText("next event")).toBeInTheDocument();
  });

  it("shows unified action error message", async () => {
    localStorage.setItem(GAME_ID_KEY, "g1");
    api.getState.mockResolvedValue(buildState());
    api.act.mockRejectedValue(new Error("boom"));

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderApp(client);

    const buttons = await screen.findAllByRole("button", { name: "Option 1" });
    fireEvent.click(buttons[0]);

    const errors = await screen.findAllByText("[act] boom", undefined, { timeout: 3000 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("restores page state from query cache", async () => {
    localStorage.setItem(GAME_ID_KEY, "g1");
    api.getState.mockResolvedValue(buildState());

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(["game", "g1"], buildState({ turn: 3 }));

    renderApp(client);

    const gameIds = await screen.findAllByText(/Game ID: g1/);
    expect(gameIds.length).toBeGreaterThan(0);
    expect(api.newGame).not.toHaveBeenCalled();
  });
});
