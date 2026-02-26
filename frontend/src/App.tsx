import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import EventPanel from "./components/EventPanel";
import HeaderBar from "./components/HeaderBar";
import LogPanel from "./components/LogPanel";
import StatusPanel from "./components/StatusPanel";
import EndModal from "./components/EndModal";
import MapPanel from "./components/MapPanel";
import GoalPanel from "./components/GoalPanel";
import HelpDrawer from "./components/HelpDrawer";
import ObjectiveStrip from "./components/ObjectiveStrip";
import AssistantPanel from "./components/AssistantPanel";
import CourtBufferPanel from "./components/CourtBufferPanel";
import CourtResultPanel from "./components/CourtResultPanel";
import PrologueGuide from "./components/PrologueGuide";
import { useGameSession } from "./hooks/useGameSession";
import { diffState } from "./utils/diff";
import { playMechanicalClick, playMechanicalPress } from "./utils/sound";

const PROLOGUE_SEEN_KEY = "seen_launch_prologue_v1";

function isTypingElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}

export default function App() {
  const {
    state,
    prevState,
    busy,
    error,
    helpOpen,
    audioEnabled,
    disableAutoHelp,
    canAct,
    hasDecisionOptions,
    canNextTurn,
    commandDispatching,
    courtTransitionPending,
    courtActive,
    setHelpOpen,
    updateHelpAutoPreference,
    refreshState,
    onNewGame,
    onChoose,
    onNextTurn,
    onCourtStrategy,
    onCourtStatement,
    onCourtFastForward,
  } = useGameSession();
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle");
  const [showPrologue, setShowPrologue] = useState(false);
  const [sidebarOffset, setSidebarOffset] = useState(0);
  const battleLayoutRef = useRef<HTMLDivElement | null>(null);

  const summary = useMemo(() => (state ? diffState(prevState, state) : null), [prevState, state]);
  const hasCourtResult = useMemo(
    () => Boolean(state?.court.last_resolution || state?.court.active_modifier),
    [state?.court.active_modifier, state?.court.last_resolution]
  );
  const commandStatus = useMemo(() => {
    if (commandDispatching) {
      return "军令传递中，正在等待前线回报...";
    }
    if (busy) {
      return "同步战局中...";
    }
    if (courtActive) {
      return "朝堂议事进行中，请完成朝议流程。";
    }
    if (canAct && hasDecisionOptions) {
      return "当前有可选行动，请先在事件区做决策。";
    }
    if (canNextTurn) {
      return "无可选行动，可直接推进下一回合。";
    }
    return "当前战局已结束，可点击新游戏重新开始。";
  }, [busy, canAct, canNextTurn, commandDispatching, courtActive, hasDecisionOptions]);

  useEffect(() => {
    try {
      setShowPrologue(localStorage.getItem(PROLOGUE_SEEN_KEY) !== "1");
    } catch {
      setShowPrologue(true);
    }
  }, []);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (showPrologue || event.defaultPrevented || event.repeat || isTypingElement(event.target)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "n" && !busy) {
        event.preventDefault();
        playMechanicalPress();
        void onNewGame();
        return;
      }
      if (key === "j" && !busy && canNextTurn && !courtActive) {
        event.preventDefault();
        playMechanicalPress();
        void onNextTurn();
        return;
      }
      if (key === "h") {
        event.preventDefault();
        playMechanicalClick();
        setHelpOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [busy, canNextTurn, courtActive, onNewGame, onNextTurn, setHelpOpen, showPrologue]);

  useEffect(() => {
    let rafId = 0;
    const syncSidebarOffset = () => {
      if (!battleLayoutRef.current) {
        return;
      }
      const nextOffset = Math.max(0, Math.round(battleLayoutRef.current.getBoundingClientRect().top));
      setSidebarOffset((current) => (current === nextOffset ? current : nextOffset));
      rafId = 0;
    };

    const requestSync = () => {
      if (rafId > 0) {
        return;
      }
      rafId = window.requestAnimationFrame(syncSidebarOffset);
    };

    requestSync();
    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync);
    return () => {
      window.removeEventListener("scroll", requestSync);
      window.removeEventListener("resize", requestSync);
      if (rafId > 0) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  function completePrologue() {
    try {
      localStorage.setItem(PROLOGUE_SEEN_KEY, "1");
    } catch {
      // ignore storage errors and allow entering game
    }
    setShowPrologue(false);
  }

  function reopenPrologueFromHelp() {
    setHelpOpen(false);
    setShowPrologue(true);
  }

  async function copyGameId() {
    try {
      await navigator.clipboard.writeText(state?.game_id ?? "");
      setCopyState("done");
    } catch {
      setCopyState("failed");
    } finally {
      window.setTimeout(() => {
        setCopyState("idle");
      }, 1500);
    }
  }

  if (!state || !summary) {
    return (
      <main className="app-shell">
        <section className="panel loading-panel" aria-live="polite">
          正在连接战局...
        </section>
      </main>
    );
  }

  const battleLayoutStyle = { "--sidebar-offset": `${sidebarOffset}px` } as CSSProperties;

  return (
    <main className="app-shell">
      <HeaderBar state={state} on_open_help={() => setHelpOpen(true)} />
      <div className="battle-layout" ref={battleLayoutRef} style={battleLayoutStyle}>
        <aside className="hud-sidebar" aria-label="战局固定侧栏">
          <ObjectiveStrip state={state} />
          <StatusPanel state={state} prevState={prevState} />
        </aside>

        <section className="battle-main">
          <section className="panel system-bar" aria-live="polite">
            <p className="system-status">{commandStatus}</p>
            <div className="system-shortcuts">
              <span>快捷键：N 新游戏</span>
              <span>J 推进回合</span>
              <span>H 帮助</span>
            </div>
          </section>

          <GoalPanel state={state} />
          <MapPanel state={state} audioEnabled={audioEnabled} courtTransitionPending={courtTransitionPending} />

          <section className="main-grid">
            <div className={`main-column ${!courtActive && !hasCourtResult ? "main-column-event-only" : ""}`.trim()}>
              {courtActive ? (
                <div className="court-modal-backdrop">
                  <div className="court-modal">
                    <CourtBufferPanel
                      court={state.court}
                      busy={busy}
                      dispatching={commandDispatching}
                      onSubmitStatement={(statement, strategyHint) => void onCourtStatement(statement, strategyHint)}
                      onQuickStrategy={(strategy) => void onCourtStrategy(strategy)}
                      onFastForward={() => void onCourtFastForward()}
                    />
                  </div>
                </div>
              ) : (
                <EventPanel
                  text={state.current_event.text}
                  options={state.current_event.options}
                  busy={busy}
                  dispatching={commandDispatching}
                  court_transition_pending={courtTransitionPending}
                  can_next_turn={canNextTurn}
                  turn={state.turn}
                  onChoose={onChoose}
                  onNextTurn={onNextTurn}
                />
              )}
              {!courtActive ? <CourtResultPanel court={state.court} /> : null}
            </div>
            <LogPanel
              log={state.log}
              prevLog={prevState?.log ?? []}
              summary={summary}
              state={state}
              prevState={prevState}
              courtTransitionPending={courtTransitionPending}
            />
          </section>
          <AssistantPanel state={state} prevState={prevState} summary={summary} />

          <section className="panel controls">
            <div className="control-actions">
              <button disabled={busy} onClick={() => { playMechanicalPress(); void onNewGame(); }}>新游戏（N）</button>
              <button
                type="button"
                className="primary-cta"
                disabled={busy || !canNextTurn || courtActive}
                onClick={() => { playMechanicalPress(); void onNextTurn(); }}
              >
                推进回合（J）
              </button>
              <button disabled={busy} onClick={() => { playMechanicalClick(); void refreshState(); }}>刷新状态</button>
              <button type="button" onClick={() => { playMechanicalClick(); setHelpOpen(true); }}>帮助（H）</button>
            </div>
            <div className="control-meta">
              {canAct && hasDecisionOptions ? <span className="control-note">当前有选项可选，先在事件区做决策。</span> : null}
              <span className="game-id-text">Game ID: {state.game_id}</span>
              <button type="button" onClick={() => { playMechanicalClick(); void copyGameId(); }}>复制 Game ID</button>
              {copyState === "done" ? <span className="copy-feedback">已复制</span> : null}
              {copyState === "failed" ? <span className="copy-feedback copy-feedback-failed">复制失败，请手动复制</span> : null}
            </div>
          </section>

          {error ? (
            <section className="error" aria-live="assertive">
              <p>{error}</p>
              <div className="error-actions">
                <button type="button" disabled={busy} onClick={() => { playMechanicalPress(); void refreshState(); }}>
                  重试同步
                </button>
              </div>
            </section>
          ) : null}
        </section>
      </div>

      <EndModal outcome={state.outcome} onRestart={() => void onNewGame()} />
      <PrologueGuide open={showPrologue} onFinish={completePrologue} />
      <HelpDrawer
        open={helpOpen}
        disable_auto_open={disableAutoHelp}
        on_close={() => setHelpOpen(false)}
        on_disable_auto_open_change={updateHelpAutoPreference}
        on_reopen_prologue={reopenPrologueFromHelp}
      />
    </main>
  );
}
