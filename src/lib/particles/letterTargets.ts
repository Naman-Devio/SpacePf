/**
 * letterTargets.ts — pre-computes the 3D target positions for the 2,000
 * particles that assemble into "NAMAN DEVIO" during Beat 3.
 *
 * Strategy:
 *   1. Render the string into an offscreen <canvas> using Syne Mono.
 *   2. Sample alpha values on a regular grid.
 *   3. Each filled pixel becomes a candidate point.
 *   4. Reservoir-sample exactly `count` points so we don't have to know the
 *      exact pixel coverage in advance.
 *   5. Map pixel space (origin top-left, y-down) → world space (origin centre,
 *      y-up), then scale to the desired world width.
 *
 * Spec requirements satisfied:
 *   - Font: Syne Mono (same family used for the persistent display heading)
 *   - "Particles arrive in waves" — we assign each target a `delay` based on
 *     its horizontal position so letters lock in left-to-right with a touch
 *     of randomness per particle.
 *
 * Determinism:
 *   - A seeded PRNG is used so the constellation looks the same every visit.
 *     This matters: the name should feel "designed", not random noise.
 */

const STRING = "NAMAN DEVIO";

export interface LetterTarget {
  x: number;
  y: number;
  z: number;
  /** 0..1 — when in Beat 3 reassembly this particle starts locking. */
  delay: number;
}

// Mulberry32 — tiny, well-distributed seeded PRNG. Public domain.
function mulberry32(seed: number) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns an array of `count` 3D target positions tracing the glyphs.
 *
 * @param count    desired number of particles (spec: 2000)
 * @param worldW   target world-space width of the rendered name
 * @param fontCss  CSS font shorthand; default uses Syne Mono if loaded
 * @param seed     PRNG seed for reproducible layout
 */
export function computeNameTargets(
  count = 2000,
  worldW = 28,
  fontCss = "700 220px 'Syne Mono', ui-monospace, monospace",
  seed = 0xdeadbeef,
): LetterTarget[] {
  // ── 1. Offscreen rasterisation ────────────────────────────────────────────
  // We pick a canvas wide enough that even at 220px the glyphs aren't clipped.
  const C_W = 1800;
  const C_H = 360;
  const canvas = document.createElement("canvas");
  canvas.width = C_W;
  canvas.height = C_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return fallback(count, worldW, seed);

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, C_W, C_H);
  ctx.font = fontCss;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.fillText(STRING, C_W / 2, C_H / 2);

  // ── 2. Find filled pixels on a coarse grid ────────────────────────────────
  // Stride controls density; 2 gives us tens of thousands of candidates.
  const STRIDE = 2;
  const data = ctx.getImageData(0, 0, C_W, C_H).data;
  const candidates: Array<{ px: number; py: number }> = [];

  for (let y = 0; y < C_H; y += STRIDE) {
    for (let x = 0; x < C_W; x += STRIDE) {
      const idx = (y * C_W + x) * 4;
      // Alpha of the rendered text is in the green channel since we drew white
      // on black; sampling .r works equivalently and avoids antialias bias.
      if (data[idx] > 96) candidates.push({ px: x, py: y });
    }
  }

  if (candidates.length === 0) return fallback(count, worldW, seed);

  // ── 3. Reservoir sampling to exactly `count` ──────────────────────────────
  const rng = mulberry32(seed);
  const picked: Array<{ px: number; py: number }> = candidates.slice(0, count);

  // If we have more candidates than needed, Algorithm R replaces with prob k/i.
  for (let i = count; i < candidates.length; i++) {
    const j = Math.floor(rng() * (i + 1));
    if (j < count) picked[j] = candidates[i];
  }

  // ── 4. Map pixel → world coordinates ──────────────────────────────────────
  // Find tight bbox so the name fills `worldW` regardless of canvas padding.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of picked) {
    if (p.px < minX) minX = p.px;
    if (p.px > maxX) maxX = p.px;
    if (p.py < minY) minY = p.py;
    if (p.py > maxY) maxY = p.py;
  }
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  const scale = worldW / bw;
  const worldH = bh * scale;

  const out: LetterTarget[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const p = picked[i] ?? picked[picked.length - 1];
    const wx = (p.px - (minX + bw / 2)) * scale;
    const wy = -(p.py - (minY + bh / 2)) * scale; // flip Y
    // Tiny z jitter so the name has visual thickness without floating.
    const wz = (rng() - 0.5) * 0.12;

    // Wave delay: left edge locks in first; small per-particle jitter on top.
    const horiz = (p.px - minX) / bw; // 0..1
    const jitter = rng() * 0.18;
    const delay = horiz * 0.65 + jitter;

    out[i] = { x: wx, y: wy + worldH * 0.0, z: wz, delay };
  }
  return out;
}

/** Fallback if canvas / font isn't available — circular constellation. */
function fallback(count: number, worldW: number, seed: number): LetterTarget[] {
  const rng = mulberry32(seed);
  const out: LetterTarget[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const a = t * Math.PI * 2;
    out[i] = {
      x: Math.cos(a) * worldW * 0.4 + (rng() - 0.5) * 0.5,
      y: Math.sin(a) * worldW * 0.12 + (rng() - 0.5) * 0.5,
      z: (rng() - 0.5) * 0.2,
      delay: rng(),
    };
  }
  return out;
}
