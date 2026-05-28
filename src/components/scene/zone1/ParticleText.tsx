"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { BEATS, progress, useCinematic } from "@/lib/cinematic/CinematicContext";
import {
  PARTICLE_TEXT_VERTEX,
  PARTICLE_TEXT_FRAGMENT,
} from "@/lib/shaders/particleText.glsl";
import { computeNameTargets } from "@/lib/particles/letterTargets";

/**
 * ParticleText — Beat 3 (Shattering + Reassembly) of the cinematic intro.
 *
 * 2,000 particles emerge from the star's impact point, fly outward along
 * bezier paths, then reverse and lock into the letterforms of NAMAN DEVIO.
 *
 * The name then *persists* after the cinematic ends — it's the hero display
 * (Zone 2, the Hero Cockpit). After cinematic completion this component
 * remains mounted with the same geometry holding the letterforms together;
 * a slow ambient breathing motion replaces the bezier animation.
 *
 * Why all the math is GPU-side: we'd kill the frame rate uploading 2000 × 3
 * floats every tick. Instead we upload static start/apex/target attributes
 * once and feed only a single `uProgress` uniform per frame.
 */

const PARTICLE_COUNT = 2000;
const IMPACT = new THREE.Vector3(0, 0, 6); // matches Shockwave / shooting-star END

// Tiny ambient drift applied to the name AFTER the cinematic ends.
// Just enough to feel "alive" without distracting from HUD elements.
const AMBIENT_DRIFT_AMP = 0.04;
const AMBIENT_DRIFT_FREQ = 0.55;

export default function ParticleText() {
  const { elapsed, isDone } = useCinematic();
  const { gl } = useThree();

  // Wait one render so the Syne Mono webfont has had a chance to load. Without
  // this we'd rasterise the fallback font, which makes the constellation look
  // generic. document.fonts.ready is the right async signal.
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) setFontsReady(true);
    });
    // Hard fallback so we never hang the cinematic on font loading
    const tm = setTimeout(() => !cancelled && setFontsReady(true), 1200);
    return () => {
      cancelled = true;
      clearTimeout(tm);
    };
  }, []);

  // ── Build geometry + attributes once fonts are ready ────────────────────
  const geometry = useMemo(() => {
    if (typeof document === "undefined") return null;

    const g = new THREE.BufferGeometry();
    const targets = computeNameTargets(PARTICLE_COUNT, 28);

    const start = new Float32Array(PARTICLE_COUNT * 3);
    const apex = new Float32Array(PARTICLE_COUNT * 3);
    const target = new Float32Array(PARTICLE_COUNT * 3);
    const delay = new Float32Array(PARTICLE_COUNT);
    const seed = new Float32Array(PARTICLE_COUNT);
    // `position` exists only because Three insists; the shader ignores it.
    const position = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // All particles originate from the impact point with tiny jitter so the
      // initial outburst doesn't look like a singularity collapse.
      const j = 0.18;
      start[i * 3 + 0] = IMPACT.x + (Math.random() - 0.5) * j;
      start[i * 3 + 1] = IMPACT.y + (Math.random() - 0.5) * j;
      start[i * 3 + 2] = IMPACT.z + (Math.random() - 0.5) * j;

      // Apex: random direction outward from impact, distance 10..22 units.
      // We bias slightly toward in front of the camera (z > impact.z - 6) so
      // particles don't all fly behind the viewer.
      const theta = Math.random() * Math.PI * 2;
      const phiBase = Math.acos(2 * Math.random() - 1);
      // Compress vertical spread a bit — the name is wide, not tall.
      const phi = phiBase * 0.65 + Math.PI * 0.5 * 0.35;
      const dist = 10 + Math.random() * 12;
      apex[i * 3 + 0] = IMPACT.x + Math.sin(phi) * Math.cos(theta) * dist;
      apex[i * 3 + 1] = IMPACT.y + Math.cos(phi) * (dist * 0.5);
      apex[i * 3 + 2] = IMPACT.z + Math.sin(phi) * Math.sin(theta) * dist * 0.6;

      const t = targets[i];
      target[i * 3 + 0] = t.x;
      target[i * 3 + 1] = t.y;
      target[i * 3 + 2] = t.z;

      delay[i] = t.delay;
      seed[i] = Math.random();
      position[i * 3 + 0] = 0;
      position[i * 3 + 1] = 0;
      position[i * 3 + 2] = 0;
    }

    g.setAttribute("position", new THREE.BufferAttribute(position, 3));
    g.setAttribute("aStart", new THREE.BufferAttribute(start, 3));
    g.setAttribute("aApex", new THREE.BufferAttribute(apex, 3));
    g.setAttribute("aTarget", new THREE.BufferAttribute(target, 3));
    g.setAttribute("aDelay", new THREE.BufferAttribute(delay, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));

    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 60);
    return g;
  }, [fontsReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: PARTICLE_TEXT_VERTEX,
        fragmentShader: PARTICLE_TEXT_FRAGMENT,
        uniforms: {
          uProgress: { value: 0.0 },
          uPixelRatio: { value: Math.min(gl.getPixelRatio(), 1.5) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [gl],
  );

  // Ambient breathing wrapper — we shift the whole points object very slightly
  // after the cinematic ends. Cheaper than feeding a per-vertex sine.
  const groupRef = useRef<THREE.Group>(null);
  const ambientClock = useRef(0);

  useFrame((_, dt) => {
    const e = elapsed.current;
    // uProgress = 0 before Beat 3, 1 after Beat 3 ends → locked in place.
    const p = progress(e, BEATS.shatterStart, BEATS.shatterEnd);
    material.uniforms.uProgress.value = p;

    if (isDone && groupRef.current) {
      ambientClock.current += dt;
      const t = ambientClock.current;
      // Lissajous-ish drift: subtle, in-place
      groupRef.current.position.x = Math.sin(t * AMBIENT_DRIFT_FREQ) * AMBIENT_DRIFT_AMP;
      groupRef.current.position.y = Math.sin(t * AMBIENT_DRIFT_FREQ * 0.83 + 1.2) * AMBIENT_DRIFT_AMP * 0.6;
    }
  });

  if (!geometry) return null;

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <points geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}
