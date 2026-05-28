"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useScrollProgress } from "@/hooks/useScrollProgress";
import { useMouseParallax } from "@/hooks/useMouseParallax";
import { BEATS, easeOutExpo, progress, useCinematic } from "@/lib/cinematic/CinematicContext";

/**
 * CameraRig — drives the scene camera from scroll + mouse.
 *
 * Spec (Cinematic Camera System):
 *   Scroll  →  Z travel: 0% → z=+50  ·  100% → z=-200
 *   Mouse   →  ±4° tilt on X/Y axes (smooth gimbal, lerp 0.04)
 *
 * Zone 1 additions:
 *   - During Beat 1 (streak) the camera tracks the shooting star with the
 *     0.05 lerp prescribed by the spec ("not snap-locked, lerped 0.05 ...
 *     feels cinematic").
 *   - During Beat 2 (deceleration) the spec asks for a FOV pull-back — we
 *     widen FOV from 70° to 88° across the deceleration window then settle
 *     back to 70° as Beat 3 begins.
 *   - During Beat 3 the camera is mostly still; we add a 2° subtle dolly
 *     pull so the name reveal feels "presented to" the visitor.
 *   - After cinematic ends → normal scroll/mouse rig resumes.
 */

const Z_NEAR = 50;
const Z_FAR = -200;
const MAX_TILT_DEG = 4;
const MAX_TILT_RAD = (MAX_TILT_DEG * Math.PI) / 180;
const TILT_OFFSET = 0.6;

const BASE_FOV = 70;
const WIDE_FOV = 88;

// Camera follow rig during cinematic: positioned just BEHIND and slightly
// above the star so it feels like a chase camera, not a fly-by.
const FOLLOW_OFFSET = new THREE.Vector3(0, 1.2, 14);

// Final hero "settle" position — slightly in front of the name plane so the
// HUD-side parallax has somewhere to play.
const HERO_POS = new THREE.Vector3(0, 0, 20);
const HERO_LOOK = new THREE.Vector3(0, 0, 0);

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export default function CameraRig() {
  const { camera } = useThree();
  const scroll = useScrollProgress();
  const mouse = useMouseParallax();
  const { isDone, elapsed, starPositionRef } = useCinematic();

  const camPos = useRef(new THREE.Vector3(0, 2, Z_NEAR));
  const lookAt = useRef(new THREE.Vector3(0, 2, Z_NEAR - 10));
  const tilt = useRef({ x: 0, y: 0 });
  const followTarget = useRef(new THREE.Vector3());
  const followLook = useRef(new THREE.Vector3());

  useFrame(() => {
    // PerspectiveCamera in r3f — we need to cast to access fov.
    const persp = camera as THREE.PerspectiveCamera;

    if (!isDone) {
      // ── CINEMATIC MODE ────────────────────────────────────────────────────
      const e = elapsed.current;
      const star = starPositionRef.current;

      // Compute desired follow position + look
      followTarget.current.set(
        star[0] + FOLLOW_OFFSET.x,
        star[1] + FOLLOW_OFFSET.y,
        star[2] + FOLLOW_OFFSET.z,
      );
      followLook.current.set(star[0], star[1], star[2]);

      // Beat 2: pull FOV wide as star decelerates → feels MASSIVE
      let targetFov = BASE_FOV;
      if (e >= BEATS.decelStart && e <= BEATS.decelEnd) {
        const d = progress(e, BEATS.decelStart, BEATS.decelEnd);
        targetFov = lerp(BASE_FOV, WIDE_FOV, easeOutExpo(d));
      } else if (e > BEATS.decelEnd && e <= BEATS.shatterStart + 0.4) {
        // Slowly return to base across beat 3 entry
        const d = progress(e, BEATS.decelEnd, BEATS.shatterStart + 0.4);
        targetFov = lerp(WIDE_FOV, BASE_FOV, d);
      } else {
        targetFov = BASE_FOV;
      }
      persp.fov = lerp(persp.fov, targetFov, 0.08);
      persp.updateProjectionMatrix();

      // Beat 3+: blend toward HERO position so we end the cinematic settled
      // exactly where Zone 2 expects us — no scroll snap on transition.
      if (e >= BEATS.shatterStart) {
        const blend = progress(e, BEATS.shatterStart, BEATS.shatterEnd);
        followTarget.current.lerp(HERO_POS, blend);
        followLook.current.lerp(HERO_LOOK, blend);
      }

      // Spec: 0.05 smoothing during streak — slightly more (0.06) after to
      // settle without overshoot.
      const followK = e <= BEATS.streakEnd ? 0.05 : 0.06;
      camPos.current.lerp(followTarget.current, followK);
      lookAt.current.lerp(followLook.current, followK);

      camera.position.copy(camPos.current);
      camera.lookAt(lookAt.current);
      return;
    }

    // ── NORMAL MODE (post-cinematic) ────────────────────────────────────────
    persp.fov = lerp(persp.fov, BASE_FOV, 0.1);
    persp.updateProjectionMatrix();

    // 1. Scroll → Z travel
    const targetZ = lerp(HERO_POS.z, Z_FAR, scroll);

    // 2. Mouse → tilt (±4°, lerp 0.04 per spec)
    tilt.current.x = lerp(tilt.current.x, mouse.current.x * MAX_TILT_RAD, 0.04);
    tilt.current.y = lerp(tilt.current.y, mouse.current.y * MAX_TILT_RAD, 0.04);

    const offX = Math.sin(tilt.current.x) * TILT_OFFSET;
    const offY = Math.sin(tilt.current.y) * TILT_OFFSET;

    const target = new THREE.Vector3(offX, offY, targetZ);
    camPos.current.lerp(target, 0.08);
    camera.position.copy(camPos.current);

    const lookTarget = new THREE.Vector3(
      offX * 0.4,
      offY * 0.4,
      targetZ - 30,
    );
    lookAt.current.lerp(lookTarget, 0.08);
    camera.lookAt(lookAt.current);

    // Avoid unused-param lint
    void Z_NEAR;
  });

  return null;
}
