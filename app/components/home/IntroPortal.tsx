"use client";
import { useEffect } from "react";
import { BrandIcon } from "./Brand";

/** Wordmark → icon → glowing ring → oval portal onto the hero (about 2 seconds). */
export default function IntroPortal() {
  useEffect(() => {
    if (!document.documentElement.classList.contains("kf-intro-on")) return;
    const id = window.setTimeout(() => document.documentElement.classList.remove("kf-intro-on"), 2300);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="kf-intro pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden>
      {/* Ring + oval mask underneath; the wordmark layer above fades away to reveal them */}
      <div className="absolute inset-0" style={{ perspective: "600px" }}>
        <div className="kf-intro__hole" />
        <div className="kf-intro__ring" />
      </div>
      <div className="kf-intro__backdrop absolute inset-0 grid place-items-center bg-canvas">
        <div className="kf-intro__mark flex items-center">
          <span className="kf-intro__icon inline-block"><BrandIcon size={64} /></span>
          <span className="kf-intro__word overflow-hidden whitespace-nowrap text-[2.6rem] font-semibold tracking-tight text-ink">KlipflowAI</span>
        </div>
      </div>
    </div>
  );
}
