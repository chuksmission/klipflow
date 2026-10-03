"use client";
import { useTranslations } from "next-intl";
import { ArrowRight, Drama, Film, Languages, Layers, Music, Repeat2, ScanFace, type LucideIcon } from "lucide-react";
import type { ShowcaseItem } from "../ShowcaseGrid";
import type { StudioModuleId } from "../catalog";
import LazyVideo from "./LazyVideo";
import { FEATURES } from "./home-data";

const ICONS: Record<string, LucideIcon> = {
  textToVideo: Film, translator: Languages, actorSwap: ScanFace, facelessReels: Drama, seriesCloner: Layers, videoRemix: Repeat2, musicStudio: Music,
};

interface Props {
  clips: (ShowcaseItem | null)[];
  onOpen: (module: StudioModuleId) => void;
}

/** Placeholder "video": drifting violet light with the feature's name, until a real clip is featured. */
export function MediaPlaceholder({ label, icon: Icon, seed = 0 }: { label: string; icon: LucideIcon; seed?: number }) {
  return (
    <div className="kf-ambient absolute inset-0 grid place-items-center" style={{ "--x1": `${15 + (seed * 23) % 60}%`, "--x2": `${85 - (seed * 17) % 50}%`, animationDelay: `-${seed * 3}s` } as React.CSSProperties}>
      <div className="flex flex-col items-center gap-3 text-center">
        <Icon size={34} strokeWidth={1.25} className="text-white/35" aria-hidden />
        <span className="px-4 text-lg font-semibold tracking-tight text-white/70 md:text-2xl">{label}</span>
      </div>
    </div>
  );
}

/** Kling-style vertical stack of full-width video cards, one per feature. */
export default function FeatureStack({ clips, onOpen }: Props) {
  const t = useTranslations("landing.features");
  return (
    <section id="features" className="scroll-mt-16 px-4 pb-24 pt-4 md:px-8">
      <div className="mx-auto max-w-3xl space-y-12 md:space-y-16">
        {FEATURES.map((f, i) => {
          const clip = clips[i];
          const Icon = ICONS[f.id];
          const soon = f.module === null;
          const last = i === FEATURES.length - 1;
          return (
            <article key={f.id}>
              <button type="button" disabled={soon} onClick={() => f.module && onOpen(f.module)}
                className="group relative block aspect-video w-full overflow-hidden rounded-2xl bg-surface text-start disabled:cursor-default"
                aria-label={t(`${f.id}.title`)}>
                {clip
                  ? <LazyVideo src={clip.video_url} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                  : <MediaPlaceholder label={t(`${f.id}.title`)} icon={Icon} seed={i} />}
                {soon && <span className="absolute start-3 top-3 rounded-full border border-white/25 bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white/85 backdrop-blur">{t("soon")}</span>}
              </button>
              <h3 className="mt-4 text-[17px] font-semibold tracking-[0.01em] text-ink md:text-xl">{t(`${f.id}.title`)}</h3>
              <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-muted">{t(`${f.id}.desc`)}</p>
              {last && (
                <div className="mt-10 flex justify-center">
                  <button type="button" onClick={() => onOpen("text_to_video")}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/60 px-5 text-sm font-medium text-white transition-colors hover:bg-white hover:text-black">
                    {t("tryNow")} <ArrowRight size={15} className="rtl:-scale-x-100" aria-hidden />
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
