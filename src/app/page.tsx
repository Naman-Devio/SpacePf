import dynamic from "next/dynamic";

/**
 * Phase 1 page — minimal shell.
 *
 * Mounts the persistent SpaceScene canvas and lays down enough scroll height
 * for CameraRig to traverse its full Z range. No zones, no HUD, no cinematic
 * intro yet — those arrive in subsequent phases.
 *
 * The canvas is loaded with `ssr: false` because Three.js touches window/WebGL
 * on init. Everything else stays server-rendered.
 */
const SpaceScene = dynamic(
  () => import("@/components/scene/SpaceScene"),
  { ssr: false },
);

export default function Home() {
  return (
    <>
      <SpaceScene />

      {/*
        Scroll spine — 8 viewports tall (one per spec zone). Fully transparent
        so the canvas shows through. Phase 1 only needs the scroll height;
        actual zone HTML content layers in later.
      */}
      <main className="relative z-10 pointer-events-none">
        {Array.from({ length: 8 }).map((_, i) => (
          <section
            key={i}
            className="h-screen w-full flex items-end justify-start p-6"
          >
            <span
              className="font-mono text-xs tracking-[0.35em] uppercase opacity-30"
              style={{ fontFamily: "var(--font-space-mono)" }}
            >
              ZONE {i} · scroll spine (Phase 1 debug)
            </span>
          </section>
        ))}
      </main>
    </>
  );
}
