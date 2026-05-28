"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import * as THREE from "three";
import CameraRig from "./CameraRig";
import StarField from "./StarField";
import CometScar from "./CometScar";
import Zone1Cinematic from "./zone1/Zone1Cinematic";

/**
 * SpaceScene — the ONE persistent <Canvas> for the entire site.
 *
 * Phase-2 (Zone 1) additions on top of Phase 1:
 *   - <Zone1Cinematic />     → shooting star, shockwave, particle text
 *   - <CometScar />          → persistent intro burn, fades into Zone 5
 *
 * The cinematic clock + skip state live in <CinematicProvider> (wired in
 * page.tsx) — both this canvas's children AND the DOM overlays consume it.
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
          toneMapping: THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        style={{ background: "#04040a" }}
      >
        <Suspense fallback={null}>
          <CameraRig />
          <StarField />
          <CometScar />
          <Zone1Cinematic />
        </Suspense>
      </Canvas>
    </div>
  );
}
