# Dead Star Signal · Phase 1

Naman Devio's VR-grade space portfolio. **Phase 1 only** — scaffold + persistent canvas + camera + starfield. Zones 1–7 are not yet built.

## What's in this milestone

| File | Purpose |
|---|---|
| `src/app/layout.tsx` | Loads spec fonts: **Syne Mono · Space Mono · DM Sans** via `next/font` |
| `src/app/globals.css` | Spec palette as CSS vars (`--void`, `--plasma`, `--pulsar`, etc.) + Tailwind 4 `@theme` mapping |
| `src/app/page.tsx` | Minimal shell — mounts canvas + an 8-viewport scroll spine (one viewport per zone) |
| `src/components/scene/SpaceScene.tsx` | The **one persistent `<Canvas>`** — `dpr=[1,1.5]`, ACES tone mapping, fixed at `z-0` behind everything |
| `src/components/scene/CameraRig.tsx` | Scroll → Z dolly (`+50 → -200`). Mouse → ±4° gimbal tilt with `lerp 0.04` |
| `src/components/scene/StarField.tsx` | **8,000 procedural stars** — depth-weighted shell distribution, per-star seed/size/color, additive blending, 1 draw call |
| `src/lib/shaders/stars.glsl.ts` | **Custom GLSL** twinkle shader (NOT a Three.js example). Per-star phase, true size attenuation, soft gaussian point sprite |
| `src/hooks/useScrollProgress.ts` | rAF-throttled 0..1 scroll value |
| `src/hooks/useMouseParallax.ts` | Mouse NDC as a mutable ref (no re-renders) |

Empty zone-folder skeleton (`zone1/` … `zone7/`) is in place but not populated yet.

## Run it

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

### Acceptance criteria for Phase 1

1. **60 fps**, stars visible against `#04040a` background.
2. **Mouse**: moving the cursor produces a smooth, ~4° gimbal tilt — feels like a filmed scene.
3. **Scroll**: scrolling the page should make stars **stream toward you** (camera Z goes from +50 down to −200).
4. **No console errors**, no React/three warnings.
5. The page is otherwise empty — debug labels like `ZONE 0 · scroll spine` are intentional placeholders.

If any of the above fails, that's what needs fixing before Zone 1.

## Tech stack (matches spec)

- Next.js 15.5 (App Router, Turbopack)
- React 19.1
- @react-three/fiber 9 + @react-three/drei 10 + @react-three/postprocessing 3
- three.js 0.170
- framer-motion 11
- Tailwind CSS 4

## Build notes

```bash
npm run build   # uses --turbopack; first run may take 1–2 min on cold cache
npm start
```

If `npm run build --turbopack` is slow in CI, temporarily switch the build script in `package.json` to `"next build"` (plain webpack); both work.

