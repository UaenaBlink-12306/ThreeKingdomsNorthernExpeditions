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

export type CourtStrategy =
  | "rational_argument"
  | "authority_pressure"
  | "emotional_mobilization";

export type CourtResult = "pass" | "fail" | "timeout_pass" | "timeout_fail";

export interface CourtNpcState {
  id: string;
  display_name: string;
  persona_tag: string;
  camp: string;
  stance: number;
  influence: number;
  resentment: number;
  ignored_rounds: number;
}

export interface CourtMessage {
  id: string;
  speaker_id: string;
  speaker_name: string;
  camp: string;
  text: string;
}

export interface CourtBattleModifier {
  id: string;
  title: string;
  description: string;
  turns_remaining: number;
  check_modifier: number;
  doom_per_turn_modifier: number;
  food_per_turn_modifier: number;
  morale_per_turn_modifier: number;
  success_reward_food: number;
  success_reward_morale: number;
  failure_penalty_food: number;
  failure_penalty_morale: number;
  failure_penalty_doom: number;
  answer_tolerance_modifier: number;
  risk_level: string;
}

export interface CourtResolution {
  session_id: number;
  turn_resolved: number;
  result: CourtResult;
  summary: string;
  support: number;
  temperature: number;
  triggered_events: string[];
  modifier: CourtBattleModifier | null;
}

export interface CourtHistoryEntry {
  session_id: number;
  turn_resolved: number;
  result: CourtResult;
  support: number;
  temperature: number;
  modifier_id?: string | null;
}

export interface CourtState {
  is_active: boolean;
  session_id: number;
  return_phase: string;
  temperature: number;
  support: number;
  time_pressure: number;
  max_time_pressure: number;
  npcs: Record<string, CourtNpcState>;
  history: CourtHistoryEntry[];
  pending_messages: CourtMessage[];
  current_issues: string[];
  current_issue_tags: string[];
  active_modifier: CourtBattleModifier | null;
  last_resolution: CourtResolution | null;
  last_trigger_turn: number;
  message_seq: number;
  resentment_event_fired: boolean;
  momentum: number;
  current_rebound_events: string[];
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
  court: CourtState;
}

export type ChatMode =
  | "preturn_advisor"
  | "afterturn_interpreter"
  | "scenario_mentor"
  | "roleplay";

export interface AssistantRequest {
  mode: ChatMode;
  game_state: GameState;
  previous_state?: GameState | null;
  delta_summary?: string[];
  delta_log?: string[];
  user_message?: string;
  roleplay_character?: string;
}

export interface AssistantResponse {
  mode: ChatMode;
  content: string;
  model: string;
}
