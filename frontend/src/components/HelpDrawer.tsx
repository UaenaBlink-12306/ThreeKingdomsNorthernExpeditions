import { AnimatePresence, motion } from "framer-motion";

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
          onClick={on_close}
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
              <h2>玩法帮助</h2>
              <button type="button" onClick={on_close}>
                关闭
              </button>
            </header>
            <ul>
              <li>`campaign`：主动出击与推进战线。</li>
              <li>`recover`：整补兵粮，缓和挫败。</li>
              <li>`court`：朝议与内政，处理政争风险。</li>
              <li>`defense`：防守魏军压力，避免 Doom 爆表。</li>
              <li>`final`：冲击关中并稳固控制回合。</li>
            </ul>
            <p>回合制模拟会出现重复文本。现在可先看“本回合变化”，再按需展开详细日志。</p>
            <p>策略提示：稳粮道、控 Doom、守住陇右，再图关中三回合。</p>

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
