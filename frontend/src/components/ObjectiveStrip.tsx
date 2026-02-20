import type { GameState } from "../types";
import { DOOM_MAX, DOOM_WARN, GUANZHONG_TARGET } from "../utils/thresholds";

interface ObjectiveStripProps {
  state: GameState;
}

export default function ObjectiveStrip({ state }: ObjectiveStripProps) {
  const doomWarning = state.doom >= DOOM_WARN;

  return (
    <section className="panel objective-strip" aria-label="objective-strip">
      <div>
        主目标：关中稳固 {state.guanzhong_turns}/{GUANZHONG_TARGET}（陇右必须稳定）
      </div>
      <div>
        陇右：{state.longyou_collapsed ? "崩盘 ❌（无法胜利）" : "稳定 ✅"}
      </div>
      <div className={doomWarning ? "objective-danger" : ""}>
        危机：Doom {state.doom}/{DOOM_MAX}（到 {DOOM_MAX} 触发总攻）
      </div>
    </section>
  );
}
