import type { GameState } from "../types";

interface GoalPanelProps {
  state: GameState;
}

export default function GoalPanel({ state }: GoalPanelProps) {
  const coreLost = Boolean(state.flags.core_lost);
  return (
    <section className="panel goal-panel">
      <h2>胜负判定（详细）</h2>
      <ul>
        <li>胜利：关中稳固满 3 回合，且陇右保持稳定。</li>
        <li>失败：Doom 总攻防守失败，或核心失守（当前：{coreLost ? "已失守" : "未失守"}）。</li>
        <li>挫败会进入整备/朝议/防务阶段，不会立刻结束。</li>
      </ul>
    </section>
  );
}
