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
      text: "事件",
      options: [{ id: "opt1", label: "选项1" }],
    },
    current_location: "loc",
    controlled_locations: [],
    active_route_id: null,
    route_progress: 0,
    seed: 1,
    roll_count: 0,
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
  vi.clearAllMocks();
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
  it("新开局时调用 newGame 并渲染 game id", async () => {
    api.newGame.mockResolvedValue(buildState());

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderApp(client);

    expect(await screen.findByText(/Game ID: g1/)).toBeInTheDocument();
    expect(api.newGame).toHaveBeenCalledTimes(1);
  });

  it("点击选项会调用 act 并更新状态", async () => {
    localStorage.setItem(GAME_ID_KEY, "g1");
    api.getState.mockResolvedValue(buildState());
    api.act.mockResolvedValue(
      buildState({
        turn: 2,
        current_event: { text: "下一事件", options: [] },
      })
    );

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderApp(client);

    const button = await screen.findByRole("button", { name: "选项1" });
    fireEvent.click(button);

    await waitFor(() => expect(api.act).toHaveBeenCalledWith("g1", "choose_option", { option_id: "opt1" }));
    expect(await screen.findByText("下一事件")).toBeInTheDocument();
  });

  it("动作失败时显示统一错误提示", async () => {
    localStorage.setItem(GAME_ID_KEY, "g1");
    api.getState.mockResolvedValue(buildState());
    api.act.mockRejectedValue(new Error("boom"));

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderApp(client);

    const button = await screen.findByRole("button", { name: "选项1" });
    fireEvent.click(button);

    expect(await screen.findByText("[act] boom")).toBeInTheDocument();
  });

  it("缓存命中时可恢复页面状态", async () => {
    localStorage.setItem(GAME_ID_KEY, "g1");
    api.getState.mockResolvedValue(buildState());

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(["game", "g1"], buildState({ turn: 3 }));

    renderApp(client);

    expect(await screen.findByText(/回合 3/)).toBeInTheDocument();
  });
});
