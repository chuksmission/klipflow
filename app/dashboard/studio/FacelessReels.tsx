"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  BookOpen, CheckCircle2, ChevronLeft, Clapperboard, Download, Film, LayoutGrid, Loader2, Pencil, Plus, Sparkles, Trash2, Users, Wand2, type LucideIcon,
} from "lucide-react";
import { chargeTokens, refundCharge, refundNote } from "../../lib/token-client";
import type { SavedGeneration } from "../../lib/saved-generation";
import {
  CHARACTER_KINDS, REEL_CATEGORIES, REEL_DURATIONS, REEL_PRICING, SHEET_VIEWS,
  type CharacterDesign, type CharacterKind, type EpisodeScript, type ReelMode, type ReelScene, type ReelTemplate, type SeriesBible,
} from "../../lib/faceless-reels";
import { Alert, Badge, Button, Field, Input, Progress, Select, Textarea, cardClass } from "../../components/ui";
import LanguageAccentSelector, { DEFAULT_LANGUAGE, type LanguageChoice } from "../../components/LanguageAccentSelector";
import { authedPost, downloadUrl } from "./series-client";

interface Props {
  tokenBalance: number;
  setTokenBalance: (fn: (b: number) => number) => void;
  tokenPricing: Record<string, number>;
  enabledKeys: Record<string, boolean>;
  settingsLoaded: boolean;
  onBack: () => void;
  onBusyChange: (busy: boolean) => void;
  /** Called once a result is saved to the gallery (Showcase Studio features it) */
  onSaved?: (g: SavedGeneration) => void;
}

interface CastMember { design: CharacterDesign; preview_url?: string; preview_task?: string; edits: number; sheet_tasks?: string[]; sheet_urls?: (string | null)[] }
interface Assignment {
  id: string; mode: ReelMode; template_id: string | null; character_kind: CharacterKind; title: string | null; concept: string;
  language: string; accent: string; status: "designing" | "sheeting" | "cast_ready" | "ready" | "failed"; cast: CastMember[];
  bible: SeriesBible | null; duration?: number; updated_at: string;
}
interface Episode {
  id: string; number: number; status: "scripted" | "rendering" | "done" | "partial" | "failed"; script: EpisodeScript; duration: number;
  video_url: string | null; tasks: string[]; refunded: number; error: string | null; cost: number;
}
interface LibraryItem { id: string; mode: ReelMode; title: string | null; status: string; character_kind: CharacterKind; cast: { name: string; preview_url: string | null }[]; created_at: string }

type View = "home" | "templates" | "setup" | "series";

const MODES: { id: ReelMode; icon: LucideIcon }[] = [
  { id: "template", icon: LayoutGrid },
  { id: "own", icon: BookOpen },
  { id: "oneoff", icon: Clapperboard },
];

const api = <T = Record<string, unknown>>(action: string, body: Record<string, unknown> = {}) =>
  authedPost<T>("/api/faceless-reels", { action, ...body });

