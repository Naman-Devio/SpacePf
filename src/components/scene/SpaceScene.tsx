"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import * as THREE from "three";
import CameraRig from "./CameraRig";
import StarField from "./StarField";

/**
 * SpaceScene — the ONE persistent <Canvas> for the entire site.
 *
 * Spec mandates:
 *   - Single Canvas behind everything, never unmounts
 *   - dpr capped at 1.5 for high-DPI performance
 *   - linear colorspace + tone mapping for HDR-ish star bloom
 *   - All scene objects mounted as children; zone gating happens inside
 *     each child via `useScrollProgress`. This component stays dumb.
 *
 * Phase 1 contains: <CameraRig /> + <StarField />.
 * Later phases will add ZoneN groups, post-processing, comet scar, etc.
 */
export default function SpaceScene() {
  return (
    <div className="scene-root" aria-hidden="true">
      <Canvas
        camera={{
          fov: 70,
          near: 0.1,
          far: 800,
          position: [0, 0, 50],
        }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          // Linear workflow → bloom and additive stars look correct
          toneMapping: THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        // Deep-space tint background (matches --void). Not pure black on purpose.
        style={{ background: "#04040a" }}
      >
        <Suspense fallback={null}>
          <CameraRig />
          <StarField />
        </Suspense>
      </Canvas>
    </div>
  );
}
