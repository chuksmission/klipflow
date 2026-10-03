"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, MousePointer2, Sparkles } from "lucide-react";
import type { ShowcaseItem } from "../ShowcaseGrid";
import type { StudioModuleId } from "../catalog";
import LazyVideo from "./LazyVideo";
import { DEMO_SLIDES, DEMO_SLIDE_MS } from "./home-data";

interface Props {
  /** Featured Demo Studio recording per slide (null: placeholder) */
  clips: (ShowcaseItem | null)[];
  onOpen: (module: StudioModuleId) => void;
}

/** Skeleton of the Studio with a fake cursor, until a real Demo Studio recording is featured. */
function DemoPlaceholder({ slide }: { slide: string }) {
  const t = useTranslations("landing.demo");
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0e0d15]">
      <div className="flex h-8 items-center gap-1.5 border-b border-white/[0.06] px-3">
        {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-white/15" />)}
        <span className="ms-3 h-2 w-24 rounded-full bg-white/10" />
      </div>
      <div className="grid h-[calc(100%-2rem)] grid-cols-[30%_1fr] gap-3 p-3">
        <div className="space-y-2 rounded-lg bg-white/[0.03] p-2.5">
          {[70, 50, 85, 40, 60].map((w, i) => <span key={i} className="block h-2 rounded-full bg-white/10" style={{ width: `${w}%` }} />)}
          <span className="mt-4 block rounded-md border border-accent/40 bg-accent/10 px-2 py-1.5 text-[10px] text-accent-text">{t(`${slide}.chip`)}</span>
        </div>
        <div className="flex flex-col gap-3">
          <div className="kf-ambient relative flex-1 rounded-lg">
            <span className="absolute inset-0 grid place-items-center text-xs font-medium uppercase tracking-[0.2em] text-white/45">{t("soon")}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2">
            <span className="h-2 flex-1 rounded-full bg-white/10" />
            <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-white"><Sparkles size={12} aria-hidden /></span>
          </div>
        </div>
      </div>
      <div aria-hidden className="kf-cursor pointer-events-none absolute inset-0">
        <MousePointer2 className="absolute left-0 top-0 fill-white text-black drop-shadow" style={{ width: 20, height: 20 }} />
      </div>
    </div>
  );
}

/** "See it in action": Demo Studio screen recordings that auto-advance, Kling Canvas style. */
export default function DemoCarousel({ clips, onOpen }: Props) {
  const t = useTranslations("landing.demo");
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Advance every DEMO_SLIDE_MS while on screen (a recording that ends sooner advances itself)
  useEffect(() => {
    if (!visible) return;
    const id = window.setTimeout(() => setActive((a) => (a + 1) % DEMO_SLIDES.length), DEMO_SLIDE_MS);
    return () => window.clearTimeout(id);
  }, [active, visible]);

  const slide = DEMO_SLIDES[active];
  const clip = clips[active];

  return (
    <section id="demo" ref={ref} className="scroll-mt-16 px-4 py-24 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">{t("title")}</h2>
          <p className="mt-3 text-sm text-ink-muted md:text-base">{t("subtitle")}</p>
        </div>

        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12">
          <div className="order-2 lg:order-1">
            <div className="min-h-[9.5rem]">
              <h3 className="text-xl font-semibold tracking-[0.01em] text-white md:text-2xl">{t(`${slide.id}.title`)}</h3>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-muted">{t(`${slide.id}.desc`)}</p>
            </div>
            <div className="mt-4 flex gap-2" role="tablist" aria-label={t("title")}>
              {DEMO_SLIDES.map((s, i) => (
                <button key={s.id} role="tab" aria-selected={i === active} aria-label={t(`${s.id}.title`)} onClick={() => setActive(i)}
                  className="group relative h-6 flex-1 lg:max-w-20">
                  <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-white/15 group-hover:bg-white/25">
                    {i === active && <span key={`${active}-${visible}`} className="kf-dash-fill absolute inset-0 rounded-full bg-white"
                      style={{ "--kf-dash": `${DEMO_SLIDE_MS}ms`, animationPlayState: visible ? "running" : "paused" } as React.CSSProperties} />}
                    {i < active && <span className="absolute inset-0 rounded-full bg-white/60" />}
                  </span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => onOpen(slide.module)}
              className="mt-8 inline-flex h-10 items-center gap-1.5 rounded-full border border-white/60 px-5 text-sm font-medium text-white transition-colors hover:bg-white hover:text-black">
              {t("tryNow")} <ArrowRight size={15} className="rtl:-scale-x-100" aria-hidden />
            </button>
          </div>

          <div className="order-1 lg:order-2">
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/[0.08] bg-surface shadow-[0_30px_80px_-30px_rgb(109_74_255/0.35)]">
              {clip
                ? <LazyVideo key={clip.id} src={clip.video_url} loop={false} onEnded={() => setActive((a) => (a + 1) % DEMO_SLIDES.length)} className="absolute inset-0 h-full w-full object-cover" />
                : <DemoPlaceholder key={slide.id} slide={slide.id} />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
