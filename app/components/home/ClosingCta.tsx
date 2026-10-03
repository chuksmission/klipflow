"use client";
import { useTranslations } from "next-intl";

/** Bookend of the hero: the same serif headline over slow violet waves. */
export default function ClosingCta({ serifClass, onStart }: { serifClass: string; onStart: () => void }) {
  const t = useTranslations("landing");
  return (
    <section className="relative overflow-hidden px-4 py-32 text-center md:py-40">
      <svg aria-hidden className="pointer-events-none absolute inset-x-[-10%] bottom-[-10%] h-[90%] w-[120%] opacity-70" viewBox="0 0 1200 400" preserveAspectRatio="none">
        <defs>
          <linearGradient id="kfw1" x1="0" x2="1"><stop offset="0" stopColor="#6d4aff" stopOpacity="0" /><stop offset=".5" stopColor="#6d4aff" stopOpacity=".55" /><stop offset="1" stopColor="#22d3ee" stopOpacity="0" /></linearGradient>
          <linearGradient id="kfw2" x1="0" x2="1"><stop offset="0" stopColor="#a795ff" stopOpacity="0" /><stop offset=".45" stopColor="#a795ff" stopOpacity=".35" /><stop offset="1" stopColor="#6d4aff" stopOpacity="0" /></linearGradient>
          <filter id="kfblur"><feGaussianBlur stdDeviation="18" /></filter>
        </defs>
        <g filter="url(#kfblur)">
          <path className="kf-wave" d="M0 260 C 200 180, 400 340, 600 250 S 1000 160, 1200 240 L1200 400 L0 400 Z" fill="url(#kfw1)" />
          <path className="kf-wave kf-wave--slow" d="M0 300 C 250 230, 450 360, 700 290 S 1050 230, 1200 300 L1200 400 L0 400 Z" fill="url(#kfw2)" />
        </g>
      </svg>
      <div aria-hidden className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-canvas to-transparent" />
      <div className="relative">
        <h2 className={`${serifClass} mx-auto max-w-4xl text-4xl font-bold italic leading-[1.05] tracking-tight text-white sm:text-5xl md:text-7xl`}>{t("hero.title")}</h2>
        <button onClick={onStart} className="mt-9 inline-flex h-11 items-center rounded-full border border-white/70 px-7 text-[15px] font-medium text-white transition-colors hover:bg-white hover:text-black">
          {t("closing.cta")}
        </button>
      </div>
    </section>
  );
}
