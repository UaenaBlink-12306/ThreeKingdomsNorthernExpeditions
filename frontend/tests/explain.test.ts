import { describe, expect, it } from "vitest";
import { explainTurn } from "../src/utils/explain";
import type { GameState } from "../src/types";

function buildState(overrides: Partial<GameState> = {}): GameState {
  return {
    game_id: "g1",
    chapter: 1,
    turn: 1,
    phase: "campaign",
    outcome: "ONGOING",
    food: 20,
    morale: 10,
    politics: 10,
    wei_pressure: 8,
    health: 10,
    doom: 2,
    longyou_turns: 0,
    guanzhong_turns: 0,
    longyou_collapsed: false,
    flags: {},
    log: [],
    current_node_id: "n1",
    current_event: { text: "x", options: [] },
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

describe("explainTurn", () => {
  it("prioritizes check-based because line", () => {
    const prev = buildState();
    const next = buildState({ food: 12 });
    const explained = explainTurn(prev, next, ["检定[粮道]：失败"], { has_changes: true, lines: ["粮草 -8"] });
    expect(explained.becauseLine).toContain("检定[粮道]");
  });

  it("adds doom warning badge near threshold", () => {
    const prev = buildState({ doom: 9 });
    const next = buildState({ doom: 10 });
    const explained = explainTurn(prev, next, [], { has_changes: true, lines: ["Doom +1"] });
    expect(explained.warningBadges).toContain("Doom 高危");
  });
});
