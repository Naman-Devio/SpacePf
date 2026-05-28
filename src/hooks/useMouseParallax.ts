"use client";

import { useEffect, useRef } from "react";

export interface MouseVec {
  /** Normalised device coords, range [-1, 1]. y is +up. */
  x: number;
  y: number;
}

/**
 * Mouse position as a mutable ref (no React re-renders).
 * CameraRig reads this every frame inside useFrame.
 *
 * Spec: ±4° tilt max, lerp factor 0.04 — gimbal-smooth.
 */
export function useMouseParallax() {
  const mouse = useRef<MouseVec>({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return mouse;
}
