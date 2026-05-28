"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useScrollProgress } from "@/hooks/useScrollProgress";
import { useMouseParallax } from "@/hooks/useMouseParallax";

/**
 * CameraRig — drives the scene camera from scroll + mouse.
 *
 * Spec (Cinematic Camera System):
 *   Scroll  →  Z travel: 0% → z=+50  ·  100% → z=-200
 *   Mouse   →  ±4° tilt on X/Y axes (smooth gimbal, lerp 0.04)
 *   Layer parallax is handled inside each zone component, not here.
 *
 * Implementation notes:
 *   - We never use Drei's <OrbitControls>; this is a fully scripted dolly.
 *   - All values are lerped each frame for cinematic smoothness.
 *   - The "tilt" is expressed as a tiny camera position offset PLUS a lookAt
 *     adjustment, which reads as a gimbal pan rather than a hard rotation —
 *     this is what makes scenes feel filmed instead of game-engine-controlled.
 */

const Z_NEAR = 50;
const Z_FAR = -200;
const MAX_TILT_DEG = 4;
const MAX_TILT_RAD = (MAX_TILT_DEG * Math.PI) / 180;

// Small positional offset that accompanies the tilt — this is what makes the
// parallax feel like a head movement rather than just a rotation.
const TILT_OFFSET = 0.6;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export default function CameraRig() {
  const { camera } = useThree();
  const scroll = useScrollProgress();
  const mouse = useMouseParallax();

  // Internal state — keep separate refs so we can lerp each component cleanly.
  const camPos = useRef(new THREE.Vector3(0, 0, Z_NEAR));
  const lookAt = useRef(new THREE.Vector3(0, 0, Z_NEAR - 10));
  const tilt = useRef({ x: 0, y: 0 });

  useFrame(() => {
    // ── 1. Scroll → Z travel ──────────────────────────────────────────────
    const targetZ = lerp(Z_NEAR, Z_FAR, scroll);

    // ── 2. Mouse → tilt (±4°, lerp 0.04 per spec) ─────────────────────────
    tilt.current.x = lerp(tilt.current.x, mouse.current.x * MAX_TILT_RAD, 0.04);
    tilt.current.y = lerp(tilt.current.y, mouse.current.y * MAX_TILT_RAD, 0.04);

    // Convert tilt to a small position offset (gimbal head feel)
    const offX = Math.sin(tilt.current.x) * TILT_OFFSET;
    const offY = Math.sin(tilt.current.y) * TILT_OFFSET;

    // ── 3. Lerp the camera position toward target ─────────────────────────
    const target = new THREE.Vector3(offX, offY, targetZ);
    camPos.current.lerp(target, 0.08);
    camera.position.copy(camPos.current);

    // ── 4. LookAt point sits ~30 units ahead of camera along travel axis ──
    //     so the camera always "leans into" the journey. Tilt nudges it.
    const lookTarget = new THREE.Vector3(
      offX * 0.4,
      offY * 0.4,
      targetZ - 30,
    );
    lookAt.current.lerp(lookTarget, 0.08);
    camera.lookAt(lookAt.current);
  });

  return null;
}
