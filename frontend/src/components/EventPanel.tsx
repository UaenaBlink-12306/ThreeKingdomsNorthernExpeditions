import type { OptionView } from "../types";
import { AnimatePresence, motion } from "framer-motion";

interface EventPanelProps {
  text: string;
  options: OptionView[];
  busy: boolean;
  can_next_turn: boolean;
  onChoose: (optionId: string) => void;
  onNextTurn: () => void;
}

export default function EventPanel({
  text,
  options,
  busy,
  can_next_turn,
  onChoose,
  onNextTurn,
}: EventPanelProps) {
  const hasOptions = options.length > 0;
  const allDisabled = hasOptions && options.every((opt) => Boolean(opt.disabled));

  return (
    <section className="panel event-panel">
      <h2>当前事件</h2>
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

      <section className="event-cta">
        <h3>{hasOptions ? "请选择行动 / Choose an option" : "继续下一回合 / Next Turn"}</h3>
        {hasOptions ? (
          <p>此处需要你的决策。做出选择后，剧情才会继续推进。</p>
        ) : (
          <p>当前节点没有分支选项，时间流逝并触发被动变化。</p>
        )}
        {!hasOptions ? (
          <button type="button" className="primary-cta" disabled={busy || !can_next_turn} onClick={onNextTurn}>
            继续下一回合
          </button>
        ) : null}
        {allDisabled ? <small>选项暂不可用，通常是资源或条件不足。</small> : null}
      </section>

      <div className="options">
        {options.map((opt, index) => (
          <motion.button
            key={opt.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.2 }}
            disabled={busy || Boolean(opt.disabled)}
            onClick={() => onChoose(opt.id)}
          >
            {opt.label}
          </motion.button>
        ))}
      </div>
    </section>
  );
}
