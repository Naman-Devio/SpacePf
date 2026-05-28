import type { Metadata } from "next";
import { Syne_Mono, Space_Mono, DM_Sans } from "next/font/google";
import "./globals.css";

/**
 * Spec-mandated typography:
 *   Display / name        → Syne Mono 700
 *   HUD / terminal labels → Space Mono 400
 *   Body / dossier copy   → DM Sans 400
 *
 * Loaded via `next/font` (Google) per spec; self-hosted WOFF2 fallback lives in
 * /public/fonts/ and will be wired in a later phase via font-display: swap.
 */
const syneMono = Syne_Mono({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-syne-mono",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-space-mono",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "Naman Devio — Dead Star Signal",
  description:
    "Engineering systems that outlive their author. Bot systems, API meshes, and immersive web craft — shipped, not demoed.",
  authors: [{ name: "Naman Devio" }],
  openGraph: {
    title: "Naman Devio — Dead Star Signal",
    description: "A signal from deep space. Scroll to receive.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${syneMono.variable} ${spaceMono.variable} ${dmSans.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
