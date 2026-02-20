import { useEffect, useMemo, useState } from "react";

import { act, getState, newGame } from "./api";
import EventPanel from "./components/EventPanel";
import HeaderBar from "./components/HeaderBar";
import LogPanel from "./components/LogPanel";
import StatusPanel from "./components/StatusPanel";
import EndModal from "./components/EndModal";
import MapPanel from "./components/MapPanel";
import GoalPanel from "./components/GoalPanel";
import HelpDrawer from "./components/HelpDrawer";
import type { GameState } from "./types";
import { diffState } from "./utils/diff";

const GAME_ID_KEY = "zhuge_game_id";
const HELP_SEEN_KEY = "zhuge_help_seen_once";
const HELP_DISABLE_AUTO_KEY = "zhuge_help_disable_auto";

export default function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [prevState, setPrevState] = useState<GameState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [disableAutoHelp, setDisableAutoHelp] = useState(false);

  useEffect(() => {
    void boot();
  }, []);

  useEffect(() => {
    const disableAuto = localStorage.getItem(HELP_DISABLE_AUTO_KEY) === "1";
    const seen = localStorage.getItem(HELP_SEEN_KEY) === "1";
    setDisableAutoHelp(disableAuto);
    if (!disableAuto && !seen) {
      setHelpOpen(true);
      localStorage.setItem(HELP_SEEN_KEY, "1");
    }
  }, []);

  useEffect(() => {
    if (audioEnabled) {
      return;
    }
    const unlockAudio = () => setAudioEnabled(true);
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("touchstart", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
  }, [audioEnabled]);

  const canAct = useMemo(() => Boolean(state && state.outcome === "ONGOING"), [state]);
  const hasDecisionOptions = useMemo(() => (state ? state.current_event.options.length > 0 : false), [state]);
  const canNextTurn = useMemo(() => Boolean(canAct && !hasDecisionOptions), [canAct, hasDecisionOptions]);
  const summary = useMemo(() => (state ? diffState(prevState, state) : null), [prevState, state]);

  function updateHelpAutoPreference(disable: boolean) {
    setDisableAutoHelp(disable);
    localStorage.setItem(HELP_DISABLE_AUTO_KEY, disable ? "1" : "0");
  }

  async function boot() {
    setBusy(true);
    setError("");
    try {
      const savedId = localStorage.getItem(GAME_ID_KEY);
      if (savedId) {
        const existing = await getState(savedId);
        setPrevState(null);
        setState(existing);
      } else {
        const created = await newGame();
        localStorage.setItem(GAME_ID_KEY, created.game_id);
        setPrevState(null);
        setState(created);
      }
    } catch {
      const created = await newGame();
      localStorage.setItem(GAME_ID_KEY, created.game_id);
      setPrevState(null);
      setState(created);
    } finally {
      setBusy(false);
    }
  }

  async function onNewGame() {
    setBusy(true);
    setError("");
    try {
      const created = await newGame();
      localStorage.setItem(GAME_ID_KEY, created.game_id);
      setPrevState(null);
      setState(created);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onChoose(optionId: string) {
    if (!state || !canAct) return;
    setBusy(true);
    setError("");
    try {
      const next = await act(state.game_id, "choose_option", { option_id: optionId });
      setPrevState(state);
      setState(next);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onNextTurn() {
    if (!state || !canNextTurn) return;
    setBusy(true);
    setError("");
    try {
      const next = await act(state.game_id, "next_turn", {});
      setPrevState(state);
      setState(next);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return <main className="app-shell">加载中...</main>;
  }

  return (
    <main className="app-shell">
      <HeaderBar state={state} on_open_help={() => setHelpOpen(true)} />
      <StatusPanel state={state} />
      <GoalPanel state={state} />
      <MapPanel state={state} audioEnabled={audioEnabled} />

      <section className="main-grid">
        <EventPanel
          text={state.current_event.text}
          options={state.current_event.options}
          busy={busy}
          can_next_turn={canNextTurn}
          onChoose={onChoose}
          onNextTurn={onNextTurn}
        />
        {summary ? <LogPanel log={state.log} summary={summary} /> : null}
      </section>

      <section className="panel controls">
        <button disabled={busy} onClick={onNewGame}>新游戏</button>
        <button disabled={busy || !canNextTurn} onClick={onNextTurn}>继续下一回合</button>
        {canAct && hasDecisionOptions ? <span className="control-note">当前有选项可选，先在事件区做决策。</span> : null}
        <span>Game ID: {state.game_id}</span>
      </section>

      {error ? <p className="error">{error}</p> : null}

      <EndModal outcome={state.outcome} onRestart={onNewGame} />
      <HelpDrawer
        open={helpOpen}
        disable_auto_open={disableAutoHelp}
        on_close={() => setHelpOpen(false)}
        on_disable_auto_open_change={updateHelpAutoPreference}
      />
    </main>
  );
}
