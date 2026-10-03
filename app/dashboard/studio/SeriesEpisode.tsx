"use client";
import { useRef, useState } from "react";
import {
  CheckCircle2, ChevronDown, Circle, Clapperboard, Copy, Download, FileText, Film, Images, Loader2, Save, UserRound, XCircle,
} from "lucide-react";
import { chargeTokens, refundCharge } from "../../lib/token-client";
import { joinClips } from "../../lib/ffmpeg-client";
import { ACTOR_SWAP_LANGUAGES } from "../../lib/actor-swap";
import { VIDEO_MODELS, isModelVisible } from "../../components/catalog";
import {
  episodeBasePrice, type CharacterProfile, type EpisodePrices, type EpisodeView, type FormulaView, type Idea, type OutputType,
} from "../../lib/series-cloner";
import { Alert, Badge, Button, Field, Input, Progress, Select, Textarea, cardClass } from "../../components/ui";
import { authedPost, downloadUrl, pollTask, seriesApi, uploadBlob } from "./series-client";

type Aspect = "9:16" | "16:9" | "1:1";
type Phase = "charging" | "script" | "characters" | "frames" | "animating" | "joining" | "presenter" | "rendering" | "saving";

const OUTPUTS: { id: OutputType; label: string; desc: string; icon: typeof FileText }[] = [
  { id: "script", label: "Script", desc: "Fastest", icon: FileText },
  { id: "storyboard", label: "Storyboard", desc: "One image per scene", icon: Images },
  { id: "video", label: "Full video", desc: "Animated scenes", icon: Film },
  { id: "avatar", label: "Avatar video", desc: "Lead talks to camera", icon: UserRound },
];

interface Props {
  formula: FormulaView;
  idea: Idea;
  ideaIndex: number;
  label: string;
  episodes: EpisodeView[];
  prices: EpisodePrices;
  tokenPricing: Record<string, number>;
  tokenBalance: number;
  setTokenBalance: (fn: (b: number) => number) => void;
  enabledKeys: Record<string, boolean>;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onEpisode: (ep: EpisodeView) => void;
  onProfileSaved: (p: CharacterProfile) => void;
}

const languageName = (code: string) => ACTOR_SWAP_LANGUAGES.find((l) => l.code === code)?.name ?? "English";

function scriptAsText(ep: EpisodeView): string {
  if (!ep.script) return "";
  return [
    ep.script.title,
    ...ep.script.scenes.map((s, i) => [
      `\nScene ${i + 1}`,
      s.on_screen_text && `On screen: ${s.on_screen_text}`,
      s.dialogue && `${s.speaker || "Voice"}: ${s.dialogue}`,
      `Visual: ${s.visual_prompt}`,
    ].filter(Boolean).join("\n")),
    `\nCaption: ${ep.script.caption}`,
  ].join("\n");
}

