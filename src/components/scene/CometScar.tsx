"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useCinematic } from "@/lib/cinematic/CinematicContext";
import { useScrollProgress } from "@/hooks/useScrollProgress";
import {
  COMET_SCAR_VERTEX,
  COMET_SCAR_FRAGMENT,
} from "@/lib/shaders/cometScar.glsl";

/**
 * CometScar — Beat 4 of the cinematic intro, persistent across Zones 2–4.
 *
 * Spec quote:
 *   "The star's trail leaves a comet scar — a luminous arc burned across
 *    the screen. This scar persists as a faint glow and fades gradually
 *    over Zones 2–4 (not Zone 5)."
 *
 * Implementation:
 *   - A curved ribbon mesh built from a CatmullRom curve that mirrors the
 *     shooting-star's path through the upper sky.
 *   - The shader fades by (time since intro end) AND by page scroll, so the
 *     scar is at full intensity right when the name finishes assembling and
 *     dies off as we approach the asteroid belt (Zone 5) — exactly per spec.
 *
 * Lives at the SpaceScene root (not inside zone1/) because it's a persistent
 * cross-zone visual — same scope as <StarField/>.
 */

export default function CometScar() {
  const { elapsed, isDone } = useCinematic();
  const scroll = useScrollProgress();

  // Track when the cinematic ended so the scar's "age" starts ticking from 0
  // at that moment, regardless of when this component happened to mount.
  const ageAtDone = useRef<number | null>(null);
  const wallClock = useRef(0);

  // Geometry: a thin ribbon along a curve that traces high across the screen.
  const geometry = useMemo(() => {
    // Curve mimicking the shooting star's screen-arc but shifted *upward and
    // far back* so it sits behind the name like a sky burn.
    const curve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-58, 13, -10),
        new THREE.Vector3(-28, 16, -8),
        new THREE.Vector3(0, 17, -6),
        new THREE.Vector3(26, 15, -4),
        new THREE.Vector3(48, 11, -2),
      ],
      false,
      "catmullrom",
      0.4,
    );

    const SEGMENTS = 220;
    const HALF_WIDTH = 0.55;

    const positions = new Float32Array((SEGMENTS + 1) * 2 * 3);
    const uvs = new Float32Array((SEGMENTS + 1) * 2 * 2);
    const idx: number[] = [];

    const p = new THREE.Vector3();
    const pNext = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const perp = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS;
      curve.getPointAt(t, p);
      curve.getPointAt(Math.min(1, t + 0.001), pNext);
      tangent.copy(pNext).sub(p).normalize();
      perp.crossVectors(tangent, up).normalize();
      // Width tapers at the ends so the burn doesn't look like a rectangle
      const widthMod = Math.sin(t * Math.PI); // 0 at ends, 1 in middle
      const w = HALF_WIDTH * (0.35 + widthMod * 0.65);

      const v0 = i * 6;
      positions[v0 + 0] = p.x + perp.x * w;
      positions[v0 + 1] = p.y + perp.y * w;
      positions[v0 + 2] = p.z + perp.z * w;
      positions[v0 + 3] = p.x - perp.x * w;
      positions[v0 + 4] = p.y - perp.y * w;
      positions[v0 + 5] = p.z - perp.z * w;

      const u0 = i * 4;
      uvs[u0 + 0] = t; uvs[u0 + 1] = 0;
      uvs[u0 + 2] = t; uvs[u0 + 3] = 1;
    }

    for (let i = 0; i < SEGMENTS; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: COMET_SCAR_VERTEX,
        fragmentShader: COMET_SCAR_FRAGMENT,
        uniforms: {
          uAge: { value: 0 },
          uScroll: { value: 0 },
          uBaseAlpha: { value: 0.0 }, // starts invisible; ramps in during Beat 1
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useFrame((_, dt) => {
    wallClock.current += dt;
    const e = elapsed.current;

    // Ramp the scar in DURING Beat 1 (the star is currently drawing it),
    // hit full at Beat 2 entry, then decay starts after intro completes.
    let base = 0;
    if (e < 0.2) base = 0; // not visible until star starts streaking
    else if (e < 1.5) base = (e - 0.2) / 1.3; // ramp up across streak
    else base = 1.0;
    material.uniforms.uBaseAlpha.value = base;

    if (isDone) {
      if (ageAtDone.current === null) ageAtDone.current = wallClock.current;
      material.uniforms.uAge.value = wallClock.current - ageAtDone.current;
    } else {
      material.uniforms.uAge.value = 0;
    }
    material.uniforms.uScroll.value = scroll;
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}
