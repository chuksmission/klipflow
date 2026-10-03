"use client";
import type { SavedGeneration } from "../../lib/saved-generation";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Ban, CheckCircle2, ChevronLeft, Circle, Clapperboard, Film, ImagePlus, Layers, Loader2, Plus, Sparkles, Trash2, Upload, Users, X,
} from "lucide-react";
import { chargeTokens, refundCharge, refundNote } from "../../lib/token-client";
import { extractAudio } from "../../lib/ffmpeg-client";
import { ACTOR_SWAP_LANGUAGES, type VoiceGender } from "../../lib/actor-swap";
import {
  MAX_IDEA_RUNS, NATIONALITIES, PRICING, SERIES_MAX_VIDEOS, SERIES_MIN_VIDEOS,
  SOURCE_MAX_BYTES, SOURCE_MAX_SECONDS, pricesFrom,
  type CharacterMode, type CharacterProfile, type Customization, type EpisodeView, type FormulaView, type SeriesMode, type VideoVision,
} from "../../lib/series-cloner";
import { Alert, Badge, Button, Field, Progress, Select, Textarea, cardClass } from "../../components/ui";
import SeriesEpisode from "./SeriesEpisode";
import { useLanguageLabels } from "../../lib/use-language-labels";
import { extractFrames, fmtTime, probeVideo, seriesApi, uploadBlob } from "./series-client";

type View = "home" | "upload" | "analyzing" | "formula";
type Stage = "reading" | "charging" | "watching" | "formula";

interface Source { id: string; file: File; seconds: number }
interface LibraryItem { id: string; mode: SeriesMode; status: string; title: string | null; source_count: number; created_at: string }

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

const defaultCustomization = (): Customization => ({
  character_mode: "keep", nationality: "", concept_index: 0, reference_url: null, profile_ids: [],
  language_code: "en", accent: ACTOR_SWAP_LANGUAGES[0].accents[0], gender: "female", topic: "",
});

/** Runs `worker` over items with at most `limit` in flight. */
async function pool<T, R>(items: T[], limit: number, worker: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await worker(items[i], i); }
  }));
  return out;
}

// ---------------------------------------------------------------- component

