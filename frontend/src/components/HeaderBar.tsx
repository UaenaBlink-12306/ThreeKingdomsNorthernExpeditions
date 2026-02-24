import { useState } from "react";
import type { GameState } from "../types";
import { playMechanicalClick } from "../utils/sound";
import SoundSelector from "./SoundSelector";

interface HeaderBarProps {
  state: GameState;
  on_open_help: () => void;
}

export default function HeaderBar({ state, on_open_help }: HeaderBarProps) {
  const [showSoundSelector, setShowSoundSelector] = useState(false);

  return (
    <>
      <header className="panel header-bar">
        <div className="header-top-row">
          <h1>诸葛亮北伐：夺取关中与陇右</h1>
          <div className="header-buttons">
            <button
              type="button"
              className="help-btn"
              onClick={() => { playMechanicalClick(); setShowSoundSelector(true); }}
              title="选择音效"
            >
              🔊
            </button>
            <button type="button" className="help-btn" onClick={() => { playMechanicalClick(); on_open_help(); }}>
              Help
            </button>
          </div>
        </div>
        <div className="header-meta">
          <span>章节 {state.chapter}</span>
          <span>回合 {state.turn}</span>
          <span>阶段 {state.phase}</span>
        </div>
      </header>
      {showSoundSelector && <SoundSelector onClose={() => setShowSoundSelector(false)} />}
    </>
  );
}
