"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BEATS, progress, useCinematic } from "@/lib/cinematic/CinematicContext";
import {
  SHOCKWAVE_VERTEX_SHADER,
  SHOCKWAVE_FRAGMENT_SHADER,
} from "@/lib/shaders/shockwave.glsl";

/**
 * Shockwave — Beat 2's thin ring expanding from the impact point.
 *
 * Spec: "a thin ring expands from impact point, opacity: 1 → 0 over 0.8s".
 *
 * Implementation: a screen-facing plane with a custom ring fragment shader.
 * We position it at the END of the shooting star's path (origin) and scale it
 * up from ~0 to ~8 units across the 0.8s window. We also lock its quaternion
 * to face the camera each frame — a billboard.
 */

const RING_DURATION = 0.8; // seconds — spec
// Start the ring at the moment the star "lands" (end of Beat 2 deceleration).
// Spec phrasing places it on impact, which is decelEnd in our timing.
const RING_TRIGGER = BEATS.decelEnd;
const RING_MAX_SCALE = 8.0;

export default function Shockwave() {
  const { elapsed } = useCinematic();
  const meshRef = useRef<THREE.Mesh>(null);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SHOCKWAVE_VERTEX_SHADER,
        fragmentShader: SHOCKWAVE_FRAGMENT_SHADER,
        uniforms: {
          uProgress: { value: 0.0 },
          uColor: { value: new THREE.Color("#fff2c4") },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useFrame(({ camera }) => {
    const e = elapsed.current;
    const mesh = meshRef.current;
    if (!mesh) return;

    if (e < RING_TRIGGER) {
      mesh.visible = false;
      return;
    }

    const local = progress(e, RING_TRIGGER, RING_TRIGGER + RING_DURATION);
    if (local >= 1) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;

    material.uniforms.uProgress.value = local;

    // Scale: starts tiny, expands to RING_MAX_SCALE
    const s = 0.4 + local * RING_MAX_SCALE;
    mesh.scale.set(s, s, 1);

    // Billboard toward camera so the ring is always facing the viewer
    mesh.quaternion.copy(camera.quaternion);
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 6]} material={material}>
      <planeGeometry args={[1, 1, 1, 1]} />
    </mesh>
  );
}
