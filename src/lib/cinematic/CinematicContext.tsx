"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * CinematicContext — owns the 0–6s cinematic intro clock.
 *
 * Why a context (not just a hook):
 *   - Camera rig, ShootingStar, ParticleText, Shockwave, and SkipIntro all
 *     need to share the SAME wall-clock so beats align to the frame.
 *   - The clock must be pause/skippable from any UI surface.
 *   - Scroll must be locked while the cinematic plays — page.tsx reads phase
 *     from here to toggle <body overflow:hidden>.
 *
 * Time vs frames:
 *   - We expose `elapsed` as a *ref* (no re-renders) for tight loop reads
 *     inside useFrame. Components that need re-render on phase change
 *     subscribe to `phase` state instead.
 *
 * Spec timings (Director's Script, Zone 1):
 *   Beat 1  Streak           0.0s → 1.5s
 *   Beat 2  Deceleration     1.5s → 2.5s
 *   Beat 3  Shattering       2.5s → 4.5s
 *   Beat 4  Lingering scar   4.5s → 6.0s  (transition into Zone 2 idle)
 *   Total                              6.0s
 *
 * On skip: phase → "done", elapsed jumps to TOTAL, particles get to lock
 * to their final positions (handled inside ParticleText), UI cross-fades
 * over 400ms (handled in page.tsx via Framer Motion).
 */

export const CINEMATIC_DURATION = 6.0; // seconds

export type CinematicPhase = "intro" | "done";

interface CinematicValue {
  phase: CinematicPhase;
  /** Monotonic seconds since cinematic start. Ref — never causes rerenders. */
  elapsed: React.MutableRefObject<number>;
  /** True after the user (or auto-completion) ends the intro. */
  isDone: boolean;
  /** Force-end the cinematic immediately. Idempotent. */
  skip: () => void;
  /** Set by ShootingStar so CameraRig can follow it during Beats 1–2. */
  starPositionRef: React.MutableRefObject<[number, number, number]>;
}

const noopRef = { current: 0 } as React.MutableRefObject<number>;
const noopVec3 = { current: [0, 0, 0] as [number, number, number] };

const CinematicCtx = createContext<CinematicValue>({
  phase: "done",
  elapsed: noopRef,
  isDone: true,
  skip: () => {},
  starPositionRef: noopVec3 as CinematicValue["starPositionRef"],
});

export function CinematicProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<CinematicPhase>("intro");

  // High-precision wall clock for the cinematic. Started lazily on mount so
  // SSR and first-paint timings don't pollute the intro.
  const elapsed = useRef(0);
  const startTime = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);

  // ShootingStar writes its current world-space position here on every frame
  // so the camera rig can lerp toward it without a re-render storm.
  const starPositionRef = useRef<[number, number, number]>([-60, 4, 30]);

  const skip = useCallback(() => {
    setPhase((p) => (p === "done" ? p : "done"));
    elapsed.current = CINEMATIC_DURATION;
  }, []);

  useEffect(() => {
    if (phase === "done") return;

    const tick = (now: number) => {
      if (startTime.current === null) startTime.current = now;
      elapsed.current = (now - startTime.current) / 1000;

      if (elapsed.current >= CINEMATIC_DURATION) {
        elapsed.current = CINEMATIC_DURATION;
        setPhase("done");
        return;
      }
      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);
    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, [phase]);

  // Keyboard skip: any key during intro ends it (spec §"Skip behaviour").
  useEffect(() => {
    if (phase === "done") return;
    const onKey = (e: KeyboardEvent) => {
      // Modifier-only presses shouldn't skip — that feels broken.
      if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") return;
      skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, skip]);

  // Respect prefers-reduced-motion: jump straight to "done".
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) skip();
  }, [skip]);

  const value = useMemo<CinematicValue>(
    () => ({
      phase,
      elapsed,
      isDone: phase === "done",
      skip,
      starPositionRef,
    }),
    [phase, skip],
  );

  return <CinematicCtx.Provider value={value}>{children}</CinematicCtx.Provider>;
}

export function useCinematic() {
  return useContext(CinematicCtx);
}

// ── Beat helpers ────────────────────────────────────────────────────────────
// Centralised so every component reads the SAME beat boundaries.

export const BEATS = {
  streakStart: 0.0,
  streakEnd: 1.5,
  decelStart: 1.5,
  decelEnd: 2.5,
  shatterStart: 2.5,
  reassembleStart: 3.7, // 1.2s into shatter (spec: "after 1.2s reverse course")
  shatterEnd: 4.5,
  done: 6.0,
} as const;

/** Clamp + remap a value to [0,1] over [a,b]. */
export function progress(t: number, a: number, b: number) {
  if (b <= a) return t >= b ? 1 : 0;
  const p = (t - a) / (b - a);
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

/** easeOutExpo — used for Beat 2 deceleration (spec). */
export function easeOutExpo(t: number) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** easeInCubic — fragments accelerate outward on shatter. */
export function easeInCubic(t: number) {
  return t * t * t;
}

/** easeOutCubic — fragments lock into letter positions. */
export function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}
