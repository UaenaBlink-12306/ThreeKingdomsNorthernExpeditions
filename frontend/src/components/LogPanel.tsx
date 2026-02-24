import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TurnSummary from "./TurnSummary";
import type { DiffSummary } from "../utils/diff";
import { compressLog } from "../utils/log";
import { computeLogDelta } from "../utils/logDelta";
import type { GameState } from "../types";
import { playMechanicalClick } from "../utils/sound";

interface LogPanelProps {
  log: string[];
  prevLog: string[];
  summary: DiffSummary;
  state: GameState;
  prevState: GameState | null;
}

export default function LogPanel({ log, prevLog, summary, state, prevState }: LogPanelProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [tab, setTab] = useState<"delta" | "history">("delta");
  const [revealedDetailCount, setRevealedDetailCount] = useState(0);
  const DETAIL_LINE_DELAY_MS = 400;

  const deltaLog = useMemo(() => computeLogDelta(prevLog, log), [prevLog, log]);

  const playerFacingDelta = useMemo(
    () => [...deltaLog].filter((entry) => showRaw || !entry.startsWith("FX_")).slice(-60),
    [deltaLog, showRaw]
  );
  const playerFacingHistory = useMemo(
    () => [...log].filter((entry) => showRaw || !entry.startsWith("FX_")).slice(-60),
    [log, showRaw]
  );

  const prioritizedDelta = useMemo(() => {
    const priority = (line: string) => {
      if (/终局|阶段变化|章节变化/.test(line)) return 0;
      if (/关中|陇右|崩盘/.test(line)) return 1;
      if (/Doom|粮草|士气|政争|魏压/.test(line)) return 2;
      if (/检定\[/.test(line)) return 3;
      return 4;
    };
    return [...playerFacingDelta].sort((a, b) => priority(a) - priority(b));
  }, [playerFacingDelta]);

  const detailList = useMemo(
    () => compressLog(tab === "delta" ? prioritizedDelta : playerFacingHistory).slice(-25).reverse(),
    [tab, prioritizedDelta, playerFacingHistory]
  );
  const visibleDetailList = detailList.slice(0, revealedDetailCount);

  useEffect(() => {
    if (detailList.length < 1) {
      setRevealedDetailCount(0);
      return;
    }
    setRevealedDetailCount(0);
    const interval = window.setInterval(() => {
      setRevealedDetailCount((current) => {
        if (current >= detailList.length) {
          window.clearInterval(interval);
          return current;
        }
        return current + 1;
      });
    }, DETAIL_LINE_DELAY_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, [detailList]);

  return (
    <aside className="panel log-panel">
      <h2>回合总结与战报</h2>
      <TurnSummary summary={summary} state={state} prevState={prevState} deltaLog={prioritizedDelta} />

      <div className="log-toolbar">
        <div className="tabs">
          <button type="button" onClick={() => { playMechanicalClick(); setTab("delta"); }} disabled={tab === "delta"}>本回合战报（新增）</button>
          <button type="button" onClick={() => { playMechanicalClick(); setTab("history"); }} disabled={tab === "history"}>最近战报（历史）</button>
        </div>
        <label className="raw-toggle">
          <input type="checkbox" checked={showRaw} onChange={(event) => setShowRaw(event.target.checked)} />
          显示原始日志
        </label>
      </div>

      <ul>
        <AnimatePresence initial={false}>
          {visibleDetailList.map((entry, index) => (
            <motion.li
              key={`${entry.text}-${index}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              {entry.text}
              {entry.count > 1 ? ` ×${entry.count}` : ""}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {revealedDetailCount < detailList.length ? <p className="report-streaming">战报传输中...</p> : null}
    </aside>
  );
}
