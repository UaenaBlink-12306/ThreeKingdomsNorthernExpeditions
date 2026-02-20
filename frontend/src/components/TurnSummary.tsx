import type { DiffSummary } from "../utils/diff";

interface TurnSummaryProps {
  summary: DiffSummary;
}

export default function TurnSummary({ summary }: TurnSummaryProps) {
  return (
    <section className="turn-summary">
      <h3>本回合变化 / What changed this turn?</h3>
      <ul>
        {summary.lines.map((line, index) => (
          <li key={`${line}-${index}`}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
