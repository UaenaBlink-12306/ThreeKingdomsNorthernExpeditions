import { AnimatePresence, motion } from "framer-motion";
import { playMechanicalClick } from "../utils/sound";

interface HelpDrawerProps {
  open: boolean;
  disable_auto_open: boolean;
  on_close: () => void;
  on_disable_auto_open_change: (value: boolean) => void;
}

export default function HelpDrawer({
  open,
  disable_auto_open,
  on_close,
  on_disable_auto_open_change,
}: HelpDrawerProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="help-drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => { playMechanicalClick(); on_close(); }}
        >
          <motion.aside
            className="help-drawer panel"
            initial={{ x: 320, opacity: 0.2 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ duration: 0.24 }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="help-header">
              <h2>术语与阶段参考</h2>
              <button type="button" onClick={() => { playMechanicalClick(); on_close(); }}>关闭</button>
            </header>
            <ul>
              <li>campaign：主动推进战线。</li>
              <li>recover：整补兵粮，回收损失。</li>
              <li>court：处理朝议与政争。</li>
              <li>defense：压制魏军攻势，防 Doom 上升。</li>
              <li>final：冲击并稳固关中回合。</li>
            </ul>
            <p>建议阅读顺序：目标条 → 本回合变化 + Because → 本回合战报。</p>

            <label className="help-checkbox">
              <input
                type="checkbox"
                checked={disable_auto_open}
                onChange={(event) => on_disable_auto_open_change(event.target.checked)}
              />
              不再自动弹出（仍可用右上角 Help 打开）
            </label>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
