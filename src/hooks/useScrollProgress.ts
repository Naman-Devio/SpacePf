"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Returns a 0..1 normalised scroll value. Updated via rAF-throttled scroll
 * listener so we never push more than one update per frame to React state.
 *
 * Phase 1 use: CameraRig consumes this to compute camera Z (50 → -200).
 * Future phases (zone gating, audio pitch) will subscribe to the same hook.
 */
export function useScrollProgress(): number {
  const [progress, setProgress] = useState(0);
  const ticking = useRef(false);

  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      setProgress(Math.max(0, Math.min(1, p)));
      ticking.current = false;
    };

    const onScroll = () => {
      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
    };
  }, []);

  return progress;
}