export default function SeriesEpisode({
  formula, idea, ideaIndex, label, episodes, prices, tokenPricing, tokenBalance, setTokenBalance, enabledKeys, busy, onBusyChange, onEpisode, onProfileSaved,
}: Props) {
  const [open, setOpen] = useState(ideaIndex === 0);
  const [output, setOutput] = useState<OutputType>("storyboard");
  const [aspect, setAspect] = useState<Aspect>("9:16");
  const models = VIDEO_MODELS.filter((m) => isModelVisible(m, enabledKeys) && m.provider === "kie");
  const [modelId, setModelId] = useState(() => models.find((m) => m.hasSound)?.id ?? models[0]?.id ?? "kling-v1-6-pro");
  const model = models.find((m) => m.id === modelId) ?? models[0];
  const scenePrice = model ? (tokenPricing[model.id] ?? model.tokens) : 0;
  const sceneEstimate = Math.min(6, Math.max(4, idea.scenes.length));

  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>("charging");
  const [runOutput, setRunOutput] = useState<OutputType>("script");
  const [counter, setCounter] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const cancelled = useRef(false);

  const base = episodeBasePrice(output, prices);
  const avatarOn = enabledKeys["heygen_enabled"] === true;
  const outputAvailable = (o: OutputType) => (o === "avatar" ? avatarOn : o === "video" ? models.length > 0 : true);

  const start = () => { setRunning(true); onBusyChange(true); setError(""); setNotice(""); cancelled.current = false; };
  const stop = () => { setRunning(false); onBusyChange(false); };
  const credit = (before: number, ep: EpisodeView) => {
    const diff = (ep.refunded ?? 0) - before;
    if (diff > 0) setTokenBalance((b) => b + diff);
    return diff;
  };

  // ---- full video: one model-priced clip per storyboard frame, then joined ----
  const animate = async (ep: EpisodeView) => {
    if (!model || !ep.script) return;
    const frames = [...ep.frames].sort((a, b) => a.index - b.index);
    if (tokenBalance < scenePrice * frames.length) {
      setError(`Animating ${frames.length} scenes with ${model.name} costs ${scenePrice * frames.length} tokens; you have ${tokenBalance}. Your storyboard is saved, so you can animate it after topping up.`);
      return;
    }
    setPhase("animating"); setCounter({ done: 0, total: frames.length });
    const lang = languageName(ep.settings.language_code);
    const clips: (string | null)[] = new Array(frames.length).fill(null);
    let spent = 0;

    await Promise.all(frames.map(async (fr, k) => {
      const scene = ep.script!.scenes[fr.index];
      const charge = await chargeTokens(scenePrice, "series_cloner_scene");
      if (!charge.ok) return;
      setTokenBalance((b) => b - scenePrice);
      const refund = async () => { const r = await refundCharge(charge.chargeId); if (r.ok) setTokenBalance((b) => b + scenePrice); };
      const speech = model.hasSound && scene?.dialogue
        ? ` ${scene.speaker && scene.speaker !== "narrator" ? scene.speaker : "The character"} says in ${lang}${ep.settings.accent ? ` with a ${ep.settings.accent} accent` : ""}: "${scene.dialogue}"`
        : "";
      try {
        const res = await fetch("/api/generate-video", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: `${scene?.visual_prompt ?? idea.title}${speech}`, mode: "image_to_video", image_url: fr.url, duration: "5", aspect_ratio: ep.settings.aspect, model: model.id, with_audio: model.hasSound, charge_id: charge.chargeId }),
        });
        const sd = await res.json();
        if (!res.ok || !sd.task_id) { await refund(); return; }
        const out = await pollTask(sd.task_id, sd.provider ?? "kie", () => false);
        if (!out.url) { await refund(); return; }
        clips[k] = out.url; spent += scenePrice;
        setCounter((c) => ({ ...c, done: c.done + 1 }));
      } catch { await refund(); }
    }));

    const ready = clips.filter((c): c is string => !!c);
    if (!ready.length) { setError("None of the scenes could be animated, so their tokens were refunded. Your storyboard is saved; try another model."); return; }

    setPhase("joining");
    let finalUrl: string | null = null;
    try {
      const joined = await joinClips(ready, undefined, true);
      finalUrl = await uploadBlob(new Blob([joined], { type: "video/mp4" }), "mp4");
    } catch (e) { console.error("Join error:", e); }
    if (!finalUrl) {
      // Joining failed in this browser: deliver the first clip, keep the rest downloadable
      finalUrl = ready[0];
      setNotice(`Your browser couldn't join the clips, so they're saved separately in your Gallery.`);
      for (const c of ready.slice(1)) {
        await authedPost("/api/generations", { type: "series_cloner", prompt: `${ep.script.title} (scene)`, video_url: c, output_type: "video", status: "completed", tokens_used: scenePrice, duration: "5", aspect_ratio: ep.settings.aspect, model: `Series Cloner · ${model.name}` });
      }
    }
    setPhase("saving");
    await seriesApi("video_done", { episode_id: ep.id, video_url: finalUrl });
    await authedPost("/api/generations", {
      type: "series_cloner", prompt: ep.script.title, video_url: finalUrl, output_type: "video", status: "completed",
      tokens_used: spent + ep.cost, duration: String(ready.length * 5), aspect_ratio: ep.settings.aspect, model: `Series Cloner · ${model.name}`,
    });
    if (ready.length < frames.length) setNotice((n) => n || `${frames.length - ready.length} scene${frames.length - ready.length > 1 ? "s" : ""} couldn't be animated and ${frames.length - ready.length > 1 ? "were" : "was"} refunded.`);
    onEpisode({ ...ep, status: "done", video_url: finalUrl });
  };

  // ---- one episode, end to end ----
  const generate = async () => {
    if (busy || running) return;
    if (!outputAvailable(output)) return;
    const upfront = base + (output === "video" ? scenePrice * sceneEstimate : 0);
    if (tokenBalance < upfront) { setError(`Not enough tokens: this needs about ${upfront} and you have ${tokenBalance}.`); return; }
    start(); setRunOutput(output); setPhase("charging"); setCounter({ done: 0, total: 0 });

    const charge = await chargeTokens(base, `series_cloner_${output}`);
    if (!charge.ok) { setError(charge.error); stop(); return; }
    setTokenBalance(() => charge.balance);

    try {
      // 1. Script (every output starts with one)
      setPhase("script");
      const s = await seriesApi<{ episode: EpisodeView }>("script", { formula_id: formula.id, idea_index: ideaIndex, output, aspect, charge_id: charge.chargeId });
      if (!s.ok || !s.data.episode) {
        const r = await refundCharge(charge.chargeId);
        if (r.balance !== undefined) setTokenBalance(() => r.balance!);
        setError((s.data.error ?? "Couldn't write the script.") + (r.ok ? " Tokens refunded." : ""));
        stop(); return;
      }
      let ep = s.data.episode;
      onEpisode(ep);
      if (output === "script") { stop(); return; }

      // A step after the script failed: the server refunds everything except the script
      const settleFailed = async (act: "storyboard_failed" | "avatar_failed", reason: string) => {
        const f = await seriesApi<{ episode?: EpisodeView }>(act, { episode_id: ep.id, reason });
        if (f.data.episode) {
          const refunded = credit(ep.refunded, f.data.episode);
          onEpisode(f.data.episode);
          setError(`${reason} Your script is saved${refunded ? `, and ${refunded} tokens were refunded` : ""}.`);
        } else {
          setError(`${reason} ${f.data.error ?? ""}`.trim());
        }
      };

      if (output === "avatar") {
        setPhase("presenter");
        const prep = await seriesApi<{ task_id?: string }>("avatar_prepare", { episode_id: ep.id });
        if (!prep.ok || !prep.data.task_id) { await settleFailed("avatar_failed", prep.data.error ?? "Couldn't create the presenter."); stop(); return; }
        const portrait = await pollTask(prep.data.task_id, "kie", () => cancelled.current);
        if (!portrait.url) { await settleFailed("avatar_failed", `The presenter image failed: ${portrait.reason}`); stop(); return; }
        setPhase("rendering");
        const av = await seriesApi<{ task_id?: string }>("avatar_start", { episode_id: ep.id });
        if (!av.ok || !av.data.task_id) { await settleFailed("avatar_failed", av.data.error ?? "Couldn't start the avatar video."); stop(); return; }
        const video = await pollTask(av.data.task_id, "heygen_v3", () => false);
        if (!video.url) { await settleFailed("avatar_failed", `The avatar video failed: ${video.reason}`); stop(); return; }
        setPhase("saving");
        const done = await seriesApi<{ episode?: EpisodeView }>("avatar_done", { episode_id: ep.id });
        ep = done.data.episode ?? { ...ep, status: "done", video_url: video.url };
        await authedPost("/api/generations", {
          type: "series_cloner", prompt: ep.script?.title ?? idea.title, video_url: ep.video_url, output_type: "video", status: "completed",
          tokens_used: ep.cost, aspect_ratio: ep.settings.aspect, model: "Series Cloner · Avatar",
        });
        onEpisode(ep); stop(); return;
      }

      // 2. Storyboard: a character sheet first, then every scene drawn from it
      setPhase("characters");
      const sheet = await seriesApi<{ task_id?: string | null }>("storyboard_sheet", { episode_id: ep.id });
      if (!sheet.ok) { await settleFailed("storyboard_failed", sheet.data.error ?? "Couldn't design the characters."); stop(); return; }
      if (sheet.data.task_id) {
        const sh = await pollTask(sheet.data.task_id, "kie", () => false);
        if (!sh.url) { await settleFailed("storyboard_failed", `The character sheet failed: ${sh.reason}`); stop(); return; }
      }
      setPhase("frames");
      const sc = await seriesApi<{ task_ids?: string[] }>("storyboard_scenes", { episode_id: ep.id });
      if (!sc.ok || !sc.data.task_ids) { await settleFailed("storyboard_failed", sc.data.error ?? "Couldn't draw the scenes."); stop(); return; }
      const ids = sc.data.task_ids;
      setCounter({ done: 0, total: ids.filter(Boolean).length });
      await Promise.all(ids.filter(Boolean).map(async (id) => {
        const r = await pollTask(id, "kie", () => false);
        if (r.url) setCounter((c) => ({ ...c, done: c.done + 1 }));
      }));
      // For videos "saving" comes after the clips are joined
      if (output !== "video") setPhase("saving");
      const fin = await seriesApi<{ episode?: EpisodeView }>("storyboard_done", { episode_id: ep.id, give_up: true });
      if (!fin.data.episode) { setError(fin.data.error ?? "Couldn't save the storyboard."); stop(); return; }
      const before = ep.refunded;
      ep = fin.data.episode;
      credit(before, ep);
      onEpisode(ep);
      if (!ep.frames.length) { setError("The storyboard images couldn't be created. Your script is saved and the rest was refunded."); stop(); return; }
      for (const fr of ep.frames) {
        await authedPost("/api/generations", {
          type: "series_cloner", prompt: `${ep.script?.title ?? idea.title}, scene ${fr.index + 1}`, image_url: fr.url, output_type: "image", status: "completed",
          tokens_used: 0, aspect_ratio: ep.settings.aspect, model: "Series Cloner · Storyboard",
        });
      }
      if (ep.frames.length < (ep.script?.scenes.length ?? 0)) setNotice(`${(ep.script?.scenes.length ?? 0) - ep.frames.length} scene image(s) couldn't be drawn.`);

      // 3. Full video
      if (output === "video") await animate(ep);
      stop();
    } catch (e) {
      console.error("Series episode error:", e);
      setError("Something went wrong. Anything that didn't finish is refunded automatically.");
      stop();
    }
  };

  const resumeAnimate = async (ep: EpisodeView) => {
    if (busy || running) return;
    start(); setRunOutput("video");
    try { await animate(ep); } finally { stop(); }
  };

  // ---------------------------------------------------------------- render

  const stepList: { key: Phase; label: string }[] = runOutput === "avatar"
    ? [{ key: "charging", label: "Tokens reserved" }, { key: "script", label: "Writing the script" }, { key: "presenter", label: "Creating the presenter and voice" }, { key: "rendering", label: "Rendering the avatar video (a few minutes)" }, { key: "saving", label: "Saving to your gallery" }]
    : [
        { key: "charging", label: "Tokens reserved" }, { key: "script", label: "Writing the script" },
        ...(runOutput === "script" ? [] : [
          { key: "characters" as Phase, label: "Designing the characters" },
          { key: "frames" as Phase, label: `Drawing the scenes${phase === "frames" && counter.total ? ` (${counter.done}/${counter.total})` : ""}` },
        ]),
        ...(runOutput === "video" ? [
          { key: "animating" as Phase, label: `Animating the scenes${phase === "animating" ? ` (${counter.done}/${counter.total})` : ""}` },
          { key: "joining" as Phase, label: "Joining the episode" },
        ] : []),
        ...(runOutput === "script" ? [] : [{ key: "saving" as Phase, label: "Saving to your gallery" }]),
      ];
  const activeIdx = stepList.findIndex((st) => st.key === phase);
  const progress = Math.max(5, Math.min(95, ((activeIdx + (counter.total ? counter.done / counter.total : 0.3)) / stepList.length) * 100));

  return (
    <div className={`${cardClass} overflow-hidden`}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 p-4 text-left sm:p-5" aria-expanded={open}>
        <Badge tone={ideaIndex === 0 && formula.mode === "single" ? "accent" : "neutral"}>{label}</Badge>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">{idea.title}</span>
          <span className="mt-0.5 block text-sm text-ink-muted">{idea.hook}</span>
        </span>
        {episodes.length > 0 && <Badge tone="success">{episodes.length} made</Badge>}
        <ChevronDown size={18} className={"mt-0.5 shrink-0 text-ink-subtle transition-transform " + (open ? "rotate-180" : "")} aria-hidden />
      </button>

      {open && (
        <div className="space-y-4 border-t border-line p-4 sm:p-5">
          <ol className="space-y-2">
            {idea.scenes.map((s, i) => (
              <li key={i} className="rounded-xl border border-line bg-canvas p-3 text-sm">
                <p className="font-medium text-ink"><span className="text-ink-subtle">{i + 1}.</span> {s.beat}</p>
                <p className="mt-1 text-ink-muted">{s.visual}</p>
                {s.dialogue && <p className="mt-1 text-accent-text">&ldquo;{s.dialogue}&rdquo;</p>}
              </li>
            ))}
          </ol>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div><p className="mb-1 text-xs font-medium text-ink-subtle">Character direction</p><p className="text-ink-muted">{idea.character_direction}</p></div>
            <div><p className="mb-1 text-xs font-medium text-ink-subtle">Ending</p><p className="text-ink-muted">{idea.ending}</p></div>
          </div>
          {idea.text_overlays.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-ink-subtle">Text overlays</p>
              <div className="flex flex-wrap gap-1.5">{idea.text_overlays.map((t, i) => <Badge key={i}>{t}</Badge>)}</div>
            </div>
          )}

          {/* Generator */}
          {!running && (
            <div className="space-y-3 rounded-xl border border-line bg-canvas p-3.5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {OUTPUTS.map((o) => {
                  const Icon = o.icon;
                  const available = outputAvailable(o.id);
                  const price = episodeBasePrice(o.id, prices);
                  return (
                    <button key={o.id} onClick={() => available && setOutput(o.id)} disabled={!available} aria-pressed={output === o.id}
                      className={"rounded-lg border p-2.5 text-left transition-colors " + (!available ? "cursor-not-allowed opacity-50 border-line" : output === o.id ? "border-accent bg-accent/10" : "border-line hover:border-line-strong")}>
                      <span className="flex items-center gap-1.5 text-sm font-medium text-ink"><Icon size={15} aria-hidden /> {o.label}</span>
                      <span className="block text-[11px] text-ink-subtle">{!available ? "Unavailable" : o.id === "video" ? `${price} + clips` : `${price} tokens`} · {o.desc}</span>
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Format">
                  <Select value={aspect} onChange={(e) => setAspect(e.target.value as Aspect)}>
                    <option value="9:16">Vertical 9:16</option>
                    <option value="16:9">Landscape 16:9</option>
                    <option value="1:1">Square 1:1</option>
                  </Select>
                </Field>
                {output === "video" && (
                  <Field label="Video model">
                    <Select value={model?.id ?? ""} onChange={(e) => setModelId(e.target.value)}>
                      {models.map((m) => <option key={m.id} value={m.id}>{m.name} · {tokenPricing[m.id] ?? m.tokens}/scene{m.hasSound ? " · speaks" : ""}</option>)}
                    </Select>
                  </Field>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-ink-subtle">
                  {output === "video"
                    ? `${base} for script + storyboard, then ${scenePrice} per scene (about ${sceneEstimate} scenes ≈ ${base + scenePrice * sceneEstimate} tokens). Failed scenes are refunded.`
                    : `${base} tokens${output === "avatar" ? " (script + avatar video)" : output === "storyboard" ? " (script + storyboard)" : ""}. Anything that fails is refunded.`}
                  {output === "video" && model && !model.hasSound ? " This model is silent; pick one marked “speaks” for dialogue." : ""}
                </p>
                <Button variant="primary" onClick={generate} disabled={busy}><Clapperboard size={16} aria-hidden /> Generate</Button>
              </div>
            </div>
          )}

          {running && (
            <div className="space-y-3 rounded-xl border border-line bg-canvas p-4">
              <Progress value={progress} />
              <ul className="space-y-1.5">
                {stepList.map((st, i) => (
                  <li key={st.key} className="flex items-center gap-2 text-sm">
                    {i < activeIdx ? <CheckCircle2 size={15} className="text-emerald-400" aria-hidden />
                      : i === activeIdx ? <Loader2 size={15} className="animate-spin text-accent-text" aria-hidden />
                      : <Circle size={15} className="text-ink-subtle" aria-hidden />}
                    <span className={i <= activeIdx ? "text-ink" : "text-ink-subtle"}>{st.label}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-ink-subtle">Keep this page open. Image and video providers can&apos;t be stopped once started; anything that fails is refunded.</p>
            </div>
          )}

          {error && <Alert>{error}</Alert>}
          {notice && <Alert tone="warning">{notice}</Alert>}

          {episodes.map((ep) => (
            <EpisodeResult key={ep.id} ep={ep} formula={formula} busy={busy || running} onAnimate={() => resumeAnimate(ep)} onProfileSaved={onProfileSaved} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- results

function EpisodeResult({ ep, formula, busy, onAnimate, onProfileSaved }: {
  ep: EpisodeView; formula: FormulaView; busy: boolean; onAnimate: () => void; onProfileSaved: (p: CharacterProfile) => void;
}) {
  const [showScript, setShowScript] = useState(ep.output_type === "script");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState<null | { source: "sheet" | "frame"; index: number }>(null);
  const cast = formula.settings.cast ?? formula.result?.cast ?? [];
  const [name, setName] = useState(cast[0]?.name ?? "");
  const [styleDesc, setStyleDesc] = useState(() =>
    [cast.map((c) => `${c.name}: ${c.look} Outfit: ${c.outfit}.`).join(" "), formula.settings.style_prompt ?? formula.result?.style_prompt ?? ""].join(" ").trim().slice(0, 1200));
  const [saveMsg, setSaveMsg] = useState("");

  const copy = async () => {
    try { await navigator.clipboard.writeText(scriptAsText(ep)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };

  const saveProfile = async () => {
    if (!saving || !name.trim()) return;
    const r = await seriesApi<{ profile?: CharacterProfile }>("save_profile", {
      episode_id: ep.id, source: saving.source, frame_index: saving.index, name: name.trim(), style_description: styleDesc,
      character_type: formula.result?.detection.summary_label ?? null,
    });
    if (r.data.profile) { onProfileSaved(r.data.profile); setSaveMsg(`Saved "${r.data.profile.name}". Choose it under Characters to use it in future episodes.`); setSaving(null); }
    else setSaveMsg(r.data.error ?? "Couldn't save.");
  };

  const typeLabel = { script: "Script", storyboard: "Storyboard", video: "Full video", avatar: "Avatar video" }[ep.output_type];
  const inProgress = !["done", "partial", "failed", "animating"].includes(ep.status);

  return (
    <div className="space-y-3 rounded-xl border border-line p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">{typeLabel}</Badge>
        {ep.status === "partial" && <Badge tone="warning">Partly finished</Badge>}
        {ep.status === "failed" && <Badge tone="danger">Failed</Badge>}
        {inProgress && <Badge>In progress</Badge>}
        <span className="text-xs text-ink-subtle">{languageName(ep.settings.language_code)}{ep.settings.accent ? ` · ${ep.settings.accent}` : ""} · {new Date(ep.created_at).toLocaleString()}</span>
      </div>
      {ep.status === "partial" && ep.error && <p className="text-xs text-amber-300">{ep.error} {ep.refunded > 0 ? `${ep.refunded} tokens refunded.` : ""}</p>}

      {ep.video_url && (
        <div className="space-y-2">
          <video src={ep.video_url} controls playsInline className="max-h-[60vh] w-full rounded-lg border border-line bg-black" />
          <Button variant="secondary" size="sm" onClick={() => downloadUrl(ep.video_url!, `klipflowai-episode-${Date.now()}.mp4`)}><Download size={15} aria-hidden /> Save video</Button>
        </div>
      )}

      {ep.output_type === "video" && ep.status === "animating" && !ep.video_url && ep.frames.length > 0 && (
        <Alert tone="info">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>The storyboard is ready but the scenes weren&apos;t animated yet.</span>
            <Button variant="secondary" size="sm" onClick={onAnimate} disabled={busy}><Film size={15} aria-hidden /> Animate scenes</Button>
          </span>
        </Alert>
      )}

      {(ep.sheet_url || ep.frames.length > 0) && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ep.sheet_url && (
            <figure className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ep.sheet_url} alt="Character sheet" className="aspect-square w-full rounded-lg border border-line object-cover" />
              <figcaption className="flex items-center justify-between gap-1 text-[11px] text-ink-subtle">
                Characters
                <button onClick={() => setSaving({ source: "sheet", index: 0 })} className="inline-flex items-center gap-1 text-accent-text hover:underline"><Save size={12} aria-hidden /> Save</button>
              </figcaption>
            </figure>
          )}
          {[...ep.frames].sort((a, b) => a.index - b.index).map((fr) => (
            <figure key={fr.index} className="space-y-1">
              <a href={fr.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fr.url} alt={`Scene ${fr.index + 1}`} className="aspect-square w-full rounded-lg border border-line object-cover" />
              </a>
              <figcaption className="flex items-center justify-between gap-1 text-[11px] text-ink-subtle">
                Scene {fr.index + 1}
                {!ep.sheet_url && <button onClick={() => setSaving({ source: "frame", index: fr.index })} className="inline-flex items-center gap-1 text-accent-text hover:underline"><Save size={12} aria-hidden /> Save</button>}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {saving && (
        <div className="space-y-3 rounded-lg border border-accent/40 bg-accent/5 p-3">
          <p className="text-sm font-medium text-ink">Save as a character profile</p>
          <Field label="Name"><Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="The Fruit Family" /></Field>
          <Field label="Style description" hint="Used in every future episode with this character.">
            <Textarea rows={3} maxLength={1200} value={styleDesc} onChange={(e) => setStyleDesc(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={saveProfile} disabled={!name.trim()}><Save size={15} aria-hidden /> Save character</Button>
            <Button variant="ghost" size="sm" onClick={() => setSaving(null)}>Cancel</Button>
          </div>
        </div>
      )}
      {saveMsg && <p className="text-xs text-emerald-400">{saveMsg}</p>}

      {ep.script && (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowScript(!showScript)}><FileText size={15} aria-hidden /> {showScript ? "Hide script" : "Show script"}</Button>
            <Button variant="ghost" size="sm" onClick={copy}>{copied ? <CheckCircle2 size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {copied ? "Copied" : "Copy script"}</Button>
          </div>
          {showScript && (
            <div className="mt-2 space-y-2">
              {ep.script.scenes.map((s, i) => (
                <div key={i} className="rounded-lg bg-canvas p-3 text-sm">
                  <p className="text-xs font-medium text-ink-subtle">Scene {i + 1}{s.on_screen_text ? ` · On screen: ${s.on_screen_text}` : ""}</p>
                  {s.dialogue && <p className="mt-1 text-ink"><span className="text-accent-text">{s.speaker || "Voice"}:</span> {s.dialogue}</p>}
                  <p className="mt-1 text-xs text-ink-muted">{s.visual_prompt}</p>
                </div>
              ))}
              <p className="text-xs text-ink-muted"><span className="font-medium text-ink-subtle">Caption:</span> {ep.script.caption}</p>
            </div>
          )}
        </div>
      )}
      {ep.status === "failed" && <p className="flex items-center gap-1.5 text-xs text-red-400"><XCircle size={13} aria-hidden /> {ep.error ?? "This episode failed."}</p>}
    </div>
  );
}
