import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Howl } from "howler";
import { useEffect, useMemo, useRef, useState } from "react";
import type L from "leaflet";

import type { GameState, Outcome } from "../types";
import { PLACE_MAP } from "../places";
import successSfx from "../assets/audio/check_success.wav";
import failSfx from "../assets/audio/check_fail.wav";
import winSfx from "../assets/audio/win.wav";
import defeatSfx from "../assets/audio/defeat.wav";
import { reportConsoleError } from "../utils/errorLogger";

interface FxOverlayProps {
  map: L.Map | null;
  state: GameState;
  audioEnabled: boolean;
}

type BurstKind = "success" | "fail";

interface Burst {
  id: number;
  x: number;
  y: number;
  kind: BurstKind;
}

function getAppendedLogs(prev: string[], curr: string[]): string[] {
  if (prev.length === 0) {
    return curr;
  }
  const maxOverlap = Math.min(prev.length, curr.length);
  for (let overlap = maxOverlap; overlap >= 0; overlap -= 1) {
    let match = true;
    for (let i = 0; i < overlap; i += 1) {
      if (prev[prev.length - overlap + i] !== curr[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      return curr.slice(overlap);
    }
  }
  return curr;
}

export default function FxOverlay({ map, state, audioEnabled }: FxOverlayProps) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [shake, setShake] = useState(false);
  const [routeFlash, setRouteFlash] = useState(false);
  const idRef = useRef(0);
  const prevLogsRef = useRef<string[]>([]);
  const pendingTokensRef = useRef<string[]>([]);
  const lastOutcomeFxRef = useRef<Outcome | null>(null);

  const sounds = useMemo(
    () => ({
      success: new Howl({ src: [successSfx], volume: 0.5 }),
      fail: new Howl({ src: [failSfx], volume: 0.5 }),
      win: new Howl({ src: [winSfx], volume: 0.6 }),
      defeat: new Howl({ src: [defeatSfx], volume: 0.6 }),
    }),
    []
  );

  useEffect(() => {
    return () => {
      sounds.success.unload();
      sounds.fail.unload();
      sounds.win.unload();
      sounds.defeat.unload();
    };
  }, [sounds]);

  function playSound(kind: "success" | "fail" | "win" | "defeat") {
    if (!audioEnabled) {
      return;
    }
    try {
      sounds[kind].play();
    } catch (err) {
      reportConsoleError("fx.play_sound_failed", err, { kind });
    }
  }

  function spawnBurst(placeId: string, kind: BurstKind, allowQueue = true) {
    const place = PLACE_MAP[placeId];
    if (!place) {
      return;
    }
    if (!map) {
      if (allowQueue) {
        pendingTokensRef.current.push(`FX_CHECK|node=pending|result=${kind === "success" ? "SUCCESS" : "FAIL"}|loc=${placeId}`);
      }
      return;
    }
    const point = map.latLngToContainerPoint([place.lat, place.lng]);
    const id = idRef.current + 1;
    idRef.current = id;
    setBursts((prev) => [...prev, { id, x: point.x, y: point.y, kind }]);
    window.setTimeout(() => {
      setBursts((prev) => prev.filter((item) => item.id !== id));
    }, 850);
  }

  function triggerOutcomeFx(outcome: Outcome) {
    if (outcome === "ONGOING") {
      lastOutcomeFxRef.current = null;
      return;
    }
    if (lastOutcomeFxRef.current === outcome) {
      return;
    }
    lastOutcomeFxRef.current = outcome;

    if (outcome === "WIN") {
      playSound("win");
      confetti({
        particleCount: 160,
        spread: 80,
        origin: { x: 0.5, y: 0.28 },
      });
      return;
    }
    playSound("defeat");
  }

  function processToken(token: string, allowQueue = true) {
    if (!token.startsWith("FX_")) {
      return;
    }
    if (token.startsWith("FX_CHECK|")) {
      const m = token.match(/^FX_CHECK\|node=([^|]+)\|result=(SUCCESS|FAIL)\|loc=([^|]+)$/);
      if (!m) {
        return;
      }
      const result = m[2];
      const loc = m[3];
      if (result === "SUCCESS") {
        spawnBurst(loc, "success", allowQueue);
        playSound("success");
      } else {
        spawnBurst(loc, "fail", allowQueue);
        playSound("fail");
        setShake(true);
        window.setTimeout(() => setShake(false), 180);
      }
      return;
    }
    if (token.startsWith("FX_ROUTE|")) {
      setRouteFlash(true);
      window.setTimeout(() => setRouteFlash(false), 420);
      return;
    }
    if (token.startsWith("FX_OUTCOME|")) {
      const m = token.match(/^FX_OUTCOME\|result=(WIN|DEFEAT_SHU)$/);
      if (!m) {
        return;
      }
      triggerOutcomeFx(m[1] as Outcome);
    }
  }

  useEffect(() => {
    const newLogs = getAppendedLogs(prevLogsRef.current, state.log);
    prevLogsRef.current = [...state.log];
    for (const line of newLogs) {
      processToken(line);
    }
  }, [state.log]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!map || pendingTokensRef.current.length < 1) {
      return;
    }
    const queued = [...pendingTokensRef.current];
    pendingTokensRef.current = [];
    for (const token of queued) {
      processToken(token, false);
    }
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    triggerOutcomeFx(state.outcome);
  }, [state.outcome]); // eslint-disable-line react-hooks/exhaustive-deps

  const ashParticles = useMemo(() => Array.from({ length: 16 }, (_, idx) => idx), []);

  return (
    <div className={`fx-overlay ${shake ? "fx-shake" : ""}`}>
      <AnimatePresence>
        {routeFlash ? (
          <motion.div
            key="route-flash"
            className="fx-route-flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {bursts.map((burst) => (
          <motion.div
            key={burst.id}
            className={`fx-impact fx-impact-${burst.kind}`}
            style={{ left: burst.x, top: burst.y }}
            initial={{ opacity: 0, scale: 0.1 }}
            animate={{ opacity: 1, scale: 1.35 }}
            exit={{ opacity: 0, scale: 2.1 }}
            transition={{ duration: 0.55 }}
          />
        ))}
      </AnimatePresence>

      {state.outcome === "WIN" ? (
        <motion.div
          className="fx-outcome fx-outcome-win"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45 }}
        >
          <h3>Victory</h3>
          <p>关中与陇右双线稳固，北伐达成。</p>
        </motion.div>
      ) : null}

      {state.outcome === "DEFEAT_SHU" ? (
        <motion.div
          className="fx-outcome fx-outcome-defeat"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.55 }}
        >
          <h3>政权覆灭</h3>
          <p>蜀汉核心防线断裂，天下局势逆转。</p>
          <div className="ash-layer">
            {ashParticles.map((item) => (
              <span
                key={item}
                className="ash"
                style={{
                  left: `${(item * 37) % 100}%`,
                  animationDelay: `${(item * 0.17) % 1.4}s`,
                  animationDuration: `${4 + (item % 5) * 0.55}s`,
                }}
              />
            ))}
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
