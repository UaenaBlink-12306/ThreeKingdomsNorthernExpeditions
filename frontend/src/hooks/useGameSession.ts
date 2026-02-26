import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { act, getState, newGame } from "../api";
import type { CourtStrategy, GameState } from "../types";
import {
  GAME_ID_KEY,
  HELP_DISABLE_AUTO_KEY,
  HELP_SEEN_KEY,
  useGameStore,
} from "../store/gameStore";
import { reportConsoleError } from "../utils/errorLogger";

const STATE_SCHEMA_VERSION = "court-buffer-v1";
const STATE_SCHEMA_KEY = "zhuge_state_schema_version";
const COURT_TRANSITION_OPTION_IDS = new Set(["forced_levy", "back_to_court", "reorganize"]);

function formatErrorMessage(scope: string, err: unknown): string {
  const detail = err instanceof Error ? err.message : String(err);
  return `[${scope}] ${detail}`;
}

const COMMAND_DISPATCH_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function shouldLikelyEnterCourtOnNextTurn(state: GameState): boolean {
  if (state.court.is_active || state.outcome !== "ONGOING") {
    return false;
  }
  if (!["campaign", "defense", "final"].includes(state.phase)) {
    return false;
  }
  if (state.turn <= 1) {
    return false;
  }
  const turnsSince = state.turn - state.court.last_trigger_turn;
  const cadenceDue = turnsSince >= 3;
  const critical =
    state.food <= 62 ||
    state.morale <= 45 ||
    state.doom >= 8 ||
    state.court.momentum <= -2 ||
    state.longyou_collapsed;
  return cadenceDue || critical;
}

function shouldLikelyEnterCourtOnChoose(state: GameState, optionId: string): boolean {
  if (COURT_TRANSITION_OPTION_IDS.has(optionId)) {
    return true;
  }
  const option = state.current_event.options.find((item) => item.id === optionId);
  if (!option) {
    return false;
  }
  return /朝堂|回朝|朝局/.test(option.label);
}

