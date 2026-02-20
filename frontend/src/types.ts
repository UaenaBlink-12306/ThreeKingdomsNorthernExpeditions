export type Phase = "campaign" | "recover" | "court" | "defense" | "final";

export type Outcome = "ONGOING" | "WIN" | "DEFEAT_SHU";

export interface OptionView {
  id: string;
  label: string;
  disabled?: boolean;
  disabled_reason?: string;
}

export interface EventView {
  text: string;
  options: OptionView[];
}

export interface GameState {
  game_id: string;
  chapter: number;
  turn: number;
  phase: Phase;
  outcome: Outcome;
  food: number;
  morale: number;
  politics: number;
  wei_pressure: number;
  health: number;
  doom: number;
  longyou_turns: number;
  guanzhong_turns: number;
  longyou_collapsed: boolean;
  flags: Record<string, boolean>;
  log: string[];
  current_node_id: string;
  current_event: EventView;
  current_location: string;
  controlled_locations: string[];
  active_route_id: string | null;
  route_progress: number;
  seed: number;
  roll_count: number;
}
