"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCinematic, BEATS } from "@/lib/cinematic/CinematicContext";

/**
 * CinematicTerminal — the three-line terminal readout that appears BELOW the
 * assembled name at the end of Beat 3.
 *
 * Spec, Beat 3:
 *   Below the name: a terminal cursor blinks, then types:
 *     SIGNAL ORIGIN: UNKNOWN QUADRANT
 *     DESIGNATION: ENGINEER · BUILDER · SIGNAL SENDER
 *     STATUS: ● TRANSMITTING
 *
 * Reveal timing (relative to the cinematic clock):
 *   t ≈ 4.0s — terminal cursor materialises and blinks once
 *   t ≈ 4.3s — line 1 begins typing
 *   t ≈ 4.9s — line 2 begins typing
 *   t ≈ 5.5s — line 3 begins typing
 *   t = 6.0s — cinematic ends; terminal stays as the persistent Hero subline
 *
 * Implementation: pure CSS char-by-char reveal driven by readPhase from
 * Cinematic clock. Skipping the intro instantly forces the final state with
 * a 400ms cross-fade (handled by AnimatePresence wrapper).
 */

interface Line {
  label: string;
  value: string;
  /** seconds after cinematic start when this line starts revealing */
  start: number;
  /** seconds the typewriter takes */
  dur: number;
}

const LINES: Line[] = [
  { label: "SIGNAL ORIGIN", value: "UNKNOWN QUADRANT", start: 4.3, dur: 0.55 },
  { label: "DESIGNATION",   value: "ENGINEER · BUILDER · SIGNAL SENDER", start: 4.9, dur: 0.55 },
  { label: "STATUS",        value: "● TRANSMITTING", start: 5.5, dur: 0.45 },
];

const TERMINAL_APPEARS = 4.0;

export default function CinematicTerminal() {
  const { elapsed, isDone } = useCinematic();
  const [tick, setTick] = useState(0);

  // We need to re-render at ~30Hz during the terminal reveal so the
  // type-on animation feels live without bleeding frames the rest of the time.
  useEffect(() => {
    if (isDone) {
      // Force one final render so values land at "fully typed"
      setTick((t) => t + 1);
      return;
    }
    let raf = 0;
    let last = 0;
    const loop = () => {
      const e = elapsed.current;
      // Only re-render once we're inside the terminal window
      if (e >= TERMINAL_APPEARS - 0.1) {
        if (e - last > 1 / 30) {
          last = e;
          setTick((t) => t + 1);
        }
      }
      if (e < BEATS.done) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [elapsed, isDone]);

  const e = isDone ? BEATS.done : elapsed.current;
  const visible = e >= TERMINAL_APPEARS || isDone;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="cinematic-terminal"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="pointer-events-none select-none"
          style={{
            fontFamily: "var(--font-space-mono), ui-monospace, monospace",
            // Tick consumed so React re-render reactivity is tied to the ref clock.
            // (Without this no-op reference, the linter strips the dependency.)
            ["--_tick" as string]: String(tick),
          }}
        >
          <div className="text-[0.72rem] sm:text-[0.78rem] tracking-[0.22em] text-white/85 leading-[1.9]">
            {LINES.map((l, i) => {
              const lineProgress = isDone
                ? 1
                : Math.max(0, Math.min(1, (e - l.start) / l.dur));
              const total = l.value.length;
              const shown = Math.floor(total * lineProgress);
              const typed = l.value.slice(0, shown);
              const isTyping = lineProgress > 0 && lineProgress < 1;
              const lineStarted = lineProgress > 0;

              if (!lineStarted) return null;
              return (
                <div key={l.label} className="whitespace-nowrap">
                  <span className="text-white/45">{l.label}:</span>{" "}
                  <span
                    className={
                      i === 2
                        ? "text-[var(--plasma)]"
                        : "text-white/85"
                    }
                  >
                    {typed}
                  </span>
                  {isTyping && (
                    <span className="inline-block w-[0.5ch] -mb-[1px] bg-[var(--plasma)] align-baseline animate-pulse">
                      &nbsp;
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
