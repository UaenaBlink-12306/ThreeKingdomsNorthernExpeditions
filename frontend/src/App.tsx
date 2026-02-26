import { useMemo } from "react";

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
import { useGameSession } from "./hooks/useGameSession";
import { diffState } from "./utils/diff";
import { playMechanicalPress } from "./utils/sound";

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
    onNewGame,
    onChoose,
    onNextTurn,
    onCourtStrategy,
    onCourtStatement,
    onCourtFastForward,
  } = useGameSession();

  const summary = useMemo(() => (state ? diffState(prevState, state) : null), [prevState, state]);

  if (!state || !summary) {
    return <main className="app-shell">加载中...</main>;
  }

  return (
    <main className="app-shell">
      <HeaderBar state={state} on_open_help={() => setHelpOpen(true)} />
      <ObjectiveStrip state={state} />
      <StatusPanel state={state} prevState={prevState} />
      <GoalPanel state={state} />
      <MapPanel state={state} audioEnabled={audioEnabled} courtTransitionPending={courtTransitionPending} />

      <section className="main-grid">
        <div className="main-column">
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
        <button disabled={busy} onClick={() => { playMechanicalPress(); void onNewGame(); }}>新游戏</button>
        {canAct && hasDecisionOptions ? <span className="control-note">当前有选项可选，先在事件区做决策。</span> : null}
        <span>Game ID: {state.game_id}</span>
      </section>

      {error ? <p className="error">{error}</p> : null}

      <EndModal outcome={state.outcome} onRestart={() => void onNewGame()} />
      <HelpDrawer
        open={helpOpen}
        disable_auto_open={disableAutoHelp}
        on_close={() => setHelpOpen(false)}
        on_disable_auto_open_change={updateHelpAutoPreference}
      />
    </main>
  );
}
