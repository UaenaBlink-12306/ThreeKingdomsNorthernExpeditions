import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import type { CourtMessage, CourtState, CourtStrategy } from "../types";
import { playMechanicalClick, playMechanicalPress } from "../utils/sound";

interface CourtBufferPanelProps {
  court: CourtState;
  busy: boolean;
  dispatching: boolean;
  onSubmitStatement: (statement: string, strategyHint?: CourtStrategy) => void;
  onQuickStrategy: (strategy: CourtStrategy) => void;
  onFastForward: () => void;
}

const STRATEGY_META: Array<{
  id: CourtStrategy;
  label: string;
  desc: string;
  cost: string;
}> = [
  { id: "rational_argument", label: "理性论证", desc: "强调证据、粮草与可行性", cost: "消耗：粮草 -1" },
  { id: "authority_pressure", label: "权威压制", desc: "快速定令，压低争执", cost: "消耗：政治 -4 / 士气 -1" },
  { id: "emotional_mobilization", label: "情感动员", desc: "强调军心民心与战机", cost: "消耗：士气 -2 / 粮草 -1" },
];

function campLabel(camp: string): string {
  const mapping: Record<string, string> = {
    system: "战报",
    imperial: "皇廷",
    administration: "政务",
    moderate: "中和",
    bureaucrat: "官僚",
    institution: "制度",
    hawk: "主战",
    vanguard: "前锋",
    player: "丞相",
  };
  return mapping[camp] ?? camp;
}

function messageDelay(text: string): number {
  return Math.max(250, Math.min(900, 220 + text.length * 16));
}

export default function CourtBufferPanel({
  court,
  busy,
  dispatching,
  onSubmitStatement,
  onQuickStrategy,
  onFastForward,
}: CourtBufferPanelProps) {
  const [statement, setStatement] = useState("");
  const [strategyHint, setStrategyHint] = useState<CourtStrategy>("rational_argument");
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const [skipQueue, setSkipQueue] = useState(false);
  const timerRef = useRef<number | null>(null);
  const lastSessionRef = useRef<number>(court.session_id);

  const visibleSet = useMemo(() => new Set(visibleIds), [visibleIds]);
  const visibleMessages = useMemo(
    () => court.pending_messages.filter((message) => visibleSet.has(message.id)),
    [court.pending_messages, visibleSet]
  );

  useEffect(() => {
    if (court.session_id === lastSessionRef.current) {
      return;
    }
    lastSessionRef.current = court.session_id;
    setVisibleIds([]);
    setSkipQueue(false);
    setStatement("");
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [court.session_id]);

  useEffect(() => {
    if (!court.is_active && court.pending_messages.length < 1) {
      return;
    }

    if (skipQueue) {
      setVisibleIds(court.pending_messages.map((message) => message.id));
      return;
    }

    const hidden = court.pending_messages.find((message) => !visibleSet.has(message.id));
    if (!hidden) {
      return;
    }

    timerRef.current = window.setTimeout(() => {
      setVisibleIds((current) => (current.includes(hidden.id) ? current : [...current, hidden.id]));
    }, messageDelay(hidden.text));

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [court.is_active, court.pending_messages, skipQueue, visibleSet]);

  useEffect(() => {
    if (!court.is_active) {
      setSkipQueue(false);
    }
  }, [court.is_active]);

  const temperaturePercent = ((court.temperature + 100) / 200) * 100;
  const supportPercent = Math.max(0, Math.min(100, court.support));
  const timePercent =
    court.max_time_pressure > 0
      ? Math.max(0, Math.min(100, (court.time_pressure / court.max_time_pressure) * 100))
      : 0;

  const resentmentList = Object.values(court.npcs)
    .sort((a, b) => b.resentment - a.resentment)
    .slice(0, 7);

  function submitStatement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = statement.trim();
    if (!trimmed) {
      return;
    }
    playMechanicalPress();
    onSubmitStatement(trimmed, strategyHint);
    setStatement("");
  }

  function triggerQuickStrategy(strategy: CourtStrategy) {
    playMechanicalPress();
    setStrategyHint(strategy);
    onQuickStrategy(strategy);
  }

  function fastForward() {
    playMechanicalClick();
    setSkipQueue(true);
    onFastForward();
  }

  return (
    <section className="panel court-panel">
      <header className="court-header">
        <h2>朝堂缓冲区</h2>
        <small>你是诸葛亮。请用陈词稳住朝议支持。</small>
      </header>

      <div className="court-meters">
        <div className="court-meter">
          <div className="court-meter-label">
            <span>朝议温度</span>
            <strong>{court.temperature}</strong>
          </div>
          <div className="court-track court-track-temperature">
            <span style={{ left: `${temperaturePercent}%` }} />
          </div>
          <small>保守 ←→ 激进</small>
        </div>

        <div className="court-meter">
          <div className="court-meter-label">
            <span>支持度</span>
            <strong>{court.support}/100</strong>
          </div>
          <div className="court-track">
            <i style={{ width: `${supportPercent}%` }} />
          </div>
        </div>

        <div className="court-meter">
          <div className="court-meter-label">
            <span>时间压力</span>
            <strong>
              {court.time_pressure}/{court.max_time_pressure}
            </strong>
          </div>
          <div className="court-track court-track-time">
            <i style={{ width: `${timePercent}%` }} />
          </div>
        </div>
      </div>

      <div className="court-layout">
        <div className="court-chat">
          {visibleMessages.length < 1 ? <p className="report-streaming">战报传来……</p> : null}
          <ul>
            {visibleMessages.map((message: CourtMessage) => (
              <li key={message.id} className={`court-msg camp-${message.camp}`}>
                <div className="court-msg-head">
                  <strong>{message.speaker_name}</strong>
                  <span>{campLabel(message.camp)}</span>
                </div>
                <p>{message.text}</p>
              </li>
            ))}
          </ul>
        </div>

        <aside className="court-resentment">
          <h3>派系反感</h3>
          <ul>
            {resentmentList.map((npc) => (
              <li key={npc.id}>
                <span>{npc.display_name}</span>
                <strong>{npc.resentment}</strong>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <form className="court-form" onSubmit={submitStatement}>
        <label htmlFor="court-statement">陈词（自由输入）</label>
        <textarea
          id="court-statement"
          value={statement}
          onChange={(event) => setStatement(event.target.value)}
          placeholder="例如：臣请先按粮道与里程分配兵站，再议速攻。"
          rows={2}
          maxLength={160}
        />
        <div className="court-form-tools">
          <div className="court-strategy-pills">
            {STRATEGY_META.map((strategy) => (
              <button
                key={strategy.id}
                type="button"
                className={strategyHint === strategy.id ? "active" : ""}
                disabled={busy}
                title={`${strategy.desc}｜${strategy.cost}`}
                onClick={() => setStrategyHint(strategy.id)}
              >
                {strategy.label}
              </button>
            ))}
          </div>
          <button type="submit" disabled={busy || statement.trim().length < 1}>
            发送陈词
          </button>
        </div>
      </form>

      <div className="court-actions">
        {STRATEGY_META.map((strategy) => (
          <button
            key={strategy.id}
            type="button"
            disabled={busy}
            onClick={() => triggerQuickStrategy(strategy.id)}
            title={strategy.cost}
          >
            仅用{strategy.label}
          </button>
        ))}
        <button type="button" disabled={busy} onClick={fastForward}>
          快进并结算
        </button>
      </div>

      {dispatching ? <p className="dispatch-status">朝议中……文书往返传递。</p> : null}
    </section>
  );
}
