"use client";
// Display names for output languages and accents in the interface language.
// Values sent to the APIs stay the English codes / accent names.
import { useLocale, useTranslations } from "next-intl";
import { ACTOR_SWAP_LANGUAGES } from "./actor-swap";

export const accentKey = (accent: string) => accent.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export function useLanguageLabels() {
  const locale = useLocale();
  const a = useTranslations("accents");
  const names = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames([locale], { type: "language" }) : null;
  const language = (code: string) => {
    const english = ACTOR_SWAP_LANGUAGES.find((l) => l.code === code)?.name ?? code;
    // Keep "Mandarin" rather than the generic "Chinese" in English
    if (locale === "en") return english;
    const name = names?.of(code) ?? english;
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  };
  const accent = (value: string) => (a.has(accentKey(value)) ? a(accentKey(value)) : value);
  return { language, accent };
}