export default function SeriesCloner({ tokenBalance, setTokenBalance, tokenPricing, enabledKeys, settingsLoaded, onBack, onBusyChange, onSaved }: Props) {
  const t = useTranslations("cloner");
  const labels = useLanguageLabels();
  const c = useTranslations("common");
  const locale = useLocale();
  const [view, setView] = useState<View>("home");
  const [mode, setMode] = useState<SeriesMode>("single");

  // Library
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [profiles, setProfiles] = useState<CharacterProfile[]>([]);
  const [libraryLoaded, setLibraryLoaded] = useState(false);

  // Upload + analysis
  const [sources, setSources] = useState<Source[]>([]);
  const [stage, setStage] = useState<Stage>("reading");
  const [counter, setCounter] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const cancelRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Formula + episodes
  const [formula, setFormula] = useState<FormulaView | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeView[]>([]);
  const [custom, setCustom] = useState<Customization>(defaultCustomization);
  const [refPreview, setRefPreview] = useState("");
  const [uploadingRef, setUploadingRef] = useState(false);
  const [ideasBusy, setIdeasBusy] = useState(false);
  const [ideasError, setIdeasError] = useState("");
  const [episodeBusy, setEpisodeBusy] = useState(false);
  const refInput = useRef<HTMLInputElement>(null);

  const moduleOn = enabledKeys["series_cloner_enabled"] === true;
  const analysing = view === "analyzing";
  const busy = analysing || ideasBusy || episodeBusy;
  const price = tokenPricing[PRICING[mode].key] ?? PRICING[mode].fallback;
  const prices = pricesFrom(tokenPricing);
  const language = ACTOR_SWAP_LANGUAGES.find((l) => l.code === custom.language_code) ?? ACTOR_SWAP_LANGUAGES[0];

  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);

  useEffect(() => {
    if (!moduleOn) return;
    seriesApi<{ formulas: LibraryItem[]; profiles: CharacterProfile[] }>("library").then((r) => {
      if (r.ok) { setLibrary(r.data.formulas ?? []); setProfiles(r.data.profiles ?? []); }
      setLibraryLoaded(true);
    });
  }, [moduleOn]);

  // ---- library ----
  const openFormula = async (id: string) => {
    setError("");
    const r = await seriesApi<{ formula: FormulaView; episodes: EpisodeView[] }>("get", { formula_id: id });
    if (!r.ok || !r.data.formula) { setError(r.data.error ?? t("errors.open")); return; }
    showFormula(r.data.formula, r.data.episodes ?? []);
  };

  const showFormula = (f: FormulaView, eps: EpisodeView[]) => {
    setFormula(f); setEpisodes(eps); setMode(f.mode);
    setCustom({ ...defaultCustomization(), ...(f.settings.customization ?? {}) });
    setRefPreview(f.settings.customization?.reference_url ?? "");
    setIdeasError(""); setView("formula");
  };

  const deleteProfile = async (id: string) => {
    if (!window.confirm(t("confirmDeleteProfile"))) return;
    const r = await seriesApi("delete_profile", { profile_id: id });
    if (r.ok) {
      setProfiles((p) => p.filter((x) => x.id !== id));
      setCustom((c) => ({ ...c, profile_ids: c.profile_ids.filter((x) => x !== id) }));
    }
  };

  // ---- uploads ----
  const maxFiles = mode === "single" ? 1 : SERIES_MAX_VIDEOS;
  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    const room = maxFiles - sources.length;
    if (list.length > room) setError(mode === "single" ? t("errors.singleOne") : t("errors.maxVideos", { max: SERIES_MAX_VIDEOS }));
    const added: Source[] = [];
    for (const f of list.slice(0, Math.max(0, room))) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!["mp4", "mov", "webm"].includes(ext)) { setError(t("errors.fileFormat", { name: f.name })); continue; }
      if (f.size > SOURCE_MAX_BYTES) { setError(t("errors.fileSize", { name: f.name, mb: SOURCE_MAX_BYTES / 1024 / 1024 })); continue; }
      const url = URL.createObjectURL(f);
      try {
        const meta = await probeVideo(url);
        if (meta.seconds > SOURCE_MAX_SECONDS + 0.5) { setError(t("errors.fileLength", { name: f.name, minutes: SOURCE_MAX_SECONDS / 60 })); continue; }
        added.push({ id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`, file: f, seconds: meta.seconds });
      } catch {
        setError(t("errors.fileUnreadable", { name: f.name }));
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    if (added.length) { setSources((s) => [...s, ...added]); if (added.length === list.length) setError(""); }
  };

  // ---- analysis ----
  const analyse = async () => {
    const need = mode === "single" ? 1 : SERIES_MIN_VIDEOS;
    if (sources.length < need) { setError(mode === "single" ? t("errors.uploadOne") : t("errors.uploadMin", { min: SERIES_MIN_VIDEOS })); return; }
    if (tokenBalance < price) { setError(t("errors.notEnough", { cost: price, balance: tokenBalance })); return; }
    cancelRef.current = false;
    setError(""); setView("analyzing"); setStage("reading"); setCounter({ done: 0, total: sources.length });

    // 1. Read each video in the browser before charging: key frames + audio track
    const prepared: { name: string; seconds: number; frames: string[]; audio_url: string | null }[] = [];
    for (const s of sources) {
      if (cancelRef.current) { setView("upload"); setError(t("errors.cancelledFree")); return; }
      let frames: string[] = [];
      try { frames = await extractFrames(s.file, s.seconds, mode === "single" ? 8 : 6); } catch { frames = []; }
      let audioUrl: string | null = null;
      try { audioUrl = await uploadBlob(await extractAudio(s.file), "mp3"); } catch (e) { console.warn("No audio for", s.file.name, e); }
      if (frames.length) prepared.push({ name: s.file.name, seconds: s.seconds, frames, audio_url: audioUrl });
      setCounter((c) => ({ ...c, done: c.done + 1 }));
    }
    if (prepared.length < need) {
      setView("upload");
      setError(mode === "single" ? t("errors.browserRead") : t("errors.tooFewRead", { count: prepared.length, min: SERIES_MIN_VIDEOS }));
      return;
    }

    // 2. Charge, then the server-side analysis
    setStage("charging");
    const charge = await chargeTokens(price, `series_cloner_${mode}`);
    if (!charge.ok) { setView("upload"); setError(charge.error); return; }
    setTokenBalance(() => charge.balance);
    const fail = async (message: string) => {
      const r = await refundCharge(charge.chargeId);
      if (r.balance !== undefined) setTokenBalance(() => r.balance!);
      setView("upload"); setError(message + refundNote(r));
    };

    try {
      const st = await seriesApi<{ formula_id?: string }>("start", { mode, source_count: prepared.length, charge_id: charge.chargeId });
      if (!st.ok || !st.data.formula_id) { await fail(st.data.error ?? t("errors.start")); return; }
      const formulaId = st.data.formula_id;

      setStage("watching"); setCounter({ done: 0, total: prepared.length });
      const analysed = await pool(prepared, 3, async (p) => {
        if (cancelRef.current) return null;
        const r = await seriesApi<{ transcript?: string; vision?: VideoVision }>("analyze_video", {
          formula_id: formulaId, name: p.name, seconds: p.seconds, frames: p.frames, audio_url: p.audio_url,
        });
        setCounter((c) => ({ ...c, done: c.done + 1 }));
        return r.ok && r.data.vision ? { name: p.name, seconds: p.seconds, transcript: r.data.transcript ?? "", vision: r.data.vision } : null;
      });
      if (cancelRef.current) { await fail(t("errors.cancelled")); return; }
      const good = analysed.filter((a): a is NonNullable<typeof a> => !!a);
      if (good.length < need) { await fail(mode === "single" ? t("errors.oneFailed") : t("errors.tooFew")); return; }

      setStage("formula");
      const fr = await seriesApi<{ formula?: FormulaView }>("formula", { formula_id: formulaId, videos: good });
      if (!fr.ok || !fr.data.formula) { await fail(fr.data.error ?? t("errors.formula")); return; }
      setLibrary((l) => [{ id: fr.data.formula!.id, mode, status: "ready", title: fr.data.formula!.title, source_count: good.length, created_at: fr.data.formula!.created_at }, ...l]);
      setSources([]);
      showFormula(fr.data.formula, []);
    } catch (e) {
      console.error("Series analysis error:", e);
      await fail(t("errors.generic"));
    }
  };

  // ---- customization + ideas ----
  const onReference = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) { setIdeasError(t("errors.imageFormat")); return; }
    if (f.size > 10 * 1024 * 1024) { setIdeasError(t("errors.imageSize")); return; }
    setUploadingRef(true);
    const url = await uploadBlob(f, f.name.split(".").pop()?.toLowerCase() || "jpg");
    setUploadingRef(false);
    if (!url) { setIdeasError(t("errors.upload")); return; }
    setRefPreview(url); setCustom((c) => ({ ...c, reference_url: url })); setIdeasError("");
  };

  const generateIdeas = async () => {
    if (!formula) return;
    if (custom.character_mode === "nationality" && !custom.nationality) { setIdeasError(t("errors.nationality")); return; }
    if (custom.character_mode === "reference" && !custom.reference_url) { setIdeasError(t("errors.reference")); return; }
    if (custom.character_mode === "profiles" && !custom.profile_ids.length) { setIdeasError(t("errors.profile")); return; }
    setIdeasBusy(true); setIdeasError("");
    try {
      const first = await seriesApi<{ ideas?: FormulaView["ideas"]; settings?: FormulaView["settings"] }>("ideas", { formula_id: formula.id, customization: custom, batch: 0 });
      if (!first.ok || !first.data.ideas) { setIdeasError(first.data.error ?? t("errors.ideas")); return; }
      let next: FormulaView = { ...formula, ideas: first.data.ideas, settings: first.data.settings ?? formula.settings, idea_runs: formula.idea_runs + 1 };
      setFormula(next);
      const second = await seriesApi<{ ideas?: FormulaView["ideas"] }>("ideas", { formula_id: formula.id, customization: custom, batch: 1 });
      if (second.ok && second.data.ideas) next = { ...next, ideas: second.data.ideas, idea_runs: next.idea_runs + 1 };
      else setIdeasError(second.data.error ?? t("errors.someIdeas"));
      setFormula(next);
    } finally {
      setIdeasBusy(false);
    }
  };

  const upsertEpisode = (ep: EpisodeView) => setEpisodes((list) => [ep, ...list.filter((e) => e.id !== ep.id)]);

  // ---------------------------------------------------------------- render

  const header = (
    <div className="flex items-center gap-2">
      {!busy && (
        <button onClick={view === "home" ? onBack : () => { setView("home"); setError(""); }}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-raised ps-2 pe-3 text-sm text-ink transition-colors hover:border-line-strong">
          <ChevronLeft size={16} className="rtl:-scale-x-100" aria-hidden /> {view === "home" ? c("allTools") : t("title")}
        </button>
      )}
      <h2 className="truncate text-base font-semibold">{view === "formula" && formula?.title ? formula.title : t("title")}</h2>
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

  // ---- HOME: mode selector, library, saved characters ----
  if (view === "home") {
    const ready = library.filter((f) => f.status === "ready");
    return (
      <div className="space-y-5">
        {header}
        <section className="space-y-3">
          <h3 className="font-semibold">{t("working")}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              { id: "single" as const, icon: Film, title: t("singleTitle"), desc: t("singleDesc"), cost: tokenPricing[PRICING.single.key] ?? PRICING.single.fallback },
              { id: "series" as const, icon: Layers, title: t("seriesTitle"), desc: t("seriesDesc", { min: SERIES_MIN_VIDEOS, max: SERIES_MAX_VIDEOS }), cost: tokenPricing[PRICING.series.key] ?? PRICING.series.fallback },
            ]).map((m) => {
              const Icon = m.icon;
              return (
                <button key={m.id} onClick={() => { setMode(m.id); setSources([]); setError(""); setView("upload"); }}
                  className="rounded-2xl border border-line bg-surface p-5 text-start transition-colors hover:border-line-strong hover:bg-raised">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent-text"><Icon size={20} aria-hidden /></span>
                    <Badge>{c("tokens", { count: m.cost })}</Badge>
                  </div>
                  <p className="text-[15px] font-semibold text-ink">{m.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">{m.desc}</p>
                </button>
              );
            })}
          </div>
        </section>

        {error && <Alert>{error}</Alert>}

        <section className={`${cardClass} space-y-3 p-5`}>
          <h3 className="font-semibold">{t("yourSeries")}</h3>
          {!libraryLoaded ? <p className="text-sm text-ink-subtle">{t("loading")}</p>
            : !ready.length ? <p className="text-sm text-ink-muted">{t("nothingYet")}</p>
            : (
              <ul className="divide-y divide-line">
                {ready.map((f) => (
                  <li key={f.id}>
                    <button onClick={() => openFormula(f.id)} className="flex w-full items-center gap-3 py-2.5 text-start hover:text-accent-text">
                      {f.mode === "series" ? <Layers size={16} className="shrink-0 text-ink-subtle" aria-hidden /> : <Film size={16} className="shrink-0 text-ink-subtle" aria-hidden />}
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{f.title ?? t("untitled")}</span>
                      <span className="shrink-0 text-xs text-ink-subtle">{f.mode === "series" ? t("videosCount", { count: f.source_count }) : t("single")} · {new Date(f.created_at).toLocaleDateString(locale)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </section>

        <section className={`${cardClass} space-y-3 p-5`}>
          <div className="flex items-center gap-2"><Users size={17} className="text-accent-text" aria-hidden /><h3 className="font-semibold">{t("savedCharacters")}</h3></div>
          {!profiles.length ? (
            <p className="text-sm text-ink-muted">{t("savedHint")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {profiles.map((p) => (
                <figure key={p.id} className="space-y-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.reference_image_url} alt={p.name} className="aspect-square w-full rounded-lg border border-line object-cover" />
                  <figcaption className="flex items-center justify-between gap-1 text-xs">
                    <span className="truncate text-ink">{p.name}</span>
                    <button onClick={() => deleteProfile(p.id)} aria-label={t("deleteNamed", { name: p.name })} className="text-ink-subtle hover:text-red-400"><Trash2 size={13} aria-hidden /></button>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // ---- UPLOAD ----
  if (view === "upload") {
    const need = mode === "single" ? 1 : SERIES_MIN_VIDEOS;
    return (
      <div className="space-y-4">
        {header}
        <section className={`${cardClass} space-y-4 p-5`}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">{mode === "single" ? t("uploadOneTitle") : t("uploadManyTitle", { min: SERIES_MIN_VIDEOS, max: SERIES_MAX_VIDEOS })}</h3>
            <Badge>{mode === "single" ? t("singleTitle") : t("series")}</Badge>
          </div>
          <input ref={fileRef} type="file" multiple={mode === "series"} accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={onFiles} className="hidden" />
          {sources.length < maxFiles && (
            <button onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center rounded-xl border border-dashed border-line-strong bg-canvas px-6 py-8 text-center transition-colors hover:border-accent/60">
              {sources.length ? <Plus size={20} className="mb-2 text-ink-subtle" aria-hidden /> : <Upload size={20} className="mb-2 text-ink-subtle" aria-hidden />}
              <span className="text-sm text-ink-muted">
                {sources.length ? t("addMore") : t("uploadHint", { minutes: SOURCE_MAX_SECONDS / 60, mb: SOURCE_MAX_BYTES / 1024 / 1024 })}
              </span>
            </button>
          )}
          {sources.length > 0 && (
            <ul className="space-y-2">
              {sources.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 rounded-lg border border-line bg-canvas px-3 py-2 text-sm">
                  <span className="text-ink-subtle">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{s.file.name}</span>
                  <span className="shrink-0 text-xs text-ink-subtle">{fmtTime(s.seconds)}</span>
                  <button onClick={() => setSources((l) => l.filter((x) => x.id !== s.id))} aria-label={t("removeNamed", { name: s.file.name })} className="text-ink-subtle hover:text-ink"><X size={15} aria-hidden /></button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-ink-subtle">{t("uploadNote")}</p>
        </section>

        {error && <Alert>{error}</Alert>}

        <div className={`${cardClass} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}>
          <p className="text-sm text-ink-muted">
            {t.rich("costLine", { cost: price, strong: (chunks) => <span className="font-semibold text-ink">{chunks}</span> })}
            <span className="text-ink-subtle"> · {mode === "single" ? t("includesSingle") : t("includesSeries")} · {t("youHave", { balance: tokenBalance })}</span>
          </p>
          <Button variant="primary" size="lg" onClick={analyse} disabled={sources.length < need}>
            <Sparkles size={17} aria-hidden /> {mode === "single" ? t("analyseVideo") : t("analyseVideos", { count: sources.length })}
          </Button>
        </div>
      </div>
    );
  }

  // ---- ANALYSING ----
  if (view === "analyzing") {
    const steps: { key: Stage; label: string }[] = [
      { key: "reading", label: t("steps.reading", { count: sources.length }) + (stage === "reading" ? ` (${counter.done}/${counter.total})` : "") },
      { key: "charging", label: t("steps.reserved") },
      { key: "watching", label: t("steps.watching") + (stage === "watching" ? ` (${counter.done}/${counter.total})` : "") },
      { key: "formula", label: mode === "series" ? t("steps.seriesFormula") : t("steps.formula") },
    ];
    const idx = steps.findIndex((s) => s.key === stage);
    const progress = Math.max(4, Math.min(95, ((idx + (counter.total ? counter.done / counter.total : 0.4)) / steps.length) * 100));
    return (
      <div className="space-y-4">
        {header}
        <section className={`${cardClass} space-y-5 p-6`}>
          <div className="text-center">
            <h3 className="font-semibold">{mode === "series" ? t("analysingSeries") : t("analysingVideo")}</h3>
            <p className="mt-1 text-sm text-ink-muted">{t("analysisTime")}</p>
          </div>
          <Progress value={progress} />
          <ul className="space-y-2">
            {steps.map((s, i) => (
              <li key={s.key} className="flex items-center gap-2 text-sm">
                {i < idx ? <CheckCircle2 size={16} className="text-emerald-400" aria-hidden />
                  : i === idx ? <Loader2 size={16} className="animate-spin text-accent-text" aria-hidden />
                  : <Circle size={16} className="text-ink-subtle" aria-hidden />}
                <span className={i <= idx ? "text-ink" : "text-ink-subtle"}>{s.label}</span>
              </li>
            ))}
          </ul>
          {stage !== "formula" && (
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" onClick={() => { cancelRef.current = true; }}><Ban size={15} aria-hidden /> {stage === "reading" ? c("cancel") : t("cancelRefund")}</Button>
            </div>
          )}
        </section>
      </div>
    );
  }

  // ---- FORMULA ----
  if (!formula?.result) return <div className="space-y-4">{header}</div>;
  const r = formula.result;
  const cast = formula.settings.cast ?? r.cast;
  const runsLeft = MAX_IDEA_RUNS - formula.idea_runs;
  const ideaTitles = new Set(formula.ideas.map((i) => i.title));
  const olderEpisodes = episodes.filter((e) => !ideaTitles.has(e.idea.title));
  const card: [string, string][] = [
    [t("card.seriesType"), r.formula.series_type], [t("card.characterType"), r.formula.character_type], [t("card.format"), r.formula.format],
    [t("card.hookStyle"), r.formula.hook_style], [t("card.overlayStyle"), r.formula.text_overlay_style], [t("card.structure"), r.formula.episode_structure],
    [t("card.consistency"), r.formula.consistency_elements.join(", ")], [t("card.tone"), r.formula.tone],
  ];
  const charOptions: { id: CharacterMode; label: string; desc: string; disabled?: boolean }[] = [
    { id: "keep", label: t("chars.keep"), desc: t("chars.keepDesc") },
    { id: "nationality", label: t("chars.nationality"), desc: t("chars.nationalityDesc") },
    { id: "concept", label: t("chars.concept"), desc: t("chars.conceptDesc") },
    { id: "reference", label: t("chars.reference"), desc: t("chars.referenceDesc") },
    { id: "profiles", label: t("chars.profiles"), desc: profiles.length ? t("chars.savedCount", { count: profiles.length }) : t("chars.noneSaved"), disabled: !profiles.length },
  ];

  return (
    <div className="space-y-4">
      {header}

      <Alert tone="info">
        {t.rich("detected", { label: r.detection.summary_label, strong: (chunks) => <strong>{chunks}</strong> })}
        {r.detection.contains_real_people ? ` ${t("realPeople")}` : ""}
      </Alert>

      {/* Series formula card */}
      <section className={`${cardClass} space-y-4 p-5`}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{formula.mode === "series" ? t("seriesFormula") : t("videoFormula")}</h3>
          <Badge tone="accent">{t(`detect.rendering.${r.detection.rendering_style}`)}</Badge>
          <Badge>{t(`detect.human.${r.detection.human_type}`)}</Badge>
          {r.detection.modifiers.filter((m) => m !== "normal_proportions").map((m) => <Badge key={m} tone="signal">{t(`detect.modifier.${m}`)}</Badge>)}
        </div>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {card.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">{k}</dt>
              <dd className="mt-0.5 text-sm text-ink">{v || "-"}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* New cast */}
      <section className={`${cardClass} space-y-3 p-5`}>
        <h3 className="font-semibold">{t("newCast")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {cast.map((c) => (
            <div key={c.name} className="rounded-xl border border-line bg-canvas p-3.5 text-sm">
              <p className="font-medium text-ink">{c.name} <span className="font-normal text-ink-subtle">· {c.role}</span></p>
              <p className="mt-1 text-ink-muted">{c.look}</p>
              <p className="mt-1 text-xs text-ink-subtle">{t("outfit", { outfit: c.outfit })}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Customize */}
      <section className={`${cardClass} space-y-5 p-5`}>
        <h3 className="font-semibold">{t("makeItYours")}</h3>

        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">{t("characters")}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {charOptions.map((o) => (
              <button key={o.id} disabled={o.disabled} onClick={() => setCustom((c) => ({ ...c, character_mode: o.id }))} aria-pressed={custom.character_mode === o.id}
                className={"rounded-lg border px-3 py-2.5 text-start transition-colors " + (o.disabled ? "cursor-not-allowed border-line opacity-50" : custom.character_mode === o.id ? "border-accent bg-accent/10" : "border-line hover:border-line-strong")}>
                <span className="block text-sm text-ink">{o.label}</span>
                <span className="block text-[11px] text-ink-subtle">{o.desc}</span>
              </button>
            ))}
          </div>

          {custom.character_mode === "nationality" && (
            <Field label={t("nationalityLabel")}>
              <Select value={custom.nationality} onChange={(e) => setCustom((c) => ({ ...c, nationality: e.target.value }))}>
                <option value="" disabled>{t("chooseNationality")}</option>
                {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </Field>
          )}
          {custom.character_mode === "concept" && (
            <div className="grid gap-2 sm:grid-cols-2">
              {r.alternative_concepts.map((c, i) => (
                <button key={i} onClick={() => setCustom((x) => ({ ...x, concept_index: i }))} aria-pressed={custom.concept_index === i}
                  className={"rounded-lg border p-3 text-start transition-colors " + (custom.concept_index === i ? "border-accent bg-accent/10" : "border-line hover:border-line-strong")}>
                  <span className="block text-sm font-medium text-ink">{c.title}</span>
                  <span className="mt-0.5 block text-xs text-ink-muted">{c.description}</span>
                </button>
              ))}
            </div>
          )}
          {custom.character_mode === "reference" && (
            <>
              <input ref={refInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={onReference} className="hidden" />
              <button onClick={() => refInput.current?.click()} className="flex w-full items-center gap-4 rounded-xl border border-dashed border-line-strong bg-canvas p-4 text-start transition-colors hover:border-accent/60">
                {refPreview
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={refPreview} alt={t("referenceAlt")} className="h-16 w-16 rounded-lg object-cover" />
                  : <span className="grid h-16 w-16 place-items-center rounded-lg bg-white/[0.04] text-ink-subtle">{uploadingRef ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <ImagePlus size={20} aria-hidden />}</span>}
                <span className="text-sm text-ink-muted">{t("referenceHint")}</span>
              </button>
            </>
          )}
          {custom.character_mode === "profiles" && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {profiles.map((p) => {
                const on = custom.profile_ids.includes(p.id);
                return (
                  <button key={p.id} aria-pressed={on}
                    onClick={() => setCustom((c) => ({ ...c, profile_ids: on ? c.profile_ids.filter((x) => x !== p.id) : [...c.profile_ids, p.id].slice(-3) }))}
                    className={"overflow-hidden rounded-lg border text-start transition-colors " + (on ? "border-accent ring-1 ring-accent" : "border-line hover:border-line-strong")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.reference_image_url} alt={p.name} className="aspect-square w-full object-cover" />
                    <span className="block truncate px-2 py-1 text-xs text-ink">{p.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("languageStep")}>
            <Select value={custom.language_code} onChange={(e) => {
              const l = ACTOR_SWAP_LANGUAGES.find((x) => x.code === e.target.value);
              setCustom((c) => ({ ...c, language_code: e.target.value, accent: l?.accents[0] ?? "" }));
            }}>
              {ACTOR_SWAP_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{labels.language(l.code)}</option>)}
            </Select>
          </Field>
          <Field label={t("accentStep")}>
            <Select value={custom.accent} onChange={(e) => setCustom((c) => ({ ...c, accent: e.target.value }))}>
              {language.accents.map((a) => <option key={a} value={a}>{labels.accent(a)}</option>)}
            </Select>
          </Field>
          <Field label={t("voiceStep")}>
            <div className="inline-flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label={t("voiceAria")}>
              {(["female", "male"] as VoiceGender[]).map((g) => (
                <button key={g} role="radio" aria-checked={custom.gender === g} onClick={() => setCustom((c) => ({ ...c, gender: g }))}
                  className={"h-8 rounded-md px-4 text-sm font-medium capitalize transition-colors " + (custom.gender === g ? "bg-raised text-ink" : "text-ink-muted hover:text-ink")}>{t(`gender.${g}`)}</button>
              ))}
            </div>
          </Field>
        </div>

        <Field label={t("topic")} hint={t("topicHint")}>
          <Textarea rows={2} maxLength={500} value={custom.topic} onChange={(e) => setCustom((c) => ({ ...c, topic: e.target.value }))} placeholder={t("topicPlaceholder")} />
        </Field>

        {ideasError && <Alert>{ideasError}</Alert>}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-subtle">{t("refreshesLeft", { count: Math.max(0, Math.floor(runsLeft / 2)) })}</p>
          <Button variant="primary" onClick={generateIdeas} disabled={ideasBusy || episodeBusy || runsLeft < 1}>
            {ideasBusy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Sparkles size={16} aria-hidden />}
            {ideasBusy ? t("writingIdeas") : formula.ideas.length ? t("rewriteIdeas") : formula.mode === "single" ? t("recreateVariations") : t("generateEpisodes")}
          </Button>
        </div>
      </section>

      {/* Ideas */}
      {formula.ideas.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2"><Clapperboard size={17} className="text-accent-text" aria-hidden /><h3 className="font-semibold">{formula.mode === "single" ? t("recreationTitle") : t("episodeIdeas")}</h3></div>
          {formula.ideas.map((idea, i) => (
            <SeriesEpisode
              onSaved={onSaved}
              key={`${idea.title}-${i}`}
              formula={formula}
              idea={idea}
              ideaIndex={i}
              label={formula.mode === "single" ? (i === 0 ? t("recreation") : t("variation", { number: i })) : t("episode", { number: i + 1 })}
              episodes={episodes.filter((e) => e.idea.title === idea.title)}
              prices={prices}
              tokenPricing={tokenPricing}
              tokenBalance={tokenBalance}
              setTokenBalance={setTokenBalance}
              enabledKeys={enabledKeys}
              busy={busy}
              onBusyChange={setEpisodeBusy}
              onEpisode={upsertEpisode}
              onProfileSaved={(p) => setProfiles((l) => [p, ...l])}
            />
          ))}
        </section>
      )}

      {olderEpisodes.length > 0 && (
        <section className={`${cardClass} space-y-2 p-5`}>
          <h3 className="font-semibold">{t("earlier")}</h3>
          <ul className="space-y-1.5 text-sm">
            {olderEpisodes.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2">
                <span className="text-ink">{e.script?.title ?? e.idea.title}</span>
                <Badge>{t(`outputs.${e.output_type}`)}</Badge>
                {e.video_url && <a href={e.video_url} target="_blank" rel="noreferrer" className="text-xs text-accent-text hover:underline">{t("video")}</a>}
                {e.frames[0] && <a href={e.frames[0].url} target="_blank" rel="noreferrer" className="text-xs text-accent-text hover:underline">{t("storyboard")}</a>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
