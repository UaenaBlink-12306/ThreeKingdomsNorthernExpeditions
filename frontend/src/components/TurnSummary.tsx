import { useMemo, useState } from "react";
import type { DiffSummary } from "../utils/diff";
import { explainTurn } from "../utils/explain";
import type { GameState } from "../types";

interface TurnSummaryProps {
  summary: DiffSummary;
  state: GameState;
  prevState: GameState | null;
  deltaLog: string[];
}

export default function TurnSummary({ summary, state, prevState, deltaLog }: TurnSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const explain = useMemo(() => explainTurn(prevState, state, deltaLog, summary), [prevState, state, deltaLog, summary]);

  const limit = 5;
  const visibleLines = expanded ? summary.lines : summary.lines.slice(0, limit);

  return (
    <section className="turn-summary">
      <h3>本回合变化</h3>
      <ul>
        {visibleLines.map((line, index) => (
          <li key={`${line}-${index}`}>{line}</li>
        ))}
      </ul>
      {summary.lines.length > limit ? (
        <button type="button" onClick={() => setExpanded((prev) => !prev)}>
          {expanded ? "收起变化" : "展开更多变化"}
        </button>
      ) : null}
      <p className="because-line">{explain.becauseLine}</p>
      <p className="next-line">{explain.nextStepLine}</p>
      {explain.warningBadges.length > 0 ? (
        <div className="warning-badges">{explain.warningBadges.map((w) => <span key={w}>{w}</span>)}</div>
      ) : null}
    </section>
  );
}
