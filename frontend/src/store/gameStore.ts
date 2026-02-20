import { create } from "zustand";

export const GAME_ID_KEY = "zhuge_game_id";
export const HELP_SEEN_KEY = "zhuge_help_seen_once";
export const HELP_DISABLE_AUTO_KEY = "zhuge_help_disable_auto";

interface GameUiState {
  gameId: string | null;
  busy: boolean;
  error: string;
  helpOpen: boolean;
  audioEnabled: boolean;
  disableAutoHelp: boolean;
  setGameId: (gameId: string | null) => void;
  setBusy: (busy: boolean) => void;
  setError: (error: string) => void;
  setHelpOpen: (helpOpen: boolean) => void;
  setAudioEnabled: (audioEnabled: boolean) => void;
  setDisableAutoHelp: (disable: boolean) => void;
}

export const useGameStore = create<GameUiState>((set) => ({
  gameId: null,
  busy: false,
  error: "",
  helpOpen: false,
  audioEnabled: false,
  disableAutoHelp: false,
  setGameId: (gameId) => set({ gameId }),
  setBusy: (busy) => set({ busy }),
  setError: (error) => set({ error }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setAudioEnabled: (audioEnabled) => set({ audioEnabled }),
  setDisableAutoHelp: (disableAutoHelp) => set({ disableAutoHelp }),
}));
