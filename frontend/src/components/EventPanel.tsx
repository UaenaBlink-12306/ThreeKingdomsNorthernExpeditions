import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import type { OptionView } from "../types";
import { AnimatePresence, motion } from "framer-motion";
import { playMechanicalClick, playMechanicalPress } from "../utils/sound";

interface EventPanelProps {
  text: string;
  options: OptionView[];
  busy: boolean;
  dispatching: boolean;
  court_transition_pending: boolean;
  can_next_turn: boolean;
  turn: number;
  onChoose: (optionId: string) => void;
  onNextTurn: () => void;
}

const EVENT_HELP_SEEN_KEY = "seen_event_help";
const EVENT_ONBOARD_SEEN_KEY = "seen_event_micro_onboard";

export default function EventPanel({
  text,
  options,
  busy,
  dispatching,
  court_transition_pending,
  can_next_turn,
  turn,
  onChoose,
  onNextTurn,
}: EventPanelProps) {
  const hasOptions = options.length > 0;
  const allDisabled = hasOptions && options.every((opt) => Boolean(opt.disabled));
  const [hideHint, setHideHint] = useState(() => localStorage.getItem(EVENT_HELP_SEEN_KEY) === "1");
  const [hideOnboard, setHideOnboard] = useState(() => localStorage.getItem(EVENT_ONBOARD_SEEN_KEY) === "1");
  const [dispatchElapsedSec, setDispatchElapsedSec] = useState(0);

  const prompt = useMemo(
    () => (hasOptions ? `你现在要做：选择一个行动（${options.length}）` : "你现在要做：推进回合（触发被动变化）"),
    [hasOptions, options.length]
  );
  const dispatchMessage = useMemo(() => {
    if (!dispatching) {
      return "";
    }
    if (court_transition_pending) {
      if (dispatchElapsedSec < 3) {
        return "指令已下达：即将进入朝堂缓冲区，地图回到成都，正在调取朝堂战报...";
      }
      if (dispatchElapsedSec < 10) {
        return `朝堂文书整理中（已等待 ${dispatchElapsedSec}s）...`;
      }
      return `朝堂数据较多，仍在同步（已等待 ${dispatchElapsedSec}s）。系统仍在处理，请稍候。`;
    }
    if (dispatchElapsedSec < 3) {
      return "指令已下达，正在传令并等待前线回报...";
    }
    if (dispatchElapsedSec < 10) {
      return `战报回传中（已等待 ${dispatchElapsedSec}s）...`;
    }
    return `回报处理较慢（已等待 ${dispatchElapsedSec}s），系统仍在同步。`;
  }, [court_transition_pending, dispatchElapsedSec, dispatching]);

  useEffect(() => {
    if (!dispatching) {
      setDispatchElapsedSec(0);
      return;
    }
    const startedAt = Date.now();
    const tick = () => {
      setDispatchElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    };
    tick();
    const timer = window.setInterval(tick, 300);
    return () => {
      window.clearInterval(timer);
    };
  }, [dispatching]);

  function dismissHint() {
    playMechanicalClick();
    setHideHint(true);
    localStorage.setItem(EVENT_HELP_SEEN_KEY, "1");
  }

  function dismissOnboard() {
    playMechanicalClick();
    setHideOnboard(true);
    localStorage.setItem(EVENT_ONBOARD_SEEN_KEY, "1");
  }

  function onOnboardKeydown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    dismissOnboard();
  }

  return (
    <section className="panel event-panel">
      <h2>当前事件</h2>
      <p className="action-prompt" aria-live="polite">{prompt}</p>
      {dispatching ? (
        <p className="dispatch-status">{dispatchMessage}</p>
      ) : null}
      {!hideOnboard && turn <= 1 ? (
        <div className="event-onboard" onClick={dismissOnboard} onKeyDown={onOnboardKeydown} role="button" tabIndex={0}>
          <div>赢：关中 3/3 且陇右稳定</div>
          <div>输：Doom 链条失败 / 核心失守</div>
          <div>每回合：先看变化 + Because，再决定选项</div>
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        <motion.p
          key={text}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {text}
        </motion.p>
      </AnimatePresence>

      {!hideHint ? (
        <section className="event-cta">
          <p>提示：有选项先决策；无选项时再推进回合。此提示仅显示一次。</p>
          <button type="button" onClick={dismissHint}>知道了</button>
        </section>
      ) : null}

      {!hasOptions ? (
        <button type="button" className="primary-cta" disabled={busy || !can_next_turn} onClick={() => { playMechanicalPress(); onNextTurn(); }}>
          继续下一回合
        </button>
      ) : null}
      {allDisabled ? <small>选项暂不可用，通常是资源或条件不足。</small> : null}

      <div className="options">
        {options.map((opt, index) => (
          <motion.button
            key={opt.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.2 }}
            disabled={busy || Boolean(opt.disabled)}
            onClick={() => { playMechanicalPress(); onChoose(opt.id); }}
          >
            {opt.label}
            {opt.disabled_reason ? `（不可选：${opt.disabled_reason}）` : ""}
          </motion.button>
        ))}
      </div>
    </section>
  );
}
