import { PLACE_MAP } from "../places";
import type { GameState, Outcome, Phase } from "../types";

export interface DiffSummary {
  has_changes: boolean;
  lines: string[];
}

const PHASE_LABEL: Record<Phase, string> = {
  campaign: "战役 campaign",
  recover: "整备 recover",
  court: "朝议 court",
  defense: "防务 defense",
  final: "决战 final",
};

const OUTCOME_LABEL: Record<Outcome, string> = {
  ONGOING: "进行中",
  WIN: "胜利",
  DEFEAT_SHU: "蜀亡",
};

const STAT_LABELS: Array<[keyof Pick<GameState, "food" | "morale" | "politics" | "wei_pressure" | "doom" | "health">, string]> = [
  ["food", "粮草"],
  ["morale", "士气"],
  ["politics", "政争"],
  ["wei_pressure", "魏压"],
  ["doom", "Doom"],
  ["health", "健康"],
];

function sign(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function placeName(placeId: string): string {
  return PLACE_MAP[placeId]?.name ?? placeId;
}

function diffControl(prev: string[], next: string[]): { added: string[]; removed: string[] } {
  const prevSet = new Set(prev);
  const nextSet = new Set(next);
  const added = next.filter((id) => !prevSet.has(id));
  const removed = prev.filter((id) => !nextSet.has(id));
  return { added, removed };
}

export function diffState(prev: GameState | null, next: GameState): DiffSummary {
  if (!prev) {
    return {
      has_changes: true,
      lines: [
        `新局载入：第 ${next.chapter} 章 / 回合 ${next.turn}`,
        `当前阶段：${PHASE_LABEL[next.phase]}`,
        `目标进度：关中 ${next.guanzhong_turns}/3，陇右${next.longyou_collapsed ? "已崩盘" : "未崩盘"}`,
      ],
    };
  }

  const lines: string[] = [];

  if (prev.chapter !== next.chapter) {
    lines.push(`章节变化：${prev.chapter} -> ${next.chapter}`);
  }
  if (prev.turn !== next.turn) {
    lines.push(`回合推进：${prev.turn} -> ${next.turn}`);
  }
  if (prev.phase !== next.phase) {
    lines.push(`阶段变化：${PHASE_LABEL[prev.phase]} -> ${PHASE_LABEL[next.phase]}`);
  }

  for (const [key, label] of STAT_LABELS) {
    if (prev[key] !== next[key]) {
      lines.push(`${label} ${sign(next[key] - prev[key])}（${prev[key]} -> ${next[key]}）`);
    }
  }

  if (prev.current_location !== next.current_location) {
    lines.push(`战区移动：${placeName(prev.current_location)} -> ${placeName(next.current_location)}`);
  }

  const controlDiff = diffControl(prev.controlled_locations, next.controlled_locations);
  if (controlDiff.added.length > 0) {
    lines.push(`新增控制：${controlDiff.added.map(placeName).join("、")}`);
  }
  if (controlDiff.removed.length > 0) {
    lines.push(`失去控制：${controlDiff.removed.map(placeName).join("、")}`);
  }

  if (prev.outcome !== next.outcome) {
    lines.push(`终局变化：${OUTCOME_LABEL[prev.outcome]} -> ${OUTCOME_LABEL[next.outcome]}`);
  }

  if (lines.length < 1) {
    lines.push("本回合无关键数值变化（No major delta this turn）。");
  }

  return {
    has_changes: true,
    lines,
  };
}
