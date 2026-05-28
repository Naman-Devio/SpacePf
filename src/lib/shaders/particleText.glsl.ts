/**
 * Particle-text shader — animates the 2,000 fragments through three states:
 *
 *   1. Explode (Beat 3a, ~1.2s)
 *      Each particle is launched outward along a bezier path from the star's
 *      impact point to a far apex (random direction, random radius).
 *
 *   2. Hold at apex
 *      Brief pause so the eye can register the "shattered into stardust"
 *      moment before reversal.
 *
 *   3. Reassemble (Beat 3b, ~0.8s)
 *      Particles travel along the SECOND half of their bezier — apex back to
 *      their target letterform position. Each particle has its own `aDelay`
 *      attribute so letters arrive in waves left-to-right.
 *
 *   4. Lock with micro-bounce (last 80ms per particle)
 *      A damped sinusoid kiss as it snaps into place. Critical for "feel" —
 *      without this the letters arrive too clinically.
 *
 * All bezier evaluation and easing happen GPU-side; CPU just uploads four
 * static attributes per particle.
 */

export const PARTICLE_TEXT_VERTEX = /* glsl */ `
  // Per-particle attributes (all uploaded once)
  attribute vec3  aStart;    // explosion origin (same for all, but kept per-vertex for flexibility)
  attribute vec3  aApex;     // random outward control/peak point
  attribute vec3  aTarget;   // final letterform position
  attribute float aDelay;    // 0..1 — wave delay during reassembly
  attribute float aSeed;     // per-particle randomness for jitter/twinkle

  // Cinematic clock — uProgress runs 0..1 across Beat 3 (2.5s..4.5s)
  // We further split internally:
  //   0.0..0.55  → explode
  //   0.55..0.65 → hold
  //   0.65..1.0  → reassemble (each particle scheduled by aDelay)
  uniform float uProgress;
  uniform float uPixelRatio;

  varying float vTwinkle;
  varying float vPhaseGlow; // brightens at hold + on lock

  // Cubic bezier B(t) = (1-t)^3 P0 + 3(1-t)^2 t P1 + 3(1-t) t^2 P2 + t^3 P3
  vec3 bezier(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float t) {
    float u = 1.0 - t;
    return u*u*u*p0 + 3.0*u*u*t*p1 + 3.0*u*t*t*p2 + t*t*t*p3;
  }

  float easeOutCubic(float t) { return 1.0 - pow(1.0 - t, 3.0); }
  float easeInCubic(float t)  { return t * t * t; }

  void main() {
    float p = clamp(uProgress, 0.0, 1.0);

    // Phase boundaries
    const float EXPLODE_END   = 0.55;
    const float HOLD_END      = 0.65;
    // Reassemble starts at HOLD_END, lasts the remaining time.
    const float REASSEMBLE_LEN = 1.0 - HOLD_END;

    vec3 pos;

    if (p < EXPLODE_END) {
      // 1. Explode — bezier from start → control(start+aApex/2) → aApex → aApex(little drift)
      float tE = easeInCubic(p / EXPLODE_END);
      vec3 ctrl = mix(aStart, aApex, 0.35) +
                  vec3(sin(aSeed * 6.283) * 0.6,
                       cos(aSeed * 6.283) * 0.6, 0.0);
      // Slight overshoot point so the apex feels "thrown"
      vec3 over = aApex + normalize(aApex - aStart) * 0.4;
      pos = bezier(aStart, ctrl, aApex, over, tE);

      vPhaseGlow = 1.0 - tE * 0.4;
    }
    else if (p < HOLD_END) {
      // 2. Hold — small drift around apex
      float h = (p - EXPLODE_END) / (HOLD_END - EXPLODE_END);
      vec3 drift = vec3(
        sin(uProgress * 9.0 + aSeed * 31.0),
        cos(uProgress * 7.5 + aSeed * 17.0),
        sin(uProgress * 4.0 + aSeed * 11.0)
      ) * 0.18;
      pos = aApex + drift;
      vPhaseGlow = 0.6 + 0.4 * sin(h * 3.14159);
    }
    else {
      // 3. Reassemble — each particle has its own start time within this window.
      float t = (p - HOLD_END) / REASSEMBLE_LEN; // 0..1 across the whole reassembly
      // Window per particle = 0.65 wide so there's overlap (waves not isolated rows)
      float local = clamp((t - aDelay * 0.35) / 0.65, 0.0, 1.0);
      float eased = easeOutCubic(local);

      // Bezier back: apex → ctrl2 (skewed toward target) → target
      vec3 ctrl2 = mix(aApex, aTarget, 0.55) +
                   vec3(cos(aSeed * 12.566) * 0.3,
                        sin(aSeed * 12.566) * 0.3, 0.0);
      // Slight pre-target overshoot point lets us add bounce naturally
      vec3 preTarget = aTarget + (aTarget - ctrl2) * 0.05;
      pos = bezier(aApex, ctrl2, preTarget, aTarget, eased);

      // 4. Micro-bounce: damped sinusoid in the last 12% of each particle's window
      if (local > 0.88) {
        float b = (local - 0.88) / 0.12;
        float bounce = sin(b * 18.85) * exp(-b * 6.0) * 0.08;
        // Bounce displaces along target's outward direction from origin
        vec3 outDir = normalize(aTarget - aStart + vec3(0.0001));
        pos += outDir * bounce;
      }

      // Glow flares briefly on lock — that crystalline "tick" feel
      float lockFlash = smoothstep(0.85, 0.98, local) * (1.0 - smoothstep(0.98, 1.0, local));
      vPhaseGlow = 0.55 + lockFlash * 0.9;
    }

    // Twinkle (slight — these are "ash" particles glowing, not pure stars)
    vTwinkle = 0.7 + 0.3 * sin(p * 20.0 + aSeed * 6.283);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float dist = -mv.z;
    gl_PointSize = (1.4 + aSeed * 1.6) * uPixelRatio * (260.0 / max(dist, 0.001));
    gl_Position = projectionMatrix * mv;
  }
`;

export const PARTICLE_TEXT_FRAGMENT = /* glsl */ `
  precision highp float;
  varying float vTwinkle;
  varying float vPhaseGlow;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = exp(-d * d * 38.0);
    float halo = exp(-d * d * 6.0) * 0.35;
    float a = core + halo;
    if (a < 0.01) discard;

    // Plasma teal (#0ff4c6) — these are the star's ash, the source of the
    // signal. Same hue as the persistent Signal Sphere in Zone 2.
    vec3 plasma = vec3(0.058, 0.957, 0.776);
    vec3 col = plasma * vTwinkle * vPhaseGlow * (0.5 + core);

    gl_FragColor = vec4(col, a * vPhaseGlow);
  }
`;
