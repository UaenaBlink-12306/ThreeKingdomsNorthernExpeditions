import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { act, getState, newGame } from "../api";
import type { GameState } from "../types";
import {
  GAME_ID_KEY,
  HELP_DISABLE_AUTO_KEY,
  HELP_SEEN_KEY,
  useGameStore,
} from "../store/gameStore";

function formatErrorMessage(scope: string, err: unknown): string {
  const detail = err instanceof Error ? err.message : String(err);
  return `[${scope}] ${detail}`;
}

export function useGameSession() {
  const queryClient = useQueryClient();
  const [prevState, setPrevState] = useState<GameState | null>(null);

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
    async function boot() {
      setError("");
      const savedId = localStorage.getItem(GAME_ID_KEY);
      if (!savedId) {
        await createGameMutation.mutateAsync();
        return;
      }

      try {
        await queryClient.fetchQuery({
          queryKey: ["game", savedId],
          queryFn: () => getState(savedId),
          retry: 3,
          retryDelay: (attemptIndex) => Math.min(300 * 2 ** attemptIndex, 3_000),
          staleTime: 30_000,
        });
        setGameId(savedId);
      } catch {
        await createGameMutation.mutateAsync();
      }
    }

    void boot();
  }, [createGameMutation, queryClient, setError, setGameId]);

  useEffect(() => {
    const nextBusy = stateQuery.isFetching || createGameMutation.isPending || actMutation.isPending;
    setBusy(nextBusy);
  }, [actMutation.isPending, createGameMutation.isPending, setBusy, stateQuery.isFetching]);

  useEffect(() => {
    if (stateQuery.isError) {
      setError(formatErrorMessage("state", stateQuery.error));
    }
  }, [setError, stateQuery.error, stateQuery.isError]);

  const state = useMemo(() => {
    if (!gameId) {
      return null;
    }
    return (queryClient.getQueryData(["game", gameId]) as GameState | undefined) ?? stateQuery.data ?? null;
  }, [gameId, queryClient, stateQuery.data]);

  const canAct = Boolean(state && state.outcome === "ONGOING");
  const hasDecisionOptions = state ? state.current_event.options.length > 0 : false;
  const canNextTurn = Boolean(canAct && !hasDecisionOptions);

  async function onNewGame() {
    setError("");
    await createGameMutation.mutateAsync();
  }

  async function onChoose(optionId: string) {
    if (!state || !canAct) {
      return;
    }
    setPrevState(state);
    await actMutation.mutateAsync({
      currentGameId: state.game_id,
      action: "choose_option",
      payload: { option_id: optionId },
    });
  }

  async function onNextTurn() {
    if (!state || !canNextTurn) {
      return;
    }
    setPrevState(state);
    await actMutation.mutateAsync({
      currentGameId: state.game_id,
      action: "next_turn",
      payload: {},
    });
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
    setHelpOpen,
    updateHelpAutoPreference,
    onNewGame,
    onChoose,
    onNextTurn,
  };
}
