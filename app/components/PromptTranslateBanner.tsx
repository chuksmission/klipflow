"use client";
// Shown under a prompt when its language differs from the chosen output
// language, offering a one-click translation the user can then edit.
import { useEffect, useRef, useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { detectLanguage } from "../lib/language-detect";
import { ACTOR_SWAP_LANGUAGES } from "../lib/actor-swap";
import { languageName, type LanguageChoice } from "./LanguageAccentSelector";

const KNOWN = new Set(ACTOR_SWAP_LANGUAGES.map((l) => l.code));
// AI detections already made this session (only used when the local check is unsure)
const aiCache = new Map<string, string | null>();

async function post(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  try {
    const res = await fetch("/api/prompt-language", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return res.ok ? data : { error: data.error ?? "Something went wrong." };
  } catch {
    return null;
  }
}

interface Props {
  text: string;
  onTextChange: (text: string) => void;
  target: LanguageChoice;
}

export default function PromptTranslateBanner({ text, onTextChange, target }: Props) {
  const [detected, setDetected] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef(text);

  useEffect(() => {
    latest.current = text;
    const timer = setTimeout(async () => {
      let code = detectLanguage(text);
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      if (!code && words >= 6) {
        const key = text.trim().slice(0, 400);
        if (!aiCache.has(key)) aiCache.set(key, (await post({ action: "detect", text: key }))?.language ?? null);
        code = aiCache.get(key) ?? null;
      }
      if (latest.current === text) setDetected(code && KNOWN.has(code) ? code : null);
    }, 800);
    return () => clearTimeout(timer);
  }, [text]);

  const pairKey = `${detected}->${target.language}`;
  const show = !!detected && !!target.language && detected !== target.language && dismissed !== pairKey && text.trim().length > 0;
  if (!show) return null;

  const translate = async () => {
    setTranslating(true); setError("");
    const r = await post({ action: "translate", text, language: target.language, accent: target.accent });
    setTranslating(false);
    if (r?.text) { onTextChange(r.text); setDetected(target.language); }
    else setError(r?.error ?? "Couldn't translate right now. Try again.");
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-accent/30 bg-accent/[0.07] px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between" role="status">
      <p className="flex items-start gap-2 text-ink-muted">
        <Languages size={14} className="mt-0.5 shrink-0 text-accent-text" aria-hidden />
        <span>
          Your prompt appears to be in {languageName(detected!)} but output language is set to {languageName(target.language)}. Auto-translate prompt before generating?
          {error && <span className="block text-red-400">{error}</span>}
        </span>
      </p>
      <div className="flex shrink-0 gap-2">
        <button onClick={translate} disabled={translating}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60">
          {translating && <Loader2 size={13} className="animate-spin" aria-hidden />} Yes, translate
        </button>
        <button onClick={() => setDismissed(pairKey)} disabled={translating}
          className="h-8 rounded-md border border-line px-3 text-ink-muted transition-colors hover:border-line-strong hover:text-ink">
          No, keep as-is
        </button>
      </div>
    </div>
  );
}
