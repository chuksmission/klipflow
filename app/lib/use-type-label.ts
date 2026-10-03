"use client";
// Human label for a generation's stored `type` (e.g. "text_to_video"), in the
// interface language when it's a known Studio module.
import { useTranslations } from "next-intl";

const ALIASES: Record<string, string> = { video_translation: "video_translator" };

export function useTypeLabel() {
  const m = useTranslations("modules");
  const g = useTranslations("generationTypes");
  return (type: string | null | undefined): string => {
    if (!type) return g("video");
    const key = ALIASES[type] ?? type;
    if (m.has(`${key}.title`)) return m(`${key}.title`);
    if (g.has(key)) return g(key);
    return type.replace(/_/g, " ");
  };
}
