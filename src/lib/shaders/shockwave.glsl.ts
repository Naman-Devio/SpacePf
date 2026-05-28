/**
 * Shockwave shader — the thin ring that expands from the star's impact point
 * during Beat 2. Spec: opacity 1 → 0 over 0.8s, thin ring (not a fat disc).
 *
 * Implementation: a ring of inner radius slightly less than outer. We fade by
 * radial distance from the ring's centreline so the edge is razor-thin.
 */
export const SHOCKWAVE_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const SHOCKWAVE_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform float uProgress; // 0 = impact, 1 = fully dissipated
  uniform vec3  uColor;
  varying vec2 vUv;

  void main() {
    // Radial distance from centre of plane (0..1)
    float r = length(vUv - 0.5) * 2.0;

    // The ring's leading edge sits at uProgress; the trailing edge slightly behind.
    float lead = uProgress;
    float trail = max(0.0, uProgress - 0.18);

    // Sharp ring profile: 1 between trail..lead, 0 elsewhere.
    float ringMask = smoothstep(trail, trail + 0.04, r) *
                     (1.0 - smoothstep(lead - 0.02, lead, r));

    // Overall alpha fades as the ring expands outward.
    float alpha = ringMask * (1.0 - uProgress);

    // Add a faint inner glow that lags behind the ring, gives volume.
    float innerGlow = (1.0 - smoothstep(0.0, lead, r)) * 0.08 * (1.0 - uProgress);

    vec3 col = uColor;
    gl_FragColor = vec4(col * (1.4 + innerGlow), alpha);
  }
`;
