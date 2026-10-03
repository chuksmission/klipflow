"use client";
import { useRef } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import LazyVideo from "./LazyVideo";
import { useScrollProgress } from "./use-scroll-progress";

interface Props {
  videoUrl: string | null;
  serifClass: string;
  onStart: () => void;
}

/**
 * Full-screen cinematic hero. The section is taller than the screen and its
 * content is sticky, so scrolling first plays a short transition (video
 * pushes in, headline lifts away, section label rises) before the page moves on.
 */
export default function HeroSection({ videoUrl, serifClass, onStart }: Props) {
  const t = useTranslations("landing.hero");
  const ref = useRef<HTMLElement>(null);
  useScrollProgress(ref);

  return (
    <section ref={ref} className="relative h-[175svh]" style={{ "--p": 0 } as React.CSSProperties}>
      <div className="sticky top-0 h-[100svh] overflow-hidden bg-black">
        {/* Media */}
        <div className="absolute inset-0 will-change-transform" style={{ transform: "scale(calc(1 + var(--p) * 0.28)) translateY(calc(var(--p) * -3%))" }}>
          {videoUrl
            ? <LazyVideo src={videoUrl} eager className="h-full w-full object-cover" />
            : <div className="kf-ambient h-full w-full" />}
        </div>
        {/* Darkening: a vignette always, deeper as the transition plays */}
        <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(120% 80% at 50% 40%, transparent 30%, rgb(0 0 0 / 0.55) 100%)" }} />
        <div aria-hidden className="absolute inset-0 bg-black" style={{ opacity: "calc(0.25 + var(--p) * 0.45)" }} />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-canvas via-canvas/60 to-transparent" />

        {/* Headline */}
        <div className="relative flex h-full flex-col items-center justify-center px-6 text-center"
          style={{ transform: "translateY(calc(var(--p) * -32vh))", opacity: "calc(1 - var(--p) * 1.8)" }}>
          <h1 className={`${serifClass} max-w-4xl text-[2.6rem] font-bold italic leading-[1.05] tracking-tight text-white drop-shadow-[0_2px_24px_rgb(0_0_0/0.5)] sm:text-6xl md:text-7xl`}>
            {t("title")}
          </h1>
          <p className="mt-4 text-sm text-white/70 md:text-base">{t("subtitle")}</p>
          <button onClick={onStart} className="mt-8 inline-flex h-12 items-center rounded-full bg-white px-7 text-[15px] font-semibold text-black transition-transform hover:scale-[1.03] active:scale-[0.98]">
            {t("cta")}
          </button>
        </div>

        {/* Section label that rises in as the headline leaves */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[12svh] text-center"
          style={{ opacity: "calc((var(--p) - 0.4) * 2.5)", transform: "translateY(calc((1 - var(--p)) * 40px))" }}>
          <p className="text-2xl font-semibold tracking-tight text-white md:text-4xl">{t("label")}</p>
          <p className="mt-2 text-sm text-white/55">{t("labelSub")}</p>
        </div>

        {/* Scroll hint */}
        <div aria-hidden className="absolute inset-x-0 bottom-6 flex justify-center text-white/50" style={{ opacity: "calc(1 - var(--p) * 4)" }}>
          <ChevronDown size={22} className="animate-bounce" />
        </div>
      </div>
    </section>
  );
}
