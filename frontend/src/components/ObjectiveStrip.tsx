import type { GameState } from "../types";
import { DOOM_MAX, DOOM_WARN, GUANZHONG_TARGET } from "../utils/thresholds";

interface ObjectiveStripProps {
  state: GameState;
}

export default function ObjectiveStrip({ state }: ObjectiveStripProps) {
  const doomWarning = state.doom >= DOOM_WARN;

  return (
    <section className="panel objective-strip" aria-label="objective-strip">
      <h2>军令目标</h2>
      <div className="objective-items">
        <div className="objective-item">
          <span>主目标</span>
          <strong>关中稳固 {state.guanzhong_turns}/{GUANZHONG_TARGET}</strong>
          <small>陇右必须稳定方可达成。</small>
        </div>
        <div className="objective-item">
          <span>陇右态势</span>
          <strong>{state.longyou_collapsed ? "崩盘 ❌" : "稳定 ✅"}</strong>
          <small>{state.longyou_collapsed ? "当前无法触发胜利条件。" : "仍可持续推进关中目标。"}</small>
        </div>
        <div className={`objective-item ${doomWarning ? "objective-danger" : ""}`}>
          <span>危机压力</span>
          <strong>Doom {state.doom}/{DOOM_MAX}</strong>
          <small>到 {DOOM_MAX} 将触发总攻链条。</small>
        </div>
      </div>
    </section>
  );
}