export function useGameSession() {
  const queryClient = useQueryClient();
  const [prevState, setPrevState] = useState<GameState | null>(null);
  const [commandDispatching, setCommandDispatching] = useState(false);
  const [courtTransitionPending, setCourtTransitionPending] = useState(false);
  const lastStateErrorRef = useRef("");

  const {
    gameId,
    busy,
    error,
    helpOpen,
    audioEnabled,
    disableAutoHelp,
    setGameId,
    setBusy,
    setError,
    setHelpOpen,
    setAudioEnabled,
    setDisableAutoHelp,
  } = useGameStore();

  const stateQuery = useQuery({
    queryKey: ["game", gameId],
    queryFn: () => getState(gameId as string),
    enabled: Boolean(gameId),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(300 * 2 ** attemptIndex, 3_000),
    staleTime: 30_000,
  });

  const createGameMutation = useMutation({
    mutationFn: () => newGame(),
    onSuccess: (created) => {
      localStorage.setItem(GAME_ID_KEY, created.game_id);
      setPrevState(null);
      setGameId(created.game_id);
      queryClient.setQueryData(["game", created.game_id], created);
      setError("");
    },
    onError: (err) => {
      reportConsoleError("game.new_game_failed", err);
      setError(formatErrorMessage("new_game", err));
    },
  });

  const actMutation = useMutation({
    mutationFn: ({ currentGameId, action, payload }: { currentGameId: string; action: string; payload?: Record<string, unknown> }) =>
      act(currentGameId, action, payload),
    retry: false,
    onSuccess: (next, variables) => {
      queryClient.setQueryData(["game", variables.currentGameId], next);
      setError("");
    },
    onError: (err) => {
      reportConsoleError("game.act_failed", err);
      setError(formatErrorMessage("act", err));
    },
  });

  useEffect(() => {
    const disableAuto = localStorage.getItem(HELP_DISABLE_AUTO_KEY) === "1";
    const seen = localStorage.getItem(HELP_SEEN_KEY) === "1";
    setDisableAutoHelp(disableAuto);
    if (!disableAuto && !seen) {
      setHelpOpen(true);
      localStorage.setItem(HELP_SEEN_KEY, "1");
    }
  }, [setDisableAutoHelp, setHelpOpen]);

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
  }, [audioEnabled, setAudioEnabled]);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      if (!mounted) return;
      setError("");
      const storedSchemaVersion = localStorage.getItem(STATE_SCHEMA_KEY);
      if (storedSchemaVersion !== STATE_SCHEMA_VERSION) {
        localStorage.setItem(STATE_SCHEMA_KEY, STATE_SCHEMA_VERSION);
        localStorage.removeItem(GAME_ID_KEY);
      }
      const savedId = localStorage.getItem(GAME_ID_KEY);
      if (!savedId) {
        await createGameMutation.mutateAsync();
        return;
      }

      // 清理game_id格式，移除可能的冒号和数字后缀
      const cleanGameId = savedId.split(':')[0].trim();
      if (cleanGameId !== savedId) {
        localStorage.setItem(GAME_ID_KEY, cleanGameId);
      }

      try {
        await queryClient.fetchQuery({
          queryKey: ["game", cleanGameId],
          queryFn: () => getState(cleanGameId),
          retry: 3,
          retryDelay: (attemptIndex) => Math.min(300 * 2 ** attemptIndex, 3_000),
          staleTime: 30_000,
        });
        if (mounted) {
          setGameId(cleanGameId);
        }
      } catch (err) {
        reportConsoleError("game.boot_restore_failed", err, { savedId });
        if (mounted) {
          // 如果game_id无效，清除localStorage并创建新游戏
          localStorage.removeItem(GAME_ID_KEY);
          await createGameMutation.mutateAsync();
        }
      }
    }

    void boot();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  useEffect(() => {
    const nextBusy =
      stateQuery.isFetching ||
      createGameMutation.isPending ||
      actMutation.isPending ||
      commandDispatching;
    setBusy(nextBusy);
  }, [actMutation.isPending, commandDispatching, createGameMutation.isPending, setBusy, stateQuery.isFetching]);

  useEffect(() => {
    if (stateQuery.isError) {
      const message = formatErrorMessage("state", stateQuery.error);
      setError(message);
      if (lastStateErrorRef.current !== message) {
        reportConsoleError("game.state_query_failed", stateQuery.error, {
          gameId,
        });
        lastStateErrorRef.current = message;
      }
      return;
    }
    lastStateErrorRef.current = "";
  }, [gameId, setError, stateQuery.error, stateQuery.isError]);

  const state = useMemo(() => {
    if (!gameId) {
      return null;
    }
    return (queryClient.getQueryData(["game", gameId]) as GameState | undefined) ?? stateQuery.data ?? null;
  }, [gameId, queryClient, stateQuery.data]);

  const canAct = Boolean(state && state.outcome === "ONGOING");
  const courtActive = Boolean(state && state.court.is_active);
  const hasDecisionOptions = state ? !courtActive && state.current_event.options.length > 0 : false;
  const canNextTurn = Boolean(canAct && !hasDecisionOptions && !courtActive);

  useEffect(() => {
    if (courtActive) {
      setCourtTransitionPending(false);
    }
  }, [courtActive]);

  async function onNewGame() {
    setError("");
    setCommandDispatching(true);
    try {
      await sleep(COMMAND_DISPATCH_DELAY_MS);
      await createGameMutation.mutateAsync();
    } catch (err) {
      reportConsoleError("game.on_new_game_failed", err);
      // Error is already propagated to UI state via mutation onError.
    } finally {
      setCommandDispatching(false);
    }
  }

  async function onChoose(optionId: string) {
    if (!state || !canAct || state.court.is_active) {
      return;
    }
    setPrevState(state);
    setCourtTransitionPending(shouldLikelyEnterCourtOnChoose(state, optionId));
    setCommandDispatching(true);
    try {
      await sleep(COMMAND_DISPATCH_DELAY_MS);
      await actMutation.mutateAsync({
        currentGameId: state.game_id,
        action: "choose_option",
        payload: { option_id: optionId },
      });
    } catch (err) {
      reportConsoleError("game.on_choose_failed", err, {
        gameId: state.game_id,
        optionId,
      });
      // Error is already propagated to UI state via mutation onError.
    } finally {
      setCourtTransitionPending(false);
      setCommandDispatching(false);
    }
  }

  async function onNextTurn() {
    if (!state || !canNextTurn || state.court.is_active) {
      return;
    }
    setPrevState(state);
    setCourtTransitionPending(shouldLikelyEnterCourtOnNextTurn(state));
    setCommandDispatching(true);
    try {
      await sleep(COMMAND_DISPATCH_DELAY_MS);
      await actMutation.mutateAsync({
        currentGameId: state.game_id,
        action: "next_turn",
        payload: {},
      });
    } catch (err) {
      reportConsoleError("game.on_next_turn_failed", err, {
        gameId: state.game_id,
      });
      // Error is already propagated to UI state via mutation onError.
    } finally {
      setCourtTransitionPending(false);
      setCommandDispatching(false);
    }
  }

  async function onCourtStrategy(strategy: CourtStrategy) {
    if (!state || !state.court.is_active || !canAct) {
      return;
    }
    setPrevState(state);
    setCommandDispatching(true);
    try {
      await sleep(COMMAND_DISPATCH_DELAY_MS);
      await actMutation.mutateAsync({
        currentGameId: state.game_id,
        action: "court_strategy",
        payload: { strategy },
      });
    } catch (err) {
      reportConsoleError("game.on_court_strategy_failed", err, {
        gameId: state.game_id,
        strategy,
      });
      // Error is already propagated to UI state via mutation onError.
    } finally {
      setCommandDispatching(false);
    }
  }

  async function onCourtStatement(statement: string, strategyHint?: CourtStrategy) {
    if (!state || !state.court.is_active || !canAct) {
      return;
    }
    const trimmed = statement.trim();
    if (!trimmed) {
      return;
    }
    setPrevState(state);
    setCommandDispatching(true);
    try {
      await sleep(COMMAND_DISPATCH_DELAY_MS);
      await actMutation.mutateAsync({
        currentGameId: state.game_id,
        action: "court_statement",
        payload: {
          statement: trimmed,
          strategy_hint: strategyHint,
        },
      });
    } catch (err) {
      reportConsoleError("game.on_court_statement_failed", err, {
        gameId: state.game_id,
        statement: trimmed,
        strategyHint,
      });
      // Error is already propagated to UI state via mutation onError.
    } finally {
      setCommandDispatching(false);
    }
  }

  async function onCourtFastForward() {
    if (!state || !state.court.is_active || !canAct) {
      return;
    }
    setPrevState(state);
    setCommandDispatching(true);
    try {
      await sleep(260);
      await actMutation.mutateAsync({
        currentGameId: state.game_id,
        action: "court_fast_forward",
        payload: {},
      });
    } catch (err) {
      reportConsoleError("game.on_court_fast_forward_failed", err, {
        gameId: state.game_id,
      });
      // Error is already propagated to UI state via mutation onError.
    } finally {
      setCommandDispatching(false);
    }
  }

  function updateHelpAutoPreference(disable: boolean) {
    setDisableAutoHelp(disable);
    localStorage.setItem(HELP_DISABLE_AUTO_KEY, disable ? "1" : "0");
  }

  return {
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
    commandDispatching,
    courtTransitionPending,
    courtActive,
    setHelpOpen,
    updateHelpAutoPreference,
    onNewGame,
    onChoose,
    onNextTurn,
    onCourtStrategy,
    onCourtStatement,
    onCourtFastForward,
  };
}
