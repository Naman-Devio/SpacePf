/**
 * Custom GLSL twinkle shader for StarField.
 *
 * Each star carries:
 *   - aSeed   (random per-star, drives unique twinkle phase + frequency)
 *   - aSize   (point size in pixels at unit distance)
 *   - aColor  (per-star RGB tint — slight bias toward warm/cool whites)
 *
 * The twinkle is sin(time * freq + seed) mapped to a brightness multiplier.
 * Distance attenuation gives true depth — far stars feel small, near stars huge.
 *
 * This is NOT copied from Three.js docs. Original GLSL written for this scene.
 */
export const STAR_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;

  attribute float aSeed;
  attribute float aSize;
  attribute vec3  aColor;

  varying float vTwinkle;
  varying vec3  vColor;

  void main() {
    // Twinkle: each star has its own phase and a frequency biased by seed.
    // Result is in [0, 1] — we square it for a punchier sparkle envelope.
    float freq = 0.6 + aSeed * 2.4;
    float t = sin(uTime * freq + aSeed * 6.2831) * 0.5 + 0.5;
    vTwinkle = mix(0.35, 1.0, t * t);

    vColor = aColor;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    // True size attenuation: pixel size scaled by inverse distance to camera.
    // 300.0 is the reference distance constant tuned for our camera FOV / scene scale.
    float dist = -mvPosition.z;
    gl_PointSize = aSize * uPixelRatio * (300.0 / max(dist, 0.001));

    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const STAR_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying float vTwinkle;
  varying vec3  vColor;

  void main() {
    // Soft circular point with a luminous core. We DON'T use texture — pure math.
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);

    // Core (tight gaussian) + halo (broader falloff)
    float core = exp(-d * d * 38.0);
    float halo = exp(-d * d * 5.0)  * 0.35;
    float a = core + halo;

    // Discard the corners cleanly so points stay circular at all sizes.
    if (a < 0.01) discard;

    vec3 col = vColor * vTwinkle * (0.6 + core);
    gl_FragColor = vec4(col, a * vTwinkle);
  }
`;
