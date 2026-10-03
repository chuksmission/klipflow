"use client";
import { useRef, useState } from "react";
import { Check, ChevronDown, Copy, WandSparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { SHOWCASE_CATEGORIES, VIDEO_MODELS, moduleForGenerationType, type StudioModuleId } from "./catalog";
import { useLanguageLabels } from "../lib/use-language-labels";
import { ACTOR_SWAP_LANGUAGES } from "../lib/actor-swap";

export interface ShowcaseItem {
  id: number | string;
  type: string | null;
  /** null when the admin hid it, or for tools that start from an uploaded video */
  prompt: string | null;
  video_url: string;
  output_type: string | null;
  model: string | null;
  aspect_ratio: string | null;
  duration: string | null;
  featured_category: string | null;
  featured_title: string | null;
  language?: string | null;
  accent?: string | null;
  /** Input image for image modules, when the admin allows showing it */
  source_image_url?: string | null;
  /** Settings used by upload tools, shown instead of their private input */
  settings?: Record<string, string> | null;
}

// Modules that start from an image the visitor supplies
const IMAGE_INPUT_MODULES = new Set<StudioModuleId>(["image_to_video", "ugc_ad", "image_ad", "ai_actor_swap"]);

const aspectClass = (ar: string | null) =>
  ar === "9:16" ? "aspect-[9/16]" : ar === "1:1" ? "aspect-square" : ar === "4:5" ? "aspect-[4/5]" : "aspect-video";

const badgeClass = "inline-flex h-6 items-center rounded-md border border-line bg-raised px-2 text-[11px] text-ink-muted";

function PromptUsed({ prompt }: { prompt: string }) {
  const t = useTranslations("showcase");
  const c = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [copied, setCopied] = useState(false);
  const long = prompt.length > 150 || prompt.split("\n").length > 3;

  const copy = async () => {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };

  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted transition-colors hover:text-ink">
        {open ? t("hidePrompt") : t("showPrompt")}
        <ChevronDown size={13} className={"transition-transform " + (open ? "rotate-180" : "")} aria-hidden />
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-line bg-canvas/60 p-2.5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">{t("promptUsed")}</span>
            <button type="button" onClick={copy} aria-label={t("copyPrompt")}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-ink-subtle transition-colors hover:bg-white/5 hover:text-ink">
              {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />} {copied ? c("copied") : c("copy")}
            </button>
          </div>
          {/* Prompts stay in the language they were written in */}
          <p dir="auto" className={"whitespace-pre-line break-words font-mono text-xs italic leading-relaxed text-ink-subtle " + (full ? "" : "line-clamp-3")}>
            {prompt}
          </p>
          {long && (
            <button type="button" onClick={() => setFull(!full)} className="mt-1 text-[11px] font-medium text-accent-text hover:underline">
              {full ? t("showLess") : t("showMore")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// "Translated: English → French", "Remix mode: Restyle"... for tools whose input stays private
function useSettingsLine() {
  const t = useTranslations("showcase");
  const remix = useTranslations("remix");
  const cloner = useTranslations("cloner");
  const swap = useTranslations("actorSwap");
  const labels = useLanguageLabels();
  // Languages are stored as codes or English names
  const lang = (v: string) => {
    const l = ACTOR_SWAP_LANGUAGES.find((x) => x.code === v || x.name.toLowerCase() === v.toLowerCase());
    return l ? labels.language(l.code) : v;
  };
  return (type: string | null, s: Record<string, string> | null | undefined): string | null => {
    if (!s) return null;
    if (s.template) return t("settingTemplate", { name: s.template });
    if ((type === "video_translation" || type === "video_translator") && s.from && s.to) return t("settingTranslated", { from: lang(s.from), to: lang(s.to) });
    if (type === "video_remix" && s.mode && remix.has(`modes.${s.mode}.title`)) return t("settingRemix", { mode: remix(`modes.${s.mode}.title`) });
    if (type === "series_cloner" && (s.mode === "single" || s.mode === "series")) return t("settingCloner", { mode: cloner(s.mode === "single" ? "singleTitle" : "seriesTitle") });
    if (type === "ai_actor_swap" && s.changes) {
      const what = s.changes.split(",").filter((c) => c === "face" || c === "voice").map((c) => swap(`rate.${c}`));
      if (s.to && s.changes.includes("voice")) what.push(lang(s.to));
      return what.length ? t("settingChanged", { what: what.join(", ") }) : null;
    }
    return null;
  };
}

function ShowcaseCard({ item, onUse }: { item: ShowcaseItem; onUse: (item: ShowcaseItem) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const t = useTranslations("showcase");
  const m = useTranslations("modules");
  const labels = useLanguageLabels();
  const settingsLine = useSettingsLine()(item.type, item.settings);
  const isImage = item.output_type === "image";
  const moduleId = moduleForGenerationType(item.type, item.model);
  const moduleTitle = m.has(`${moduleId}.title`) ? m(`${moduleId}.title`) : item.type?.replace(/_/g, " ");
  const title = item.featured_title || moduleTitle || t("madeWith");
  // Demo videos are labelled "Demo Studio · <tool>"; the tool badge already says which
  const model = item.type === "demo_video" ? null : (VIDEO_MODELS.find((v) => v.id === item.model)?.name ?? item.model);
  const seconds = !isImage && item.duration && /^\d+$/.test(item.duration) ? Number(item.duration) : null;
  const language = item.language && item.language !== "en"
    ? labels.language(item.language) + (item.accent ? ` · ${labels.accent(item.accent)}` : "")
    : null;

  return (
    <figure className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-line bg-surface">
      <div
        className="relative"
        onMouseEnter={() => videoRef.current?.play().catch(() => {})}
        onMouseLeave={() => { const v = videoRef.current; if (v) { v.pause(); v.currentTime = 0; } }}
      >
        {isImage ? (
          <img src={item.video_url} alt={title} loading="lazy" className={"w-full object-cover " + aspectClass(item.aspect_ratio)} />
        ) : (
          <video
            ref={videoRef}
            src={item.video_url + "#t=0.1"}
            muted
            loop
            playsInline
            preload="metadata"
            className={"w-full bg-black object-cover " + aspectClass(item.aspect_ratio)}
          />
        )}
        {item.source_image_url && (
          <div className="absolute start-2 top-2 flex items-center gap-1.5 rounded-lg bg-black/70 p-1 pe-2 backdrop-blur-sm">
            <img src={item.source_image_url} alt={t("sourceImage")} loading="lazy" className="h-10 w-10 rounded-md object-cover" />
            <span className="text-[11px] font-medium text-white/85">{t("sourceImage")}</span>
          </div>
        )}
      </div>
      <figcaption className="space-y-2.5 p-3">
        <p className="truncate text-sm font-medium text-ink" title={title}>{title}</p>
        <ul className="flex flex-wrap gap-1.5" aria-label={t("settings")}>
          {moduleTitle && <li className={badgeClass + " text-accent-text"}>{moduleTitle}</li>}
          {model && <li className={badgeClass}>{model}</li>}
          {seconds !== null && <li className={badgeClass}>{t("seconds", { s: seconds })}</li>}
          {item.aspect_ratio && <li className={badgeClass}>{item.aspect_ratio}</li>}
          {language && <li className={badgeClass}>{language}</li>}
        </ul>
        {settingsLine && <p className="text-xs text-ink-muted">{settingsLine}</p>}
        {item.prompt && <PromptUsed prompt={item.prompt} />}
        <button
          type="button"
          onClick={() => onUse(item)}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-accent/60 text-[13px] font-medium text-accent-text transition-colors hover:border-accent hover:bg-accent/10"
        >
          <WandSparkles size={14} aria-hidden /> {t("tryIt")}
        </button>
        {(IMAGE_INPUT_MODULES.has(moduleId) || item.source_image_url) && <p className="text-center text-[11px] text-ink-subtle">{t("uploadOwn")}</p>}
      </figcaption>
    </figure>
  );
}

export default function ShowcaseGrid({ items, onUse }: { items: ShowcaseItem[]; onUse: (item: ShowcaseItem) => void }) {
  const t = useTranslations("showcase");
  const [category, setCategory] = useState<string>("all");
  const available = SHOWCASE_CATEGORIES.filter((c) => items.some((i) => i.featured_category === c.id));
  const visible = category === "all" ? items : items.filter((i) => i.featured_category === category);

  return (
    <div>
      {available.length > 1 && (
        <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto" role="tablist" aria-label={t("categories")}>
          {[{ id: "all", label: t("all") }, ...available.map((c) => ({ id: c.id, label: t(`category.${c.id}`) }))].map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={category === c.id}
              onClick={() => setCategory(c.id)}
              className={
                "h-9 flex-shrink-0 rounded-full border px-4 text-sm transition-colors " +
                (category === c.id ? "border-white bg-white text-black" : "border-line text-ink-muted hover:border-line-strong hover:text-ink")
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      <div className="columns-1 gap-4 sm:columns-2 md:columns-3 xl:columns-4">
        {visible.map((item) => <ShowcaseCard key={item.id} item={item} onUse={onUse} />)}
      </div>
    </div>
  );
}
