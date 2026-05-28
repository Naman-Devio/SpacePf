/**
 * Shooting-star shader.
 *
 * Renders a single point that:
 *   - Is a luminous core with chromatic halo (amber → white hot per beat 2)
 *   - Receives an "intensity" uniform driven by the cinematic clock so the
 *     star *visibly* charges up as it decelerates and "presents" itself.
 *
 * Why a custom shader (not a sprite texture):
 *   - We need per-frame colour temperature shift (amber → white) — a texture
 *     would lock the palette to a fixed PNG, which the spec explicitly
 *     forbids (no copied demos, no static assets for celestial bodies).
 */
export const STAR_VERTEX_SHADER = /* glsl */ `
  uniform float uPixelRatio;
  uniform float uSize;       // base pixel size at reference distance

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float dist = -mv.z;
    gl_PointSize = uSize * uPixelRatio * (300.0 / max(dist, 0.001));
    gl_Position = projectionMatrix * mv;
  }
`;

export const STAR_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform float uIntensity;  // 0..1 — beat-driven brightness
  uniform float uTemp;       // 0 amber → 1 white-hot
  uniform float uAlpha;      // global fade (used on shatter)

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);

    // Three-layer radial falloff: tight core, mid bloom, wide halo
    float core = exp(-d * d * 60.0);
    float mid  = exp(-d * d * 14.0) * 0.55;
    float halo = exp(-d * d * 3.5)  * 0.18;

    float a = (core + mid + halo) * uAlpha;
    if (a < 0.005) discard;

    // Colour temperature: amber #ff9a3c → white-hot #fffff5
    vec3 cAmber = vec3(1.00, 0.60, 0.24);
    vec3 cHot   = vec3(1.00, 0.99, 0.92);
    vec3 col = mix(cAmber, cHot, clamp(uTemp, 0.0, 1.0));

    // Push brightness with intensity (super-white core at peak)
    col *= (0.8 + uIntensity * 1.8);
    col += core * uIntensity * 0.6;

    gl_FragColor = vec4(col, a);
  }
`;

// ── Motion-blur trail (rendered as a TubeGeometry behind the star) ─────────
// This is the "comet trail" effect from beat 1. It uses the tube's UV.y as a
// time-since-emission proxy, so the tail darkens away from the head.

export const TRAIL_VERTEX_SHADER = /* glsl */ `
  varying float vAlong;
  void main() {
    vAlong = uv.y; // 0 = tail, 1 = head (geometry built that way)
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const TRAIL_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform float uAlpha;
  varying float vAlong;
  void main() {
    // Sharp head, exponential decay along the tail.
    float a = pow(vAlong, 2.8);
    vec3 col = mix(vec3(0.95, 0.55, 0.18), vec3(1.0, 0.95, 0.85), vAlong);
    gl_FragColor = vec4(col, a * uAlpha);
  }
`;
