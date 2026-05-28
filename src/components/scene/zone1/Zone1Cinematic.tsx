"use client";

import { useCinematic } from "@/lib/cinematic/CinematicContext";
import ShootingStar from "./ShootingStar";
import Shockwave from "./Shockwave";
import ParticleText from "./ParticleText";

/**
 * Zone1Cinematic — orchestrates the three cinematic actors that live inside
 * the persistent <Canvas>.
 *
 * After the cinematic ends:
 *   - ShootingStar self-fades and is unmounted (no point burning frames).
 *   - Shockwave is one-shot; unmounts post-cinematic.
 *   - ParticleText REMAINS — it's now the persistent hero name.
 *
 * The CometScar lives at SpaceScene root because it spans multiple zones.
 */
export default function Zone1Cinematic() {
  const { isDone } = useCinematic();
  return (
    <>
      {!isDone && <ShootingStar />}
      {!isDone && <Shockwave />}
      {/* ParticleText is always mounted — it becomes the name itself. */}
      <ParticleText />
    </>
  );
}
