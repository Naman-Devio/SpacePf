"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  BEATS,
  easeOutExpo,
  progress,
  useCinematic,
} from "@/lib/cinematic/CinematicContext";
import {
  STAR_VERTEX_SHADER,
  STAR_FRAGMENT_SHADER,
  TRAIL_VERTEX_SHADER,
  TRAIL_FRAGMENT_SHADER,
} from "@/lib/shaders/shootingStar.glsl";

/**
 * ShootingStar — Beats 1 + 2 of the cinematic intro.
 *
 *   Beat 1 (0.0–1.5s):  enters from far left at extreme speed, accumulating
 *                       a comet trail. THREE.Points (1 particle) for the head
 *                       + a dynamic Line2-style trail built from a ring buffer
 *                       of recent positions.
 *   Beat 2 (1.5–2.5s):  decelerates with easeOutExpo, colour shifts amber →
 *                       white-hot. We don't fire the shockwave here — that's
 *                       Shockwave.tsx, which reads the same elapsed clock.
 *   Beat 3:             head dims and disappears (the explosion *is* the
 *                       particle-text component visually replacing it).
 *
 * The path:
 *   Start ≈ (-65,  6, 18)   — far left, slightly above eyeline, in front of stars
 *   End   ≈ (  0,  0,  6)   — frame centre, closer to camera so it feels massive
 *
 * Path is a quadratic bezier (gentle downward arc) so the streak doesn't feel
 * laser-straight — that's the difference between "demo" and "cinematic".
 */

const START = new THREE.Vector3(-65, 6, 18);
const APEX = new THREE.Vector3(-22, 9, 12); // control point — slight arc up
const END = new THREE.Vector3(0, 0, 6);

const TRAIL_SEGMENTS = 60; // points along the comet tail

function bezier3(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, t: number, out: THREE.Vector3) {
  const u = 1 - t;
  out.set(
    u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z,
  );
  return out;
}

