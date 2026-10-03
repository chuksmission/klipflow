"use client";
// Interface language dropdown: flag + native name. Switching re-renders the
// page in place (no reload) and remembers the choice.
import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { LOCALES, LOCALE_INFO, type Locale } from "../../i18n/config";
import { saveProfileLocale, storeLocale, writeLocaleCookie } from "../lib/locale-client";

interface Props {
  /** Open the list above the button (footers, bottom of menus) */
  up?: boolean;
  /** Stretch to the container width (mobile menus, settings) */
  block?: boolean;
  className?: string;
}

// Windows has no flag glyphs; Noto Color Emoji (loaded in the root layout) supplies them
const FLAG_FONT = { fontFamily: "var(--font-noto-emoji), \"Apple Color Emoji\", \"Segoe UI Emoji\", sans-serif" };

export default function LanguageSwitcher({ up = false, block = false, className = "" }: Props) {
  const t = useTranslations("language");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const choose = (next: Locale) => {
    setOpen(false);
    if (next === locale) return;
    writeLocaleCookie(next);
    storeLocale(next);
    void saveProfileLocale(next);
    startTransition(() => router.refresh());
  };

  const current = LOCALE_INFO[locale];
  return (
    // Callers' position/display classes (e.g. "hidden sm:inline-block") must win over the defaults
    <div ref={root} className={`${/(^|\s)(absolute|fixed)(\s|$)/.test(className) ? "" : "relative"} ${block ? "w-full" : /(^|\s)(hidden|block|inline-block)(\s|$)/.test(className) ? "" : "inline-block"} ${className}`}>
      <button
        type="button" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open} aria-label={t("label")}
        className={`inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-raised px-2.5 text-sm text-ink transition-colors hover:border-line-strong ${block ? "w-full justify-between" : ""}`}
      >
        <span className="flex items-center gap-2">
          <span aria-hidden className="text-base leading-none" style={FLAG_FONT}>{current.flag}</span>
          <span>{current.name}</span>
        </span>
        {pending ? <Loader2 size={14} className="animate-spin text-ink-subtle" aria-hidden /> : <ChevronDown size={14} className="text-ink-subtle" aria-hidden />}
      </button>
      {open && (
        <ul
          role="listbox" aria-label={t("label")}
          className={`absolute z-50 max-h-80 w-52 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-2xl ${up ? "bottom-full mb-2" : "top-full mt-2"} ${block ? "start-0 w-full" : "end-0"}`}
        >
          {LOCALES.map((l) => (
            <li key={l} role="option" aria-selected={l === locale}>
              <button type="button" onClick={() => choose(l)} lang={l} dir={LOCALE_INFO[l].rtl ? "rtl" : "ltr"}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm transition-colors hover:bg-raised ${l === locale ? "text-ink" : "text-ink-muted"}`}>
                <span aria-hidden className="text-base leading-none" style={FLAG_FONT}>{LOCALE_INFO[l].flag}</span>
                <span className="flex-1">{LOCALE_INFO[l].name}</span>
                {l === locale && <Check size={14} className="text-accent-text" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
