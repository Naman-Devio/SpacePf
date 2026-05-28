"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CinematicProvider,
  useCinematic,
} from "@/lib/cinematic/CinematicContext";
import SkipIntro from "@/components/ui/SkipIntro";
import CinematicTerminal from "@/components/ui/CinematicTerminal";

/**
 * Home page — orchestrates Zone 1 (cinematic intro) on top of the persistent
 * SpaceScene canvas.
 *
 * Structure:
 *   <CinematicProvider>
 *     <SpaceScene/>                    (fixed canvas, z-0)
 *     <ScrollLock/>                    (body overflow during intro)
 *     <SkipIntro/>                     (top-right button, z-50)
 *     <HeroOverlay/>                   (vertically-centered name + terminal)
 *     <main>                           (scroll spine, z-10)
 *
 * The persistent name letterforms live INSIDE the canvas (ParticleText).
 * The DOM <HeroOverlay/> renders only the terminal subline + a screen-reader
 * accessible copy of the name — accessibility per spec § Accessibility.
 */

const SpaceScene = dynamic(() => import("@/components/scene/SpaceScene"), {
  ssr: false,
});

function ScrollLock() {
  // Lock page scroll while cinematic is playing — the spec treats the intro
  // as a 6s film, not something you can scroll through.
  const { phase } = useCinematic();
  useEffect(() => {
    if (phase !== "intro") return;
    const prevOverflow = document.documentElement.style.overflow;
    const prevTouch = document.documentElement.style.touchAction;
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.touchAction = "none";
    return () => {
      document.documentElement.style.overflow = prevOverflow;
      document.documentElement.style.touchAction = prevTouch;
    };
  }, [phase]);
  return null;
}

function HeroOverlay() {
  const { phase } = useCinematic();
  return (
    <div
      className="fixed inset-0 z-20 pointer-events-none flex flex-col items-center justify-center"
      aria-hidden={phase === "intro"}
    >
      {/* Screen-reader copy of the name — particles in canvas are decorative. */}
      <h1
        className="sr-only"
        style={{ fontFamily: "var(--font-syne-mono), monospace" }}
      >
        Naman Devio — Engineer, Builder, Signal Sender
      </h1>

      {/* The terminal subline reveals at t≈4.3s and persists post-cinematic.
          Sits ~14vh below page centre so the canvas particle name sits above it.
          Wrapped in a position-shift container so the line "sits under" the name. */}
      <div className="mt-[16vh] sm:mt-[18vh]">
        <CinematicTerminal />
      </div>

      {/* HUD hint to scroll — shows up only AFTER cinematic ends */}
      <AnimatePresence>
        {phase === "done" && <ScrollHint />}
      </AnimatePresence>
    </div>
  );
}

function ScrollHint() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 0.7, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, delay: 1.2, ease: "easeOut" }}
      className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[0.65rem] tracking-[0.45em] uppercase text-white/55"
      style={{ fontFamily: "var(--font-space-mono), monospace" }}
    >
      <span className="inline-flex items-center gap-3">
        Scroll to receive
        <motion.span
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          ↓
        </motion.span>
      </span>
    </motion.div>
  );
}

export default function Home() {
  return (
    <CinematicProvider>
      <SpaceScene />
      <ScrollLock />
      <SkipIntro />
      <HeroOverlay />

      {/* Scroll spine — 8 viewports tall, one per spec zone. Transparent.
          Later phases add HTML overlays per zone; for now it's just height. */}
      <main className="relative z-10 pointer-events-none">
        {Array.from({ length: 8 }).map((_, i) => (
          <section
            key={i}
            className="h-screen w-full flex items-end justify-start p-6"
          >
            <span
              className="font-mono text-[0.6rem] tracking-[0.35em] uppercase opacity-25"
              style={{ fontFamily: "var(--font-space-mono)" }}
            >
              ZONE {i} · scroll spine
            </span>
          </section>
        ))}
      </main>
    </CinematicProvider>
  );
}
