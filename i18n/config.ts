// Interface languages: one dominant official language per market. Countries
// where English is the official language across many local languages (e.g.
// Nigeria) are served in English.

export const LOCALES = ["en", "fr", "es", "pt", "ar", "hi", "de", "it", "tr", "ru", "bg", "sw"] as const;
export type Locale = typeof LOCALES[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "kf_locale";
export const LOCALE_STORAGE_KEY = "kf_locale";

export const LOCALE_INFO: Record<Locale, { name: string; flag: string; rtl?: boolean }> = {
  en: { name: "English", flag: "🇬🇧" },
  fr: { name: "Français", flag: "🇫🇷" },
  es: { name: "Español", flag: "🇪🇸" },
  pt: { name: "Português", flag: "🇧🇷" },
  ar: { name: "عربي", flag: "🇸🇦", rtl: true },
  hi: { name: "हिन्दी", flag: "🇮🇳" },
  de: { name: "Deutsch", flag: "🇩🇪" },
  it: { name: "Italiano", flag: "🇮🇹" },
  tr: { name: "Türkçe", flag: "🇹🇷" },
  ru: { name: "Русский", flag: "🇷🇺" },
  bg: { name: "Български", flag: "🇧🇬" },
  sw: { name: "Kiswahili", flag: "🇰🇪" },
};

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

export const isRtl = (l: Locale) => LOCALE_INFO[l].rtl === true;

/** Best supported match for a browser language list ("fr-CA,fr;q=0.9,en;q=0.8" or ["pt-BR", "en"]). */
export function matchLocale(input: string | readonly string[] | null | undefined): Locale {
  const list = Array.isArray(input)
    ? input
    : String(input ?? "").split(",").map((part) => part.split(";")[0].trim()).filter(Boolean);
  for (const tag of list) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
