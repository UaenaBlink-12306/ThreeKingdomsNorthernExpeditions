import type { GameState } from "../types";

interface StatusPanelProps {
  state: GameState;
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="status-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function StatusPanel({ state }: StatusPanelProps) {
  return (
    <section className="panel status-grid">
      <Row label="粮草" value={state.food} />
      <Row label="士气" value={state.morale} />
      <Row label="政争" value={state.politics} />
      <Row label="魏压" value={state.wei_pressure} />
      <Row label="健康" value={state.health} />
      <Row label="Doom" value={state.doom} />
      <Row label="陇右回合" value={state.longyou_turns} />
      <Row label="关中回合" value={state.guanzhong_turns} />
    </section>
  );
}
