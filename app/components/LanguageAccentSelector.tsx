"use client";
// Two-step output language → accent picker (the AI Actor Swap list), shared by
// the Studio modules, AI Actor Swap and the admin Showcase Studio.
import { useTranslations } from "next-intl";
import { ACTOR_SWAP_LANGUAGES } from "../lib/actor-swap";
import { useLanguageLabels } from "../lib/use-language-labels";
import { Field, Select } from "./ui";

export interface LanguageChoice { language: string; accent: string }

export const DEFAULT_LANGUAGE: LanguageChoice = { language: "en", accent: ACTOR_SWAP_LANGUAGES[0].accents[0] };

export const languageName = (code: string) => ACTOR_SWAP_LANGUAGES.find((l) => l.code === code)?.name ?? "English";

/** First accent of a language (the default when the language changes). */
export const defaultAccent = (code: string) => ACTOR_SWAP_LANGUAGES.find((l) => l.code === code)?.accents[0] ?? "";

interface Props {
  value: LanguageChoice;
  onChange: (next: LanguageChoice) => void;
  /** Group heading; omit to show only the two fields */
  label?: string;
  languageLabel?: string;
  accentLabel?: string;
  /** Start with no language chosen ("Choose a language") instead of English */
  allowEmpty?: boolean;
}

export default function LanguageAccentSelector({
  value, onChange, label, languageLabel, accentLabel, allowEmpty = false,
}: Props) {
  const t = useTranslations("languageSelector");
  const labels = useLanguageLabels();
  const language = ACTOR_SWAP_LANGUAGES.find((l) => l.code === value.language) ?? null;
  const fields = (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={languageLabel ?? t("language")}>
        <Select value={value.language} onChange={(e) => onChange({ language: e.target.value, accent: defaultAccent(e.target.value) })}>
          {allowEmpty && <option value="" disabled>{t("choose")}</option>}
          {ACTOR_SWAP_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{labels.language(l.code)}</option>)}
        </Select>
      </Field>
      <Field label={accentLabel ?? t("accent")}>
        <Select value={value.accent} onChange={(e) => onChange({ ...value, accent: e.target.value })} disabled={!language}>
          {!language && <option value="">{t("chooseFirst")}</option>}
          {language?.accents.map((a) => <option key={a} value={a}>{labels.accent(a)}</option>)}
        </Select>
      </Field>
    </div>
  );
  if (!label) return fields;
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-[13px] font-medium text-ink-muted">{label}</legend>
      {fields}
    </fieldset>
  );
}