export default function ShootingStar() {
  const { elapsed, starPositionRef } = useCinematic();

  // ── Head: single THREE.Points ─────────────────────────────────────────────
  const headGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3));
    return g;
  }, []);

  const headMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: STAR_VERTEX_SHADER,
        fragmentShader: STAR_FRAGMENT_SHADER,
        uniforms: {
          uPixelRatio: { value: typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 1.5) : 1 },
          uSize: { value: 4.5 },
          uIntensity: { value: 0.5 },
          uTemp: { value: 0.0 },
          uAlpha: { value: 1.0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  // ── Trail: a strip of recent positions, rebuilt every frame ───────────────
  // We use a Line that fades along its length via vertex UV.
  const trailGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array((TRAIL_SEGMENTS + 1) * 2 * 3);
    const uvs = new Float32Array((TRAIL_SEGMENTS + 1) * 2 * 2);
    for (let i = 0; i <= TRAIL_SEGMENTS; i++) {
      const a = i / TRAIL_SEGMENTS; // 0 = tail, 1 = head
      uvs[i * 4 + 0] = 0; uvs[i * 4 + 1] = a;
      uvs[i * 4 + 2] = 1; uvs[i * 4 + 3] = a;
    }
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

    const idx: number[] = [];
    for (let i = 0; i < TRAIL_SEGMENTS; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }, []);

  const trailMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: TRAIL_VERTEX_SHADER,
        fragmentShader: TRAIL_FRAGMENT_SHADER,
        uniforms: { uAlpha: { value: 1.0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [],
  );

  // History of recent (t,position) so we can render the tail behind the head.
  const history = useRef<{ t: number; p: THREE.Vector3 }[]>([]);
  const tmp = useRef(new THREE.Vector3());
  const tmpHead = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const e = elapsed.current;

    // ── Phase compute ───────────────────────────────────────────────────────
    let t = 0;
    let intensity = 0.5;
    let temp = 0.0;
    let headAlpha = 1.0;
    let trailAlpha = 1.0;

    if (e <= BEATS.streakEnd) {
      // Beat 1: streak — easeInQuad-ish, t² gives the "still accelerating" feel
      const raw = progress(e, BEATS.streakStart, BEATS.streakEnd);
      t = raw * raw * 0.78; // ends at ~0.78 of the path so beat 2 finishes the arrival
      intensity = 0.5 + raw * 0.4;
      temp = raw * 0.35;
      trailAlpha = 1.0;
    } else if (e <= BEATS.decelEnd) {
      // Beat 2: decelerate into frame centre with easeOutExpo
      const raw = progress(e, BEATS.decelStart, BEATS.decelEnd);
      t = 0.78 + easeOutExpo(raw) * 0.22; // finishes at 1.0 → END
      intensity = 0.9 + raw * 1.6;
      temp = 0.35 + raw * 0.65; // → 1.0 white-hot
      // Trail still visible early in beat 2 then dims as the star "settles"
      trailAlpha = 1.0 - raw * 0.6;
    } else if (e <= BEATS.shatterStart + 0.18) {
      // Tiny anticipation hold — the star sits ultra-bright before exploding.
      t = 1.0;
      const k = progress(e, BEATS.decelEnd, BEATS.shatterStart + 0.18);
      intensity = 2.5 + Math.sin(k * 14.0) * 0.2;
      temp = 1.0;
      trailAlpha = 0.4 - k * 0.4;
    } else {
      // Beat 3 onward: the head ceases to exist (replaced by the particle storm)
      t = 1.0;
      const k = progress(e, BEATS.shatterStart + 0.18, BEATS.shatterStart + 0.45);
      headAlpha = 1.0 - k;
      trailAlpha = 0.0;
      intensity = 2.5 * (1.0 - k);
      temp = 1.0;
      if (headAlpha <= 0) headAlpha = 0;
    }

    // ── Position the head ───────────────────────────────────────────────────
    bezier3(START, APEX, END, t, tmpHead.current);
    headGeo.attributes.position.setXYZ(0, tmpHead.current.x, tmpHead.current.y, tmpHead.current.z);
    headGeo.attributes.position.needsUpdate = true;

    // Publish head position for CameraRig to follow during Beats 1–2.
    starPositionRef.current[0] = tmpHead.current.x;
    starPositionRef.current[1] = tmpHead.current.y;
    starPositionRef.current[2] = tmpHead.current.z;

    // ── Push to history; rebuild trail strip ────────────────────────────────
    history.current.push({ t: e, p: tmpHead.current.clone() });
    // Trim by age — we want a tail spanning ~0.55s of motion at most
    while (history.current.length > 0 && e - history.current[0].t > 0.55) {
      history.current.shift();
    }

    // Build trail: head at i=TRAIL_SEGMENTS, sampling backward in time.
    const posAttr = trailGeo.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const hist = history.current;
    const lastIdx = hist.length - 1;

    // Build a smooth "ribbon" perpendicular to the path direction.
    const tangent = tmp.current;
    for (let i = 0; i <= TRAIL_SEGMENTS; i++) {
      const a = i / TRAIL_SEGMENTS; // 0 = tail, 1 = head
      // sample history: i=TRAIL_SEGMENTS → latest, i=0 → oldest
      const histIdx = Math.max(0, Math.min(lastIdx, Math.floor(a * lastIdx)));
      const sample = hist[histIdx] ?? hist[0] ?? { p: tmpHead.current };
      const nextSample = hist[Math.min(lastIdx, histIdx + 1)] ?? sample;

      tangent.copy(nextSample.p).sub(sample.p);
      if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
      tangent.normalize();

      // Perpendicular in screen-ish space (y-axis swap of x)
      const perpX = -tangent.y;
      const perpY = tangent.x;
      // Width tapers from head (wide) to tail (thin)
      const width = 0.06 + a * 0.55;

      // Two ribbon vertices per segment
      const off = i * 6;
      arr[off + 0] = sample.p.x + perpX * width;
      arr[off + 1] = sample.p.y + perpY * width;
      arr[off + 2] = sample.p.z;
      arr[off + 3] = sample.p.x - perpX * width;
      arr[off + 4] = sample.p.y - perpY * width;
      arr[off + 5] = sample.p.z;
    }
    posAttr.needsUpdate = true;

    // ── Uniforms ────────────────────────────────────────────────────────────
    headMat.uniforms.uIntensity.value = intensity;
    headMat.uniforms.uTemp.value = temp;
    headMat.uniforms.uAlpha.value = headAlpha;
    trailMat.uniforms.uAlpha.value = trailAlpha;

    // dt is unused here but referenced so the linter is happy
    void dt;
  });

  return (
    <group>
      <mesh geometry={trailGeo} material={trailMat} frustumCulled={false} />
      <points geometry={headGeo} material={headMat} frustumCulled={false} />
      {/* Real point light from the star — illuminates nearby star particles
          subtly when it's in frame. PointLight is cheap (no shadows). */}
      <pointLight
        position={[0, 0, 0]}
        intensity={2.2}
        distance={18}
        color="#ffd49a"
        ref={(l) => {
          if (l) {
            // Light tracks the head — easier than referencing via useFrame
            // because we already computed head position into starPositionRef.
            const pos = starPositionRef.current;
            l.position.set(pos[0], pos[1], pos[2]);
          }
        }}
      />
    </group>
  );
}
