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
import { useGameSession } from "./hooks/useGameSession";
import { diffState } from "./utils/diff";

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
    setHelpOpen,
    updateHelpAutoPreference,
    onNewGame,
    onChoose,
    onNextTurn,
  } = useGameSession();

  const summary = useMemo(() => (state ? diffState(prevState, state) : null), [prevState, state]);

  if (!state) {
    return <main className="app-shell">加载中...</main>;
  }

  return (
    <main className="app-shell">
      <HeaderBar state={state} on_open_help={() => setHelpOpen(true)} />
      <ObjectiveStrip state={state} />
      <StatusPanel state={state} prevState={prevState} />
      <GoalPanel state={state} />
      <MapPanel state={state} audioEnabled={audioEnabled} />

      <section className="main-grid">
        <EventPanel
          text={state.current_event.text}
          options={state.current_event.options}
          busy={busy}
          can_next_turn={canNextTurn}
          turn={state.turn}
          onChoose={onChoose}
          onNextTurn={onNextTurn}
        />
        {summary ? <LogPanel log={state.log} prevLog={prevState?.log ?? []} summary={summary} state={state} prevState={prevState} /> : null}
      </section>

      <section className="panel controls">
        <button disabled={busy} onClick={() => void onNewGame()}>新游戏</button>
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
