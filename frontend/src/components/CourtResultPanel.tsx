import type { CourtState } from "../types";

interface CourtResultPanelProps {
  court: CourtState;
}

function formatResult(result: string): string {
  const mapping: Record<string, string> = {
    pass: "朝议通过",
    timeout_pass: "压线通过",
    fail: "朝议失利",
    timeout_fail: "超时失利",
  };
  return mapping[result] ?? result;
}

export default function CourtResultPanel({ court }: CourtResultPanelProps) {
  const resolution = court.last_resolution;
  const modifier = court.active_modifier ?? resolution?.modifier ?? null;
  if (!resolution && !modifier) {
    return null;
  }

  return (
    <section className="panel court-result-panel">
      <h3>朝议结果</h3>
      {resolution ? (
        <p className="court-result-summary">
          {formatResult(resolution.result)}：{resolution.summary}
        </p>
      ) : null}
      {modifier ? (
        <div className="court-result-modifier">
          <strong>{modifier.title}</strong>
          <p>{modifier.description}</p>
          <ul>
            <li>剩余回合：{modifier.turns_remaining}</li>
            <li>检定修正：{modifier.check_modifier >= 0 ? "+" : ""}{modifier.check_modifier.toFixed(2)}</li>
            <li>每回合：粮草 {modifier.food_per_turn_modifier >= 0 ? "+" : ""}{modifier.food_per_turn_modifier} / 士气 {modifier.morale_per_turn_modifier >= 0 ? "+" : ""}{modifier.morale_per_turn_modifier} / Doom {modifier.doom_per_turn_modifier >= 0 ? "+" : ""}{modifier.doom_per_turn_modifier}</li>
            <li>成功额外：粮草 +{modifier.success_reward_food} / 士气 +{modifier.success_reward_morale}</li>
            <li>失败惩罚：粮草 -{modifier.failure_penalty_food} / 士气 -{modifier.failure_penalty_morale} / Doom +{modifier.failure_penalty_doom}</li>
          </ul>
        </div>
      ) : null}
    </section>
  );
}
