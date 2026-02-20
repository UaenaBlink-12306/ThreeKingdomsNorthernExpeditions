import type { GameState } from "../types";
import type { DiffSummary } from "./diff";
import { DOOM_WARN } from "./thresholds";

export interface TurnExplanation {
  becauseLine: string;
  nextStepLine: string;
  driverBullets: string[];
  warningBadges: string[];
}

function largestResourceDelta(prev: GameState, next: GameState): string {
  const resources: Array<[keyof Pick<GameState, "food" | "morale" | "politics" | "wei_pressure" | "health" | "doom">, string]> = [
    ["food", "粮草"],
    ["morale", "士气"],
    ["politics", "政争"],
    ["wei_pressure", "魏压"],
    ["health", "健康"],
    ["doom", "Doom"],
  ];

  let best = "数值波动";
  let bestAbs = -1;
  for (const [key, label] of resources) {
    const delta = next[key] - prev[key];
    const abs = Math.abs(delta);
    if (abs > bestAbs && abs > 0) {
      bestAbs = abs;
      best = `${label}${delta > 0 ? ` +${delta}` : ` ${delta}`}`;
    }
  }
  return best;
}

export function explainTurn(
  prevState: GameState | null,
  state: GameState,
  deltaLog: string[],
  diffSummary: DiffSummary
): TurnExplanation {
  if (!prevState) {
    return {
      becauseLine: "因为：新局开始，系统初始化了当前阶段与资源。",
      nextStepLine: "下一步：先看行动提示，优先稳住陇右与粮草。",
      driverBullets: diffSummary.lines.slice(0, 2),
      warningBadges: [],
    };
  }

  const checkLine = deltaLog.find((line) => /检定\[[^\]]+\]/.test(line));
  let becauseLine = `因为：本回合以${state.phase}阶段为主，数值变化较小。`;
  if (checkLine) {
    const key = (checkLine.match(/检定\[([^\]]+)\]/) ?? ["", "关键项"])[1];
    const success = /成功/.test(checkLine) ? "成功" : /失败/.test(checkLine) ? "失败" : "触发";
    becauseLine = `因为：检定[${key}]${success}，导致${largestResourceDelta(prevState, state)}。`;
  } else if (prevState.doom !== state.doom) {
    const doomDelta = state.doom - prevState.doom;
    const reason = state.longyou_collapsed
      ? "陇右崩盘"
      : state.food <= 15
      ? "粮草偏低"
      : state.wei_pressure >= 12
      ? "魏压过高"
      : `阶段${state.phase}压力`;
    becauseLine = `因为：${reason}，本回合 Doom ${doomDelta > 0 ? `+${doomDelta}` : doomDelta}。`;
  }

  let nextStepLine = "下一步：选择能同时控 Doom 与稳资源的行动。";
  if (state.longyou_collapsed) {
    nextStepLine = "下一步：必须先恢复陇右，否则无法胜利。";
  } else if (state.doom >= DOOM_WARN) {
    nextStepLine = "下一步：危机接近阈值，优先防守/减压，避免 Doom 触顶。";
  } else if (state.food <= 15) {
    nextStepLine = "下一步：优先恢复粮草到安全线，再推进战线。";
  } else if (state.phase === "final") {
    nextStepLine = "下一步：集中保障关中稳固回合，避免被动失守。";
  }

  const warningBadges: string[] = [];
  if (state.doom >= DOOM_WARN) {
    warningBadges.push("Doom 高危");
  }
  if (state.longyou_collapsed) {
    warningBadges.push("陇右崩盘");
  }

  return {
    becauseLine,
    nextStepLine,
    driverBullets: diffSummary.lines.slice(0, 3),
    warningBadges,
  };
}
