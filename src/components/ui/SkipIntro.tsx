"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCinematic } from "@/lib/cinematic/CinematicContext";

/**
 * SkipIntro — the top-right "SKIP" affordance during Zone 1.
 *
 * Spec, Zone 0:
 *   "SKIP INTRO button appears top-right in `Space Mono`, fully transparent
 *    until mousemove."
 *
 * Spec, Zone 1:
 *   "Pressing SKIP or any key during cinematic: cross-fade in 400ms to hero
 *    state. Particles jump to their final name positions (no mid-animation
 *    abort glitch)."
 *
 * The "no glitch" promise is enforced inside ParticleText / CinematicContext:
 *   - skip() flips phase to "done" AND sets elapsed.current to CINEMATIC_DURATION,
 *     so the next useFrame computes the shader's uProgress as 1.0 → particles
 *     land directly on their target letterforms with no in-flight snap.
 *
 * Visibility rules:
 *   - Mounted only while phase === "intro"
 *   - Opacity ramps from 0 to 0.85 on first mousemove (or first scroll attempt)
 *   - On click → triggers skip(); the AnimatePresence cross-fades it out in 400ms
 */
export default function SkipIntro() {
  const { phase, skip } = useCinematic();
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (phase !== "intro") return;
    const reveal = () => setRevealed(true);
    window.addEventListener("mousemove", reveal, { once: true, passive: true });
    window.addEventListener("touchstart", reveal, { once: true, passive: true });
    // Also auto-reveal after 1.2s so it's always discoverable on devices that
    // never fire mousemove (rare, but courteous fallback).
    const tm = setTimeout(reveal, 1200);
    return () => {
      window.removeEventListener("mousemove", reveal);
      window.removeEventListener("touchstart", reveal);
      clearTimeout(tm);
    };
  }, [phase]);

  return (
    <AnimatePresence>
      {phase === "intro" && (
        <motion.button
          key="skip-intro"
          onClick={skip}
          aria-label="Skip cinematic intro"
          initial={{ opacity: 0 }}
          animate={{ opacity: revealed ? 0.85 : 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          whileHover={{ opacity: 1, scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="fixed top-6 right-6 z-50 pointer-events-auto"
          style={{
            fontFamily: "var(--font-space-mono), ui-monospace, monospace",
          }}
        >
          <span className="inline-flex items-center gap-2 px-3 py-2 text-[0.7rem] tracking-[0.32em] uppercase text-white/85 border border-white/15 hover:border-[var(--plasma)] hover:text-[var(--plasma)] transition-colors duration-200 backdrop-blur-sm bg-white/[0.025]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--plasma)] animate-pulse" />
            Skip Intro
            <span aria-hidden className="ml-1 opacity-60">→</span>
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
