import type { GameState } from "../types";
import { DOOM_MAX, DOOM_WARN, GUANZHONG_TARGET } from "../utils/thresholds";

interface StatusPanelProps {
  state: GameState;
  prevState: GameState | null;
}

function trend(prev: number | undefined, next: number): string {
  if (prev === undefined) return "—";
  if (next > prev) return "↑";
  if (next < prev) return "↓";
  return "—";
}

function Item({ label, value, trendText, danger }: { label: string; value: string | number; trendText?: string; danger?: boolean }) {
  return (
    <div className={`status-item ${danger ? "danger" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {trendText ? <small>{trendText}</small> : null}
    </div>
  );
}

export default function StatusPanel({ state, prevState }: StatusPanelProps) {
  return (
    <section className="panel status-grid">
      <Item label="胜利进度" value={`${state.guanzhong_turns}/${GUANZHONG_TARGET}`} />
      <Item label="陇右" value={state.longyou_collapsed ? "崩盘" : "稳定"} danger={state.longyou_collapsed} />
      <Item label="Doom" value={`${state.doom}/${DOOM_MAX}`} trendText={trend(prevState?.doom, state.doom)} danger={state.doom >= DOOM_WARN} />
      <Item label="粮草" value={state.food} trendText={trend(prevState?.food, state.food)} />
      <Item label="士气" value={state.morale} trendText={trend(prevState?.morale, state.morale)} />
      <Item label="政争" value={state.politics} trendText={trend(prevState?.politics, state.politics)} />
      <Item label="魏压" value={state.wei_pressure} trendText={trend(prevState?.wei_pressure, state.wei_pressure)} />
      <Item label="健康" value={state.health} trendText={trend(prevState?.health, state.health)} />
    </section>
  );
}
