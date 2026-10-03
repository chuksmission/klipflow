"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Languages } from "lucide-react";
import { LOCALES, LOCALE_INFO } from "../../../i18n/config";
import type { ShowcaseItem } from "../ShowcaseGrid";
import LazyVideo from "./LazyVideo";
import { LANGUAGE_DEMO } from "./home-data";

const FLAG_FONT = { fontFamily: "var(--font-noto-emoji), \"Apple Color Emoji\", \"Segoe UI Emoji\", sans-serif" };

// The sample line as each version speaks it (always shown in that language)
const SAMPLE_LINE: Record<(typeof LANGUAGE_DEMO)[number], string> = {
  en: "This is how your story sounds in English.",
  fr: "Voici votre histoire, racontée en français.",
  es: "Así suena tu historia en español.",
};

function Pill({ code }: { code: (typeof LOCALES)[number] }) {
  const info = LOCALE_INFO[code];
  return (
    <span className="me-3 inline-flex h-11 shrink-0 items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-5 text-sm text-white/80">
      <span style={FLAG_FONT} className="text-lg leading-none">{info.flag}</span>{info.name}
    </span>
  );
}

/** Our differentiator: every language. Floating language pills, then one clip in three languages. */
export default function LanguageSection({ clip, onStart }: { clip: ShowcaseItem | null; onStart: () => void }) {
  const t = useTranslations("landing.languages");
  const [lang, setLang] = useState<(typeof LANGUAGE_DEMO)[number]>("en");

  // Cycle the three versions
  useEffect(() => {
    const id = window.setTimeout(() => setLang((l) => LANGUAGE_DEMO[(LANGUAGE_DEMO.indexOf(l) + 1) % LANGUAGE_DEMO.length]), 4500);
    return () => window.clearTimeout(id);
  }, [lang]);

  const half = Math.ceil(LOCALES.length / 2);
  const rows = [LOCALES.slice(0, half), LOCALES.slice(half)];

  return (
    <section id="languages" className="scroll-mt-16 overflow-hidden py-24">
      <div className="mx-auto max-w-6xl px-4 text-center md:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">{t("title")}</h2>
        <p className="mt-3 text-sm text-ink-muted md:text-base">{t("subtitle")}</p>
      </div>

      <div className="mt-10 space-y-3" aria-label={t("pillsLabel")}>
        {rows.map((row, r) => (
          <div key={r} className="kf-marquee overflow-hidden">
            <div className={`kf-marquee__track ${r ? "kf-marquee__track--reverse" : ""}`} style={{ "--kf-speed": `${36 + r * 8}s` } as React.CSSProperties}>
              {[...row, ...row, ...row, ...row].map((code, i) => <Pill key={`${code}-${i}`} code={code} />)}
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-14 max-w-4xl px-4 md:px-8">
        <div className="mb-4 flex justify-center gap-2" role="tablist" aria-label={t("demoLabel")}>
          {LANGUAGE_DEMO.map((code) => (
            <button key={code} role="tab" aria-selected={lang === code} onClick={() => setLang(code)}
              className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm transition-colors ${lang === code ? "bg-white font-medium text-black" : "border border-white/15 text-white/65 hover:text-white"}`}>
              <span style={FLAG_FONT}>{LOCALE_INFO[code].flag}</span>{LOCALE_INFO[code].name}
            </button>
          ))}
        </div>
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-surface">
          {clip
            ? <LazyVideo src={clip.video_url} className="absolute inset-0 h-full w-full object-cover" />
            : <div className="kf-ambient absolute inset-0" />}
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
          <span className="absolute start-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            <Languages size={13} aria-hidden /> {LOCALE_INFO[lang].name}
          </span>
          <p key={lang} lang={lang} dir="ltr" className="absolute inset-x-4 bottom-5 text-center text-base font-semibold text-white drop-shadow-[0_1px_6px_rgb(0_0_0/0.8)] transition-opacity md:bottom-8 md:text-2xl">
            {SAMPLE_LINE[lang]}
          </p>
        </div>
        <p className="mt-6 text-center text-sm text-ink-muted">{t("count")}</p>
        <div className="mt-6 flex justify-center">
          <button type="button" onClick={onStart}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/60 px-5 text-sm font-medium text-white transition-colors hover:bg-white hover:text-black">
            {t("tryNow")} <ArrowRight size={15} className="rtl:-scale-x-100" aria-hidden />
          </button>
        </div>
      </div>
    </section>
  );
}
