import type { GameState } from "../types";

interface GoalPanelProps {
  state: GameState;
}

export default function GoalPanel({ state }: GoalPanelProps) {
  const coreLost = Boolean(state.flags.core_lost);
  return (
    <section className="panel goal-panel">
      <h2>目标与规则 / Goal</h2>
      <ul>
        <li>
          胜利条件：`关中回合 >= 3` 且 `陇右未崩盘`。
          <span className="goal-inline">
            当前：关中 {state.guanzhong_turns}/3，陇右{state.longyou_collapsed ? "已崩盘" : "稳定"}。
          </span>
        </li>
        <li>
          蜀亡条件：`Doom 总攻防守失败` 或 `core_lost = true`（当前 {coreLost ? "是" : "否"}）。
        </li>
        <li>Fail Forward：失街亭/断粮/撤军等挫败会进入 recover/court/defense，游戏继续。</li>
        <li>优先控制 Doom、粮草与陇右稳定，再争取关中稳固三回合。</li>
      </ul>
    </section>
  );
}