export default function FacelessReels({ tokenBalance, setTokenBalance, tokenPricing, enabledKeys, settingsLoaded, onBack, onBusyChange, onSaved }: Props) {
  const t = useTranslations("reels");
  const c = useTranslations("common");
  const moduleOn = enabledKeys["faceless_reels_enabled"] === true;
  const price = (p: { key: string; fallback: number }) => tokenPricing[p.key] ?? p.fallback;

  const [view, setView] = useState<View>("home");
  const [mode, setMode] = useState<ReelMode>("template");
  const [templates, setTemplates] = useState<ReelTemplate[]>([]);
  const [category, setCategory] = useState<string>("all");
  const [template, setTemplate] = useState<ReelTemplate | null>(null);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Setup
  const [kind, setKind] = useState<CharacterKind>("fruit_head");
  const [castSize, setCastSize] = useState(2);
  const [concept, setConcept] = useState("");
  const [hint, setHint] = useState("");
  const [duration, setDuration] = useState<number>(30);
  const [lang, setLang] = useState<LanguageChoice>(DEFAULT_LANGUAGE);

  // Series
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [editText, setEditText] = useState<Record<number, string>>({});
  const [idea, setIdea] = useState("");
  const [draft, setDraft] = useState<EpisodeScript | null>(null);
  const [renderProgress, setRenderProgress] = useState<Record<string, { done: number; total: number }>>({});
  const [notice, setNotice] = useState("");

  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);

  const loadLibrary = useCallback(async () => {
    const r = await api<{ series: LibraryItem[] }>("library");
    if (r.ok) setLibrary(r.data.series ?? []);
  }, []);

  useEffect(() => {
    if (!moduleOn) return;
    fetch("/api/faceless-reels").then((r) => r.json()).then((d) => setTemplates(d.templates ?? [])).catch(() => {});
    api<{ series: LibraryItem[] }>("library").then((r) => { if (r.ok) setLibrary(r.data.series ?? []); });
  }, [moduleOn]);

  const templateName = (tp: Pick<ReelTemplate, "slug" | "name">) => (t.has(`templates.${tp.slug}`) ? t(`templates.${tp.slug}`) : tp.name);
  const visibleTemplates = useMemo(() => templates.filter((tp) => category === "all" || tp.category === category), [templates, category]);
  const scripted = episodes.find((e) => e.status === "scripted");

  // ---------------------------------------------------------------- pay + call

  /** Charges, calls the action, and refunds if the server didn't start the work. */
  async function paid<T>(cost: number, action: string, body: Record<string, unknown>): Promise<T | null> {
    setError("");
    if (tokenBalance < cost) { setError(t("errors.notEnough", { cost, balance: tokenBalance })); return null; }
    setBusy(true);
    try {
      const charge = await chargeTokens(cost, "faceless_reels");
      if (!charge.ok) { setError(charge.error); return null; }
      setTokenBalance(() => charge.balance);
      const r = await api<T>(action, { ...body, charge_id: charge.chargeId });
      if (!r.ok) {
        const refund = await refundCharge(charge.chargeId);
        if (refund.balance !== undefined) setTokenBalance(() => refund.balance!);
        setError(`${r.data.error ?? t("errors.generic")} ${refundNote(refund)}`);
        return null;
      }
      return r.data;
    } finally {
      setBusy(false);
    }
  }

  async function free<T>(action: string, body: Record<string, unknown>): Promise<T | null> {
    setError(""); setBusy(true);
    try {
      const r = await api<T>(action, body);
      if (!r.ok) { setError(r.data.error ?? t("errors.generic")); return null; }
      return r.data;
    } finally {
      setBusy(false);
    }
  }

  // ---------------------------------------------------------------- flow

  const setupCost = mode === "oneoff" ? price(REEL_PRICING.oneoff) : price(REEL_PRICING.sheet) * (template?.cast_size ?? castSize);

  function pickMode(m: ReelMode) {
    setMode(m); setError(""); setTemplate(null); setConcept(""); setHint("");
    setCastSize(m === "oneoff" ? 1 : 2);
    setView(m === "template" ? "templates" : "setup");
  }

  async function startCreate() {
    if (mode === "own" && concept.trim().length < 10) { setError(t("errors.concept")); return; }
    const data = await paid<{ assignment: Assignment }>(setupCost, "create", {
      mode, template_id: template?.id, character_kind: kind, cast_size: castSize, concept: mode === "own" ? concept : "",
      scenario: mode === "oneoff" ? concept : "", hint, language: lang.language, accent: lang.accent, duration,
    });
    if (data) { setAssignment(data.assignment); setEpisodes([]); setDraft(null); setView("series"); void loadLibrary(); }
  }

  async function openSeries(id: string) {
    setError(""); setNotice("");
    const r = await api<{ assignment: Assignment; episodes: Episode[]; template: ReelTemplate | null }>("get", { assignment_id: id });
    if (!r.ok) { setError(r.data.error ?? t("errors.generic")); return; }
    setAssignment(r.data.assignment); setEpisodes(r.data.episodes); setTemplate(r.data.template); setMode(r.data.assignment.mode);
    setDraft(r.data.episodes.find((e) => e.status === "scripted")?.script ?? null);
    setView("series");
  }

  // Poll character images / sheets while they're drawing
  const castPending = !!assignment && (assignment.status === "sheeting" || (assignment.status === "designing" && assignment.cast.some((m) => !m.preview_url && m.preview_task)));
  const castStarted = useRef(0);
  useEffect(() => {
    if (!castPending || !assignment) return;
    if (!castStarted.current) castStarted.current = Date.now();
    const id = setInterval(async () => {
      const giveUp = Date.now() - castStarted.current > 10 * 60 * 1000;
      const r = await api<{ assignment: Assignment; error?: string }>("cast_status", { assignment_id: assignment.id, give_up: giveUp });
      if (r.ok) {
        setAssignment(r.data.assignment);
        if (r.data.error) setError(r.data.error);
        if (r.data.assignment.status !== "sheeting" && r.data.assignment.status !== "designing") castStarted.current = 0;
      }
    }, 4000);
    return () => clearInterval(id);
  }, [castPending, assignment]);

  // Poll renders
  const rendering = episodes.filter((e) => e.status === "rendering");
  useEffect(() => {
    if (!rendering.length) return;
    const id = setInterval(async () => {
      for (const ep of rendering) {
        const r = await api<{ episode: Episode; done?: number; total?: number; generation_id?: number | string | null }>("render_status", { episode_id: ep.id });
        if (!r.ok) continue;
        const next = r.data.episode;
        if (r.data.total) setRenderProgress((p) => ({ ...p, [ep.id]: { done: r.data.done ?? 0, total: r.data.total! } }));
        if (next.status !== "rendering") {
          setEpisodes((list) => list.map((e) => (e.id === next.id ? next : e)));
          if (next.refunded > 0) setTokenBalance((b) => b + next.refunded);
          if (next.status === "failed") setNotice(t("renderFailed"));
          else if (next.status === "partial") setNotice(t("renderPartial", { tokens: c("tokens", { count: next.refunded }) }));
          if (next.video_url && r.data.generation_id != null) onSaved?.({ id: r.data.generation_id, url: next.video_url, outputType: "video" });
        }
      }
    }, 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-armed whenever the set of rendering episodes changes
  }, [rendering.map((e) => e.id).join(",")]);

  async function editCharacter(i: number) {
    const request = (editText[i] ?? "").trim();
    if (!request || !assignment) return;
    const data = await free<{ assignment: Assignment }>("edit_character", { assignment_id: assignment.id, index: i, request });
    if (data) { setAssignment(data.assignment); setEditText((e) => ({ ...e, [i]: "" })); }
  }

  async function approveCast() {
    if (!assignment) return;
    const data = await free<{ assignment: Assignment }>("approve_cast", { assignment_id: assignment.id });
    if (data) setAssignment(data.assignment);
  }

  async function createBible() {
    if (!assignment) return;
    const cost = price(assignment.mode === "template" ? REEL_PRICING.bible : REEL_PRICING.concept);
    const data = await paid<{ assignment: Assignment }>(cost, "bible", { assignment_id: assignment.id });
    if (data) { setAssignment(data.assignment); void loadLibrary(); }
  }

  async function writeEpisode() {
    if (!assignment) return;
    const body = { assignment_id: assignment.id, duration, idea };
    const data = assignment.mode === "oneoff"
      ? await free<{ episode: Episode }>("episode", body)
      : await paid<{ episode: Episode }>(price(REEL_PRICING.episode), "episode", body);
    if (data) { setEpisodes((list) => [...list, data.episode]); setDraft(data.episode.script); setIdea(""); }
  }

  async function renderEpisode() {
    if (!scripted || !draft) return;
    const saved = await free<{ episode: Episode }>("update_script", { episode_id: scripted.id, script: draft });
    if (!saved) return;
    const data = await free<{ episode: Episode }>("render", { episode_id: scripted.id });
    if (data) { setEpisodes((list) => list.map((e) => (e.id === data.episode.id ? data.episode : e))); setDraft(null); setNotice(""); }
  }

  const setScene = (i: number, patch: Partial<ReelScene>) => setDraft((d) => d && { ...d, scenes: d.scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  // ---------------------------------------------------------------- views

  const back = () => {
    setError(""); setNotice("");
    if (view === "series") { setAssignment(null); setView("home"); void loadLibrary(); }
    else if (view === "setup" && mode === "template") setView("templates");
    else if (view === "home") onBack();
    else setView("home");
  };

  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={back} disabled={busy}
        className="inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-raised ps-2 pe-3 text-sm text-ink transition-colors hover:border-line-strong disabled:opacity-50">
        <ChevronLeft size={16} className="rtl:-scale-x-100" aria-hidden /> {view === "home" ? c("allTools") : t("back")}
      </button>
      <h2 className="text-base font-semibold">{t("title")}{view !== "home" ? ` · ${t(`modes.${mode}.title`)}` : ""}</h2>
    </div>
  );

  if (settingsLoaded && !moduleOn) {
    return (
      <div className="space-y-4">
        {header}
        <div className={`${cardClass} p-6 text-center`}>
          <p className="mb-1 font-medium text-ink">{t("unavailable")}</p>
          <p className="text-sm text-ink-muted">{t("unavailableDesc")}</p>
        </div>
      </div>
    );
  }

  const disclaimer = (k: CharacterKind | undefined) => k === "mini_adult" && <Alert tone="info">{t("miniAdultDisclaimer")}</Alert>;

  // HOME: modes + my series
  if (view === "home") {
    return (
      <div className="space-y-5">
        {header}
        <p className="text-sm text-ink-muted">{t("intro")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {MODES.map((m) => {
            const Icon = m.icon;
            // Smallest real start: one character sheet plus the bible (one-offs are all-in)
            const from = m.id === "oneoff" ? price(REEL_PRICING.oneoff) : price(REEL_PRICING.sheet) + price(m.id === "template" ? REEL_PRICING.bible : REEL_PRICING.concept);
            return (
              <button key={m.id} onClick={() => pickMode(m.id)}
                className="rounded-2xl border border-line bg-surface p-5 text-start transition-colors hover:border-line-strong hover:bg-raised">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent-text"><Icon size={20} aria-hidden /></span>
                  <Badge>{m.id === "oneoff" ? c("tokens", { count: from }) : t("fromTokens", { tokens: c("tokens", { count: from }) })}</Badge>
                </div>
                <p className="text-[15px] font-semibold text-ink">{t(`modes.${m.id}.title`)}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{t(`modes.${m.id}.desc`)}</p>
              </button>
            );
          })}
        </div>
        {library.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-ink">{t("mySeries")}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {library.map((s) => (
                <button key={s.id} onClick={() => openSeries(s.id)}
                  className={`${cardClass} flex items-center gap-3 p-3 text-start transition-colors hover:border-line-strong`}>
                  <div className="flex -space-x-3 rtl:space-x-reverse">
                    {s.cast.slice(0, 3).map((m, i) => m.preview_url
                      ? <img key={i} src={m.preview_url} alt="" className="h-12 w-9 rounded-lg border-2 border-surface object-cover" />
                      : <span key={i} className="grid h-12 w-9 place-items-center rounded-lg border-2 border-surface bg-raised"><Users size={14} aria-hidden /></span>)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{s.title || s.cast.map((m) => m.name).join(" & ")}</p>
                    <p className="text-xs text-ink-subtle">{t(`modes.${s.mode}.title`)} · {t(`status.${s.status}`)}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
        {error && <Alert>{error}</Alert>}
      </div>
    );
  }

  // TEMPLATE LIBRARY (browsing is free)
  if (view === "templates") {
    return (
      <div className="space-y-4">
        {header}
        <p className="text-sm text-ink-muted">{t("browseFree")}</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {["all", ...REEL_CATEGORIES].map((cat) => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${category === cat ? "border-accent bg-accent/15 text-accent-text" : "border-line bg-surface text-ink-muted hover:border-line-strong"}`}>
              {t(`categories.${cat}`)}
            </button>
          ))}
        </div>
        {templates.length === 0 ? (
          <div className={`${cardClass} p-6 text-center text-sm text-ink-muted`}>{t("noTemplates")}</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visibleTemplates.map((tp) => (
              <button key={tp.id} onClick={() => { setTemplate(tp); setKind(tp.character_kind); setCastSize(tp.cast_size); setView("setup"); }}
                className="group overflow-hidden rounded-2xl border border-line bg-surface text-start transition-colors hover:border-accent/60">
                <div className="relative aspect-[9/16] bg-raised">
                  {tp.image_preview_url
                    ? <img src={tp.image_preview_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />
                    : <span className="grid h-full w-full place-items-center text-ink-subtle"><Film size={28} aria-hidden /></span>}
                  <span className="absolute start-2 top-2"><Badge>{t(`categories.${tp.category}`)}</Badge></span>
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold leading-snug text-ink">{templateName(tp)}</p>
                  <p className="mt-0.5 text-xs text-ink-subtle">{t("castOf", { count: tp.cast_size })}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // SETUP: describe, then design the cast
  if (view === "setup") {
    return (
      <div className="space-y-4">
        {header}
        <section className={`${cardClass} space-y-4 p-5`}>
          {template && (
            <div className="flex gap-3">
              {template.image_preview_url && <img src={template.image_preview_url} alt="" className="h-28 w-[63px] shrink-0 rounded-lg object-cover" />}
              <div className="min-w-0">
                <p className="font-semibold text-ink">{templateName(template)}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">{template.formula}</p>
              </div>
            </div>
          )}
          {disclaimer(template?.character_kind ?? kind)}

          {mode !== "template" && (
            <>
              <Field label={mode === "own" ? t("conceptLabel") : t("scenarioLabel")} hint={mode === "own" ? t("conceptHint") : t("scenarioHint")}>
                <Textarea rows={4} value={concept} maxLength={1500} onChange={(e) => setConcept(e.target.value)}
                  placeholder={mode === "own" ? t("conceptPlaceholder") : t("scenarioPlaceholder")} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("kindLabel")}>
                  <Select value={kind} onChange={(e) => setKind(e.target.value as CharacterKind)}>
                    {CHARACTER_KINDS.map((k) => <option key={k} value={k}>{t(`kinds.${k}`)}</option>)}
                  </Select>
                </Field>
                <Field label={t("castSize")}>
                  <Select value={castSize} onChange={(e) => setCastSize(Number(e.target.value))}>
                    <option value={1}>{t("castOf", { count: 1 })}</option>
                    <option value={2}>{t("castOf", { count: 2 })}</option>
                  </Select>
                </Field>
              </div>
            </>
          )}

          <Field label={t("hintLabel")} hint={t("hintHint")}>
            <Input value={hint} maxLength={300} onChange={(e) => setHint(e.target.value)} placeholder={t("hintPlaceholder")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("durationLabel")}>
              <Select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {REEL_DURATIONS.map((d) => <option key={d} value={d}>{t("seconds", { count: d })}</option>)}
              </Select>
            </Field>
          </div>
          <LanguageAccentSelector label={t("outputLanguage")} value={lang} onChange={setLang} />
          <p className="text-xs text-ink-subtle">{t("uniqueNote")}</p>
        </section>
        {error && <Alert>{error}</Alert>}
        <div className={`${cardClass} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}>
          <p className="text-sm text-ink-muted">{mode === "oneoff" ? t("oneoffCost", { tokens: c("tokens", { count: setupCost }) }) : t("sheetCost", { tokens: c("tokens", { count: setupCost }) })}</p>
          <Button variant="primary" size="lg" onClick={startCreate} disabled={busy}>
            {busy ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <Wand2 size={17} aria-hidden />} {t("designCast")}
          </Button>
        </div>
      </div>
    );
  }

  // SERIES: cast → bible → episodes
  if (!assignment) return null;
  const a = assignment;
  const sheetDone = a.cast.reduce((n, m) => n + (m.sheet_urls ?? []).filter(Boolean).length, 0);
  const sheetTotal = a.cast.length * SHEET_VIEWS.length;

  return (
    <div className="space-y-4">
      {header}
      {disclaimer(a.character_kind)}

      {/* CAST */}
      <section className={`${cardClass} space-y-4 p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2"><Users size={17} className="text-accent-text" aria-hidden /><h3 className="font-semibold">{a.bible?.title || a.title || t("yourCast")}</h3></div>
          <Badge>{t(`status.${a.status}`)}</Badge>
        </div>
        {a.status === "designing" && <p className="text-sm text-ink-muted">{t("designingNote")}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {a.cast.map((m, i) => (
            <div key={i} className="space-y-3 rounded-xl border border-line bg-canvas p-3">
              <div className="flex gap-3">
                <div className="relative h-40 w-[90px] shrink-0 overflow-hidden rounded-lg bg-raised">
                  {m.preview_url ? <img src={m.preview_url} alt={m.design.name} className="h-full w-full object-cover" />
                    : <span className="grid h-full w-full place-items-center"><Loader2 size={20} className="animate-spin text-accent-text" aria-hidden /></span>}
                </div>
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-ink">{m.design.name}</p>
                  <p className="text-xs text-accent-text">{m.design.role}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">{m.design.personality}</p>
                </div>
              </div>
              {a.status === "designing" && m.preview_url && (
                <div className="flex gap-2">
                  <Input value={editText[i] ?? ""} maxLength={300} placeholder={t("editPlaceholder")} disabled={busy || m.edits >= 3}
                    onChange={(e) => setEditText((x) => ({ ...x, [i]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") void editCharacter(i); }} />
                  <Button variant="secondary" onClick={() => editCharacter(i)} disabled={busy || !(editText[i] ?? "").trim() || m.edits >= 3} aria-label={t("edit")}>
                    <Pencil size={15} aria-hidden />
                  </Button>
                </div>
              )}
              {(m.sheet_urls?.some(Boolean) || a.status === "sheeting") && (
                <div className="grid grid-cols-4 gap-1.5">
                  {SHEET_VIEWS.map((v, j) => (
                    <div key={v.id} className="aspect-square overflow-hidden rounded-md bg-raised" title={t(`views.${v.id}`)}>
                      {m.sheet_urls?.[j] ? <img src={m.sheet_urls[j]!} alt={t(`views.${v.id}`)} className="h-full w-full object-cover" />
                        : a.status === "sheeting" && m.sheet_tasks?.[j] ? <span className="grid h-full w-full place-items-center"><Loader2 size={14} className="animate-spin text-ink-subtle" aria-hidden /></span> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        {a.status === "designing" && (
          <Button variant="primary" onClick={approveCast} disabled={busy || a.cast.some((m) => !m.preview_url)}>
            <CheckCircle2 size={16} aria-hidden /> {a.mode === "oneoff" ? t("approveOneoff") : t("approve")}
          </Button>
        )}
        {a.status === "sheeting" && (
          <div className="space-y-2">
            <p className="text-sm text-ink-muted">{t("sheeting", { done: sheetDone, total: sheetTotal })}</p>
            <Progress value={(sheetDone / Math.max(1, sheetTotal)) * 100} />
          </div>
        )}
      </section>

      {/* BIBLE */}
      {a.mode !== "oneoff" && a.status === "cast_ready" && (
        <section className={`${cardClass} space-y-3 p-5`}>
          <div className="flex items-center gap-2"><BookOpen size={17} className="text-accent-text" aria-hidden /><h3 className="font-semibold">{t("bibleTitle")}</h3></div>
          <p className="text-sm text-ink-muted">{a.mode === "template" ? t("bibleDescTemplate") : t("bibleDescOwn")}</p>
          <Button variant="primary" onClick={createBible} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Sparkles size={16} aria-hidden />}
            {t("createBible", { tokens: c("tokens", { count: price(a.mode === "template" ? REEL_PRICING.bible : REEL_PRICING.concept) }) })}
          </Button>
        </section>
      )}
      {a.bible && (
        <section className={`${cardClass} space-y-3 p-5`}>
          <div className="flex items-center gap-2"><BookOpen size={17} className="text-accent-text" aria-hidden /><h3 className="font-semibold">{a.bible.title}</h3></div>
          <p className="text-sm text-ink">{a.bible.logline}</p>
          <details className="text-sm">
            <summary className="cursor-pointer text-accent-text">{t("bibleDetails")}</summary>
            <div className="mt-3 space-y-3 text-ink-muted">
              <p><span className="font-medium text-ink">{t("tone")}:</span> {a.bible.tone}</p>
              <p><span className="font-medium text-ink">{t("world")}:</span> {a.bible.world}</p>
              <p><span className="font-medium text-ink">{t("arc")}:</span> {a.bible.arc}</p>
              <ol className="list-decimal space-y-1 ps-5">
                {a.bible.outlines.map((o) => <li key={o.number}><span className="text-ink">{o.title}</span>: {o.summary}</li>)}
              </ol>
              {a.bible.directions.length > 0 && <ul className="list-disc space-y-1 ps-5">{a.bible.directions.map((d, i) => <li key={i}>{d}</li>)}</ul>}
            </div>
          </details>
        </section>
      )}

      {/* EPISODES */}
      {episodes.filter((e) => e.status !== "scripted").map((ep) => (
        <section key={ep.id} className={`${cardClass} space-y-3 p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{a.mode === "oneoff" ? ep.script.title : t("episodeN", { n: ep.number, title: ep.script.title })}</h3>
            <Badge>{t(`epStatus.${ep.status}`)}</Badge>
          </div>
          {ep.status === "rendering" && (
            <div className="space-y-2">
              <p className="text-sm text-ink-muted">{t("rendering")}</p>
              <Progress value={renderProgress[ep.id] ? (renderProgress[ep.id].done / renderProgress[ep.id].total) * 90 + 5 : 5} />
            </div>
          )}
          {ep.video_url && (
            <>
              <video src={ep.video_url} controls playsInline className="mx-auto max-h-[70vh] w-full max-w-sm rounded-xl border border-line bg-black" />
              <div className="grid grid-cols-2 gap-3">
                <Button variant="primary" onClick={() => downloadUrl(ep.video_url!, `${(ep.script.title || "reel").replace(/\W+/g, "-")}.mp4`)}><Download size={16} aria-hidden /> {t("save")}</Button>
                {ep.script.caption && <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(ep.script.caption)}>{t("copyCaption")}</Button>}
              </div>
            </>
          )}
          {ep.status === "failed" && <Alert tone="warning">{t("renderFailed")}</Alert>}
        </section>
      ))}
      {notice && <Alert tone="warning">{notice}</Alert>}

      {/* SCRIPT EDITOR */}
      {scripted && draft && (
        <section className={`${cardClass} space-y-4 p-5`}>
          <div className="flex items-center gap-2"><Pencil size={17} className="text-accent-text" aria-hidden /><h3 className="font-semibold">{t("editScript")}</h3></div>
          <p className="text-xs text-ink-muted">{t("editScriptHint")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("scriptTitle")}><Input value={draft.title} maxLength={160} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
            <Field label={t("hook")}><Input value={draft.hook} maxLength={300} onChange={(e) => setDraft({ ...draft, hook: e.target.value })} /></Field>
          </div>
          <ol className="space-y-3">
            {draft.scenes.map((s, i) => (
              <li key={i} className="space-y-2 rounded-xl border border-line bg-canvas p-3">
                <div className="flex items-center justify-between gap-2 text-xs text-ink-subtle">
                  <span>{t("sceneN", { n: i + 1, seconds: Math.round(s.seconds * 10) / 10 })}</span>
                  {draft.scenes.length > 1 && (
                    <button onClick={() => setDraft({ ...draft, scenes: draft.scenes.filter((_, j) => j !== i) })} className="text-ink-subtle hover:text-danger" aria-label={t("removeScene")}>
                      <Trash2 size={14} aria-hidden />
                    </button>
                  )}
                </div>
                <Textarea rows={2} value={s.shot} maxLength={400} onChange={(e) => setScene(i, { shot: e.target.value })} aria-label={t("shot")} placeholder={t("shot")} />
                <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
                  <Input value={s.speaker} maxLength={60} onChange={(e) => setScene(i, { speaker: e.target.value })} placeholder={t("speaker")} aria-label={t("speaker")} />
                  <Input value={s.dialogue} maxLength={300} onChange={(e) => setScene(i, { dialogue: e.target.value })} placeholder={t("dialogue")} aria-label={t("dialogue")} />
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
                  <Input value={s.reaction} maxLength={300} onChange={(e) => setScene(i, { reaction: e.target.value })} placeholder={t("reaction")} aria-label={t("reaction")} />
                  <Input value={s.overlay} maxLength={30} onChange={(e) => setScene(i, { overlay: e.target.value.toUpperCase() })} placeholder={t("overlay")} aria-label={t("overlay")} className="font-bold uppercase" />
                </div>
              </li>
            ))}
          </ol>
          <p className="text-xs text-ink-muted"><span className="font-medium text-ink">{t("music")}:</span> {draft.music_mood} · <span className="font-medium text-ink">{t("ending")}:</span> {draft.ending}</p>
          <Button variant="primary" size="lg" onClick={renderEpisode} disabled={busy}>
            {busy ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <Film size={17} aria-hidden />} {t("render", { seconds: scripted.duration })}
          </Button>
        </section>
      )}

      {/* NEXT EPISODE */}
      {!scripted && ((a.mode === "oneoff" && a.status === "cast_ready" && episodes.length === 0) || (a.mode !== "oneoff" && a.status === "ready")) && (
        <section className={`${cardClass} space-y-4 p-5`}>
          <div className="flex items-center gap-2"><Plus size={17} className="text-accent-text" aria-hidden />
            <h3 className="font-semibold">{a.mode === "oneoff" ? t("writeReel") : t("writeEpisode", { n: episodes.length + 1 })}</h3></div>
          <Field label={t("ideaLabel")} hint={t("ideaHint")}>
            <Textarea rows={2} value={idea} maxLength={600} onChange={(e) => setIdea(e.target.value)} placeholder={t("ideaPlaceholder")} />
          </Field>
          <Field label={t("durationLabel")}>
            <Select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {REEL_DURATIONS.map((d) => <option key={d} value={d}>{t("seconds", { count: d })}</option>)}
            </Select>
          </Field>
          <Button variant="primary" onClick={writeEpisode} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Sparkles size={16} aria-hidden />}
            {a.mode === "oneoff" ? t("writeScriptIncluded") : t("writeScript", { tokens: c("tokens", { count: price(REEL_PRICING.episode) }) })}
          </Button>
        </section>
      )}

      {error && <Alert>{error}</Alert>}
    </div>
  );
}
