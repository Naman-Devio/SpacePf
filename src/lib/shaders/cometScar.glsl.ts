/**
 * Comet-scar shader — the luminous arc burned across the upper sky during
 * Beat 1, which then *persists* and fades over Zones 2–4 (spec, Beat 4).
 *
 * Rendered as a thin Mesh strip (built as a curved TubeGeometry / Plane).
 *   - Along the strip (uv.x): brightness fade-in to peak then taper at ends
 *   - Across the strip (uv.y): gaussian falloff so the edge is razor-soft
 *   - Time-driven dim once cinematic ends, AND scroll-driven additional dim
 *     so it survives Zone 2 but is gone by Zone 5 (spec).
 */
export const COMET_SCAR_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const COMET_SCAR_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform float uAge;      // seconds since scar was drawn
  uniform float uScroll;   // 0..1 page scroll progress
  uniform float uBaseAlpha;

  varying vec2 vUv;

  void main() {
    // Along the arc: smooth fall-off at both ends
    float along = vUv.x;
    float endFade = smoothstep(0.0, 0.08, along) * (1.0 - smoothstep(0.92, 1.0, along));

    // Across the arc: thin gaussian
    float across = abs(vUv.y - 0.5) * 2.0;
    float thick = exp(-across * across * 18.0);

    // Time fade: drops fast in first 1s after intro, then settles to slow drift.
    float timeFade = exp(-uAge * 0.18);

    // Scroll fade: spec says scar fades over Zones 2–4. Zones 2..4 ≈ scroll 0.10..0.45
    // → linearly fade from full to zero across that range.
    float scrollFade = 1.0 - smoothstep(0.10, 0.45, uScroll);

    float a = endFade * thick * timeFade * scrollFade * uBaseAlpha;
    if (a < 0.002) discard;

    // Slight warm-to-teal gradient along the arc: the head was hot, the tail
    // cooled toward the signal's plasma colour.
    vec3 hot   = vec3(1.0, 0.78, 0.45);
    vec3 cool  = vec3(0.34, 0.94, 0.84);
    vec3 col = mix(cool, hot, smoothstep(0.55, 1.0, along));

    gl_FragColor = vec4(col, a);
  }
`;
