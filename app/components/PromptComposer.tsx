"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { STUDIO_MODULES, type StudioModuleId } from "./catalog";

export const COMPOSER_MODES: StudioModuleId[] = [
  "text_to_video", "ugc_ad", "image_to_video", "text_to_image", "script_to_video", "video_translator",
];

// Cycles example prompts in the placeholder with a typing effect.
function useTypewriter(active: boolean, examples: string[]) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!active) return;
    let example = 0, chars = 0, deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const full = examples[example];
      if (!deleting) {
        chars++;
        setText(full.slice(0, chars));
        if (chars === full.length) { deleting = true; timer = setTimeout(tick, 1800); return; }
        timer = setTimeout(tick, 40);
      } else {
        chars--;
        setText(full.slice(0, chars));
        if (chars === 0) { deleting = false; example = (example + 1) % examples.length; timer = setTimeout(tick, 300); return; }
        timer = setTimeout(tick, 18);
      }
    };
    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, [active, examples]);
  return text;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  mode: StudioModuleId;
  onModeChange?: (m: StudioModuleId) => void;
  onSubmit: () => void;
  variant?: "hero" | "bar";
}

export default function PromptComposer({ value, onChange, mode, onModeChange, onSubmit, variant = "hero" }: Props) {
  const t = useTranslations("composer");
  const m = useTranslations("modules");
  const [focused, setFocused] = useState(false);
  const examples = t.raw("examples") as string[];
  const typed = useTypewriter(!focused && !value, examples);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const placeholder = typed || (mode === "video_translator" ? t("placeholderUpload") : t("placeholder"));

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); }
  };

  if (variant === "bar") {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-line-strong bg-raised/95 p-2 ps-4 shadow-2xl shadow-black/50 backdrop-blur-md">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          aria-label={t("ariaPrompt")}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-subtle focus:outline-none"
        />
        <button onClick={onSubmit} aria-label={t("start")} className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-accent text-white transition-colors hover:bg-accent-hover">
          <ArrowUp size={18} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-line-strong bg-surface/90 p-3 shadow-2xl shadow-black/40 backdrop-blur-sm transition-colors focus-within:border-accent/60">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        aria-label={t("ariaPrompt")}
        rows={3}
        className="w-full resize-none bg-transparent px-3 pt-2 text-base text-ink placeholder:text-ink-subtle focus:outline-none md:text-lg"
      />
      <div className="flex items-end justify-between gap-3">
        <div
          className="no-scrollbar flex min-w-0 gap-1.5 overflow-x-auto pe-6 [mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)] rtl:[mask-image:linear-gradient(to_left,black_calc(100%-32px),transparent)]"
          role="radiogroup"
          aria-label={t("whatToCreate")}
        >
          {COMPOSER_MODES.map((id) => {
            const mod = STUDIO_MODULES.find((x) => x.id === id)!;
            const Icon = mod.icon;
            const active = id === mode;
            return (
              <button
                key={id}
                role="radio"
                aria-checked={active}
                onClick={() => { onModeChange?.(id); textareaRef.current?.focus(); }}
                className={
                  "flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors " +
                  (active ? "border-accent/60 bg-accent/15 text-ink" : "border-line text-ink-muted hover:border-line-strong hover:text-ink")
                }
              >
                <Icon size={15} aria-hidden className={active ? "text-accent-text" : ""} />
                {m(`${id}.title`)}
              </button>
            );
          })}
        </div>
        <button onClick={onSubmit} aria-label={t("start")} className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover">
          <ArrowUp size={20} aria-hidden />
        </button>
      </div>
    </div>
  );
}
