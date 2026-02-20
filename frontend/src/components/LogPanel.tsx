import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TurnSummary from "./TurnSummary";
import type { DiffSummary } from "../utils/diff";
import { compressLog } from "../utils/log";

interface LogPanelProps {
  log: string[];
  summary: DiffSummary;
}

export default function LogPanel({ log, summary }: LogPanelProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const playerFacingLogs = useMemo(
    () => [...log].filter((entry) => !entry.startsWith("FX_")).slice(-60),
    [log]
  );

  const compressed = useMemo(() => compressLog(playerFacingLogs), [playerFacingLogs]);

  const preview = useMemo(() => compressed.slice(-6).reverse(), [compressed]);
  const compressedDetails = useMemo(() => compressed.slice(-20).reverse(), [compressed]);
  const rawDetails = useMemo(() => [...log].slice(-35).reverse(), [log]);

  return (
    <aside className="panel log-panel">
      <h2>回合总结与战报</h2>
      <TurnSummary summary={summary} />

      <div className="log-toolbar">
        <button type="button" onClick={() => setShowDetails((prev) => !prev)}>
          {showDetails ? "收起细节" : "Show details"}
        </button>
        {showDetails ? (
          <label className="raw-toggle">
            <input type="checkbox" checked={showRaw} onChange={(event) => setShowRaw(event.target.checked)} />
            显示原始日志（含 FX token）
          </label>
        ) : null}
      </div>

      {!showDetails ? (
        <ul className="log-preview">
          {preview.map((entry, index) => (
            <li key={`${entry.text}-${index}`}>
              {entry.text}
              {entry.count > 1 ? ` ×${entry.count}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <ul>
          <AnimatePresence initial={false}>
            {(showRaw ? rawDetails : compressedDetails).map((entry, index) => {
              const text = typeof entry === "string" ? entry : entry.text;
              const count = typeof entry === "string" ? 1 : entry.count;
              return (
                <motion.li
                  key={`${text}-${index}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                >
                  {text}
                  {count > 1 ? ` ×${count}` : ""}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </aside>
  );
}
