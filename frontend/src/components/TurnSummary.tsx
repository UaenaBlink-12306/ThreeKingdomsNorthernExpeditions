import { useEffect, useMemo, useState } from "react";
import type { DiffSummary } from "../utils/diff";
import { explainTurn } from "../utils/explain";
import type { GameState } from "../types";
import { playMechanicalClick } from "../utils/sound";

interface TurnSummaryProps {
  summary: DiffSummary;
  state: GameState;
  prevState: GameState | null;
  deltaLog: string[];
}

export default function TurnSummary({ summary, state, prevState, deltaLog }: TurnSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [showGuidance, setShowGuidance] = useState(false);
  const explain = useMemo(() => explainTurn(prevState, state, deltaLog, summary), [prevState, state, deltaLog, summary]);
  const REPORT_LINE_DELAY_MS = 450;

  const limit = 5;
  const targetLines = expanded ? summary.lines : summary.lines.slice(0, limit);

  useEffect(() => {
    setShowGuidance(false);
    if (targetLines.length < 1) {
      setRevealedCount(0);
      return;
    }
    setRevealedCount(0);
    const interval = window.setInterval(() => {
      setRevealedCount((current) => {
        if (current >= targetLines.length) {
          window.clearInterval(interval);
          return current;
        }
        return current + 1;
      });
    }, REPORT_LINE_DELAY_MS);
    const guidanceTimer = window.setTimeout(() => {
      setShowGuidance(true);
    }, targetLines.length * REPORT_LINE_DELAY_MS + 200);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(guidanceTimer);
    };
  }, [targetLines]);

  const visibleLines = targetLines.slice(0, revealedCount);

  return (
    <section className="turn-summary">
      <h3>本回合变化</h3>
      <ul>
        {visibleLines.map((line, index) => (
          <li key={`${line}-${index}`}>{line}</li>
        ))}
      </ul>
      {summary.lines.length > limit ? (
        <button type="button" onClick={() => { playMechanicalClick(); setExpanded((prev) => !prev); }}>
          {expanded ? "收起变化" : "展开更多变化"}
        </button>
      ) : null}
      {showGuidance ? <p className="because-line">{explain.becauseLine}</p> : <p className="report-streaming">战报整理中...</p>}
      {showGuidance ? <p className="next-line">{explain.nextStepLine}</p> : null}
      {showGuidance && explain.warningBadges.length > 0 ? (
        <div className="warning-badges">{explain.warningBadges.map((w) => <span key={w}>{w}</span>)}</div>
      ) : null}
    </section>
  );
}
