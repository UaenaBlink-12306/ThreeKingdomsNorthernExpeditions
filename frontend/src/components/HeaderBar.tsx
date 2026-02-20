import type { GameState } from "../types";

interface HeaderBarProps {
  state: GameState;
  on_open_help: () => void;
}

export default function HeaderBar({ state, on_open_help }: HeaderBarProps) {
  return (
    <header className="panel header-bar">
      <div className="header-top-row">
        <h1>诸葛亮北伐：夺取关中与陇右</h1>
        <button type="button" className="help-btn" onClick={on_open_help}>
          Help
        </button>
      </div>
      <div className="header-meta">
        <span>章节 {state.chapter}</span>
        <span>回合 {state.turn}</span>
        <span>阶段 {state.phase}</span>
      </div>
    </header>
  );
}
