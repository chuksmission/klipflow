"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import type { ShowcaseItem } from "../ShowcaseGrid";
import LazyVideo from "./LazyVideo";
import { MediaPlaceholder } from "./FeatureStack";
import { CREATORS } from "./home-data";

/** Placeholder avatar: a lit gradient portrait tile with initials (until real creator photos). */
function Avatar({ name, hue, size }: { name: string; hue: number; size: number }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <span className="grid place-items-center overflow-hidden rounded-2xl font-semibold text-white/90"
      style={{ width: size, height: size, fontSize: size * 0.32, background: `radial-gradient(90% 90% at 30% 20%, hsl(${hue} 85% 68%), hsl(${hue} 70% 32%) 55%, hsl(${hue} 60% 12%))` }}>
      {initials}
    </span>
  );
}

/** Kling "Creative Partners": avatar row with the centre one enlarged, then that creator's featured video. */
export default function CreatorSpotlight({ clips }: { clips: ShowcaseItem[] }) {
  const t = useTranslations("landing.creators");
  const [index, setIndex] = useState(0);
  const n = CREATORS.length;
  const go = (d: number) => setIndex((i) => (i + d + n) % n);
  const creator = CREATORS[index];
  const clip = clips.length ? clips[index % clips.length] : null;

  // Five visible slots centred on the active creator
  const slots = [-2, -1, 0, 1, 2].map((o) => ({ o, c: CREATORS[(index + o + n) % n] }));

  return (
    <section id="creators" className="scroll-mt-16 px-4 py-24 md:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">{t("title")}</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-ink-muted md:text-base">{t("subtitle")}</p>

        <div className="mt-10 flex items-center justify-center gap-2 sm:gap-4">
          <button onClick={() => go(-1)} aria-label={t("previous")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 text-white/70 hover:text-white">
            <ChevronLeft size={18} className="rtl:-scale-x-100" aria-hidden />
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            {slots.map(({ o, c }) => (
              <button key={`${c.id}-${o}`} onClick={() => go(o)} aria-label={c.name} aria-current={o === 0}
                className={`transition-all duration-300 ${o === 0 ? "" : Math.abs(o) === 1 ? "opacity-55 hover:opacity-80" : "hidden opacity-30 hover:opacity-60 sm:block"}`}>
                <Avatar name={c.name} hue={c.hue} size={o === 0 ? 76 : 48} />
              </button>
            ))}
          </div>
          <button onClick={() => go(1)} aria-label={t("next")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 text-white/70 hover:text-white">
            <ChevronRight size={18} className="rtl:-scale-x-100" aria-hidden />
          </button>
        </div>

        <div className="relative mx-auto mt-8 aspect-video max-w-3xl overflow-hidden rounded-2xl bg-surface">
          {clip
            ? <LazyVideo key={`${creator.id}-${clip.id}`} src={clip.video_url} className="absolute inset-0 h-full w-full object-cover" />
            : <MediaPlaceholder label="" icon={UserRound} seed={index} />}
        </div>

        <div className="mx-auto mt-6 max-w-3xl text-start">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-white">{creator.name}</h3>
            {creator.sample && <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/50">{t("sample")}</span>}
          </div>
          <p className="mt-0.5 text-sm text-accent-text">{t(`people.${creator.id}.niche`)}</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">&ldquo;{t(`people.${creator.id}.quote`)}&rdquo;</p>
        </div>
      </div>
    </section>
  );
}
