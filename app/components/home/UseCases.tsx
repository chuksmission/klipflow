"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Braces, Building2, GraduationCap, Music, ShoppingBag, Video, type LucideIcon } from "lucide-react";
import type { ShowcaseItem } from "../ShowcaseGrid";
import LazyVideo from "./LazyVideo";
import { MediaPlaceholder } from "./FeatureStack";
import { USE_CASES, type UseCase } from "./home-data";

const TAB_ICONS: Record<string, LucideIcon> = {
  creators: Video, brands: Building2, musicians: Music, ecommerce: ShoppingBag, educators: GraduationCap, developers: Braces,
};

interface Props {
  /** Clip per card, keyed "tab/card" */
  clips: Record<string, ShowcaseItem | null>;
  onCard: (card: UseCase) => void;
}

/** Kling "Industry Applications": sticky tab pills over a swipeable row of use-case cards. */
export default function UseCases({ clips, onCard }: Props) {
  const t = useTranslations("landing.useCases");
  const [tab, setTab] = useState(USE_CASES[0].id);
  const row = useRef<HTMLDivElement>(null);
  const current = USE_CASES.find((u) => u.id === tab) ?? USE_CASES[0];

  const pick = (id: string) => {
    setTab(id);
    row.current?.scrollTo({ left: 0, behavior: "smooth" });
  };

  return (
    <section id="use-cases" className="scroll-mt-16 py-24">
      <div className="mx-auto max-w-6xl px-4 text-center md:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">{t("title")}</h2>
        <p className="mt-3 text-sm text-ink-muted md:text-base">{t("subtitle")}</p>
      </div>

      {/* Tabs stick under the header while the cards are on screen */}
      <div className="sticky top-14 z-20 mt-8 bg-gradient-to-b from-canvas via-canvas/95 to-canvas/0 pb-3 pt-3 md:top-16">
        <div className="no-scrollbar mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 md:justify-center md:px-8" role="tablist" aria-label={t("title")}>
          {USE_CASES.map((u) => (
            <button key={u.id} role="tab" aria-selected={tab === u.id} onClick={() => pick(u.id)}
              className={`inline-flex h-9 shrink-0 items-center rounded-full px-4 text-[13px] transition-colors ${tab === u.id ? "bg-white font-medium text-black" : "border border-white/15 text-white/60 hover:text-white"}`}>
              {t(`tabs.${u.id}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl">
        <p className="mt-2 px-4 text-center text-base font-medium text-white/85 md:px-8 md:text-lg">{t(`headlines.${tab}`)}</p>
        <div ref={row} className="no-scrollbar mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 md:gap-4 md:scroll-px-8 md:px-8" role="tabpanel">
          {current.cards.map((card, i) => {
            const clip = clips[`${tab}/${card.id}`] ?? null;
            return (
              <button key={`${tab}-${card.id}`} type="button" onClick={() => onCard(card)}
                className="group w-[78%] shrink-0 snap-start overflow-hidden rounded-xl border border-white/[0.08] bg-surface text-start transition-colors hover:border-white/20 sm:w-[46%] lg:w-[calc(25%-0.75rem)]">
                <div className="relative aspect-[4/3] overflow-hidden">
                  {clip
                    ? <LazyVideo src={clip.video_url} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    : <MediaPlaceholder label="" icon={TAB_ICONS[tab]} seed={i + 2} />}
                </div>
                <div className="p-4">
                  <h3 className="text-[15px] font-semibold leading-snug text-white">{t(`cards.${card.id}.title`)}</h3>
                  <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-ink-muted">{t(`cards.${card.id}.desc`)}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
