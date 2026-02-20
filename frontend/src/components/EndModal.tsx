import type { Outcome } from "../types";
import { motion } from "framer-motion";

interface EndModalProps {
  outcome: Outcome;
  onRestart: () => void;
}

export default function EndModal({ outcome, onRestart }: EndModalProps) {
  if (outcome === "ONGOING") {
    return null;
  }

  const isWin = outcome === "WIN";
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        className="modal"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <h2>{isWin ? "北伐成功" : "蜀汉覆灭"}</h2>
        <p>{isWin ? "关中稳固三回合且陇右未崩盘。" : "Doom 总攻或核心失守导致终局。"}</p>
        <button onClick={onRestart}>新开一局</button>
      </motion.div>
    </motion.div>
  );
}
