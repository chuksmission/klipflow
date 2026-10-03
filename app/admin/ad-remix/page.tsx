"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2, Circle, Clapperboard, Coins, ExternalLink, FileText, ImagePlus, Loader2, Megaphone,
  Mic, Plus, Repeat2, Sparkles, Trash2, Upload, UserRound,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { STUDIO_MODULES, VIDEO_MODELS, isModelVisible } from "../../components/catalog";
import { Alert, Badge, Button, Field, Input, PageHeader, Progress, Select, Textarea, cardClass } from "../../components/ui";

// ---------------------------------------------------------------- types

interface Segment { start: number; end: number; text: string }
interface Scene { visual_prompt: string; voiceover: string; on_screen_text: string }
interface Analysis {
  hook: { first_3_seconds: string; technique: string; why_it_works: string };
  pain_point: string;
  target_audience: string;
  flow: { stage: string; summary: string }[];
  visual_style: { format: string; description: string };
  pacing: string;
  energy: string;
  text_overlays: string;
  rewrite: { hook: string; script: string; scenes: Scene[]; cta: string; recommended_output: OutputType };
}
type OutputType = "ugc" | "cinematic" | "talking_head";
type Phase = "upload" | "analyzing" | "review" | "generating" | "done";
type AnalyzeStage = "uploading" | "frames" | "transcribing" | "analyzing";
type GenStage = "charging" | "uploading" | "generating" | "saving";
interface HeygenAvatar { id: string; name: string; gender: string; preview: string }
interface HeygenVoice { id: string; name: string; language: string; gender: string }

const MAX_BYTES = 25 * 1024 * 1024;      // Whisper upload limit
const ACCEPTED = ["mp4", "webm", "m4a", "mp3"];
const MAX_SECONDS = 600;                 // generation timeout

const OUTPUTS: { id: OutputType; title: string; desc: string; engine: string; icon: typeof Megaphone }[] = [
  { id: "ugc", title: "UGC style", desc: "Creator-style clip from a reference photo of your presenter", engine: "Higgsfield", icon: Megaphone },
  { id: "cinematic", title: "Cinematic", desc: "Polished scene from the visual prompt, with native audio on supported models", engine: "Kling / Seedance / Veo", icon: Clapperboard },
  { id: "talking_head", title: "Talking head", desc: "An AI avatar speaks the full rewritten script", engine: "HeyGen avatar", icon: UserRound },
];

const STAGE_LABEL: Record<string, string> = {
  hook: "Hook", problem: "Problem", agitation: "Agitation", solution: "Solution", demo: "Demo", proof: "Proof", offer: "Offer", cta: "CTA",
};

// ---------------------------------------------------------------- helpers

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token } : null;
}

async function apiPost(path: string, body: unknown) {
  const headers = await authHeaders();
  if (!headers) return { ok: false, data: { error: "Please sign in again." } as any };
  const res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
  let data: any = {};
  try { data = await res.json(); } catch { data = { error: `Request failed (${res.status})` }; }
  return { ok: res.ok, data };
}

function loadVideo(file: File): Promise<{ video: HTMLVideoElement; url: string }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => resolve({ video, url });
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
    video.src = url;
  });
}

// Grab JPEG frames: three across the hook, then evenly through the rest of the ad
async function extractFrames(file: File, duration: number): Promise<{ time: number; data_url: string }[]> {
  const { video, url } = await loadVideo(file);
  const hook = [0.4, 1.4, 2.6].filter((t) => t < duration);
  const rest = [0.3, 0.55, 0.8].map((p) => Math.max(3, duration * p)).filter((t) => t < duration - 0.2);
  const times = [...hook, ...rest];
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 512 / Math.max(video.videoWidth || 512, video.videoHeight || 512));
  canvas.width = Math.round((video.videoWidth || 512) * scale);
  canvas.height = Math.round((video.videoHeight || 512) * scale);
  const ctx = canvas.getContext("2d");
  const frames: { time: number; data_url: string }[] = [];
  for (const t of times) {
    await new Promise<void>((resolve) => {
      const done = () => { video.removeEventListener("seeked", done); resolve(); };
      video.addEventListener("seeked", done);
      video.currentTime = t;
      setTimeout(done, 3000);
    });
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push({ time: t, data_url: canvas.toDataURL("image/jpeg", 0.72) });
    }
  }
  URL.revokeObjectURL(url);
  return frames;
}

async function uploadToStorage(file: File): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `admin-uploads/${session.user.id}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("generation-inputs").upload(path, file, { contentType: file.type || undefined });
  if (error) { console.error("Upload error:", error); return null; }
  return supabase.storage.from("generation-inputs").getPublicUrl(path).data.publicUrl;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const wordCount = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

// ---------------------------------------------------------------- page

export default function AdRemix() {
  const [balance, setBalance] = useState<number | null>(null);
  const [enabledKeys, setEnabledKeys] = useState<Record<string, boolean>>({});
  const [tokenPricing, setTokenPricing] = useState<Record<string, number>>({});

  // Upload + analysis
  const [file, setFile] = useState<File | null>(null);
  const [fileSeconds, setFileSeconds] = useState(0);
  const [notes, setNotes] = useState("");
  const [feature, setFeature] = useState("");
  const [phase, setPhase] = useState<Phase>("upload");
  const [analyzeStage, setAnalyzeStage] = useState<AnalyzeStage>("uploading");
  const [transcript, setTranscript] = useState<{ text: string; segments: Segment[]; language: string | null } | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisProvider, setAnalysisProvider] = useState("");

  // Editable rewrite
  const [hook, setHook] = useState("");
  const [script, setScript] = useState("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [cta, setCta] = useState("");

  // Output
  const [output, setOutput] = useState<OutputType>("cinematic");
  const [sceneIdx, setSceneIdx] = useState(0);
  const [model, setModel] = useState("kling-v3-std");
  const [duration, setDuration] = useState("5");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [presenterFile, setPresenterFile] = useState<File | null>(null);
  const [presenterPreview, setPresenterPreview] = useState("");
  const [avatars, setAvatars] = useState<HeygenAvatar[]>([]);
  const [voices, setVoices] = useState<HeygenVoice[]>([]);
  const [heygenLoading, setHeygenLoading] = useState(false);
  const [avatarId, setAvatarId] = useState("");
  const [voiceId, setVoiceId] = useState("");

  // Generation
  const [genStage, setGenStage] = useState<GenStage>("charging");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url: string; saved: boolean; cost: number } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const presenterRef = useRef<HTMLInputElement>(null);

  // ---- load balance and settings ----
  useEffect(() => {
    const load = async () => {
      const headers = await authHeaders();
      if (!headers) return;
      const [bRes, sRes, pRes] = await Promise.all([
        fetch("/api/admin/showcase-studio", { headers }),
        fetch("/api/settings/models"),
        fetch("/api/token-pricing"),
      ]);
      const b = await bRes.json();
      if (typeof b.balance === "number") setBalance(b.balance);
      setEnabledKeys((await sRes.json()).models ?? {});
      setTokenPricing((await pRes.json()).pricing ?? {});
    };
    load();
  }, []);

  useEffect(() => {
    if (phase !== "analyzing" && phase !== "generating") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const cinematicModels = VIDEO_MODELS.filter((m) => isModelVisible(m, enabledKeys) && m.provider !== "higgsfield");
  const activeModel = cinematicModels.some((m) => m.id === model) ? model : (cinematicModels[0]?.id ?? model);
  const modelInfo = VIDEO_MODELS.find((m) => m.id === activeModel);
  const higgsfieldOn = VIDEO_MODELS.some((m) => m.id === "higgsfield-ugc" && isModelVisible(m, enabledKeys));
  const scene = scenes[sceneIdx];

  const talkingRate = tokenPricing["heygen_avatar"] ?? 20;
  const scriptMinutes = wordCount(script) / 150;
  const cost = output === "talking_head"
    ? Math.max(talkingRate, Math.ceil(scriptMinutes * talkingRate))
    : output === "ugc"
      ? (tokenPricing["higgsfield-ugc"] ?? 10)
      : (tokenPricing[activeModel] ?? modelInfo?.tokens ?? 10) * (duration === "10" ? 2 : 1);

  // ---- file pick ----
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "mov") { setError("MOV files can't be transcribed. Convert it to MP4 first."); return; }
    if (!ACCEPTED.includes(ext)) { setError("Upload an MP4 or WebM video."); return; }
    if (f.size > MAX_BYTES) { setError("Video must be 25MB or smaller (the transcription limit). Compress or trim it first."); return; }
    try {
      const { video, url } = await loadVideo(f);
      const seconds = video.duration;
      URL.revokeObjectURL(url);
      if (!isFinite(seconds) || seconds <= 0) throw new Error("no duration");
      setFile(f); setFileSeconds(seconds); setError("");
    } catch {
      setError("Couldn't read this video. Try converting it to MP4.");
    }
  };

  // ---- analyse ----
  const analyse = async () => {
    if (!file) { setError("Upload a competitor ad first."); return; }
    setError(""); setElapsed(0); setPhase("analyzing"); setAnalyzeStage("uploading");
    try {
      const videoUrl = await uploadToStorage(file);
      if (!videoUrl) throw new Error("Video upload failed.");

      setAnalyzeStage("frames");
      const frames = await extractFrames(file, fileSeconds).catch(() => []);

      setAnalyzeStage("transcribing");
      const tr = await apiPost("/api/admin/ad-remix", { action: "transcribe", video_url: videoUrl });
      if (!tr.ok) throw new Error(tr.data.error ?? "Transcription failed.");
      const t = { text: tr.data.text ?? "", segments: tr.data.segments ?? [], language: tr.data.language ?? null };
      setTranscript(t);

      setAnalyzeStage("analyzing");
      const an = await apiPost("/api/admin/ad-remix", {
        action: "analyze", transcript: t.text, segments: t.segments, frames, duration: fileSeconds, notes, feature,
      });
      if (!an.ok) throw new Error(an.data.error ?? "Analysis failed.");
      const a: Analysis = an.data.analysis;
      setAnalysis(a); setAnalysisProvider(an.data.provider ?? "");
      setHook(a.rewrite.hook); setScript(a.rewrite.script); setScenes(a.rewrite.scenes ?? []); setCta(a.rewrite.cta);
      setSceneIdx(0);
      const rec = a.rewrite.recommended_output;
      setOutput(rec === "ugc" && !higgsfieldOn ? "cinematic" : rec);
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setPhase("upload");
    }
  };

  // ---- HeyGen avatars/voices (loaded on demand) ----
  const loadHeygen = async () => {
    if (avatars.length || heygenLoading) return;
    setHeygenLoading(true);
    const { ok, data } = await apiPost("/api/admin/ad-remix", { action: "heygen_options" });
    setHeygenLoading(false);
    if (!ok) { setError(data.error ?? "Couldn't load HeyGen avatars."); return; }
    setAvatars(data.avatars ?? []); setVoices(data.voices ?? []);
    if (data.avatars?.[0]) setAvatarId(data.avatars[0].id);
  };

  const chooseOutput = (o: OutputType) => {
    setOutput(o); setError("");
    if (o === "talking_head") loadHeygen();
  };

  const onPresenter = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) { setError("Choose an image file."); return; }
    if (f.size > 10 * 1024 * 1024) { setError("Image must be under 10MB."); return; }
    setPresenterFile(f); setError("");
    const reader = new FileReader();
    reader.onload = (ev) => setPresenterPreview(String(ev.target?.result ?? ""));
    reader.readAsDataURL(f);
  };

  const updateScene = (i: number, patch: Partial<Scene>) => setScenes((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  // ---- poll the existing status endpoint ----
  const poll = (taskId: string, provider: string): Promise<{ url: string | null; reason: string }> =>
    new Promise((resolve) => {
      const started = Date.now();
      const timer = setInterval(async () => {
        if (Date.now() - started > MAX_SECONDS * 1000) { clearInterval(timer); resolve({ url: null, reason: "Generation timed out after 10 minutes." }); return; }
        try {
          const res = await fetch(`/api/video-status?task_id=${encodeURIComponent(taskId)}&provider=${provider}`);
          const sd = await res.json();
          if (sd.completed && sd.video_url) { clearInterval(timer); resolve({ url: sd.video_url, reason: "" }); }
          else if (sd.failed) { clearInterval(timer); resolve({ url: null, reason: sd.fail_reason ?? "Generation failed." }); }
        } catch { /* keep polling */ }
      }, provider.startsWith("heygen") ? 10000 : 5000);
    });

  // ---- generate the ad ----
  const generate = async () => {
    if (output === "talking_head") {
      if (!script.trim()) { setError("The script is empty."); return; }
      if (!avatarId) { setError("Choose a HeyGen avatar."); return; }
    } else {
      if (!scene?.visual_prompt.trim()) { setError("The selected scene has no visual prompt."); return; }
      if (output === "ugc" && !presenterFile) { setError("Upload a photo of your presenter for UGC style."); return; }
    }
    if (balance !== null && balance < cost) { setError(`Not enough showcase tokens: this costs ${cost}, balance is ${balance}. Top it up in Showcase Studio.`); return; }

    setError(""); setResult(null); setElapsed(0); setPhase("generating"); setGenStage("charging");
    const amount = cost;
    let charged = false;
    const fail = async (msg: string) => {
      if (charged) {
        const r = await apiPost("/api/admin/showcase-studio", { action: "refund", amount });
        if (typeof r.data.balance === "number") setBalance(r.data.balance);
      }
      setError(msg + (charged ? ` ${amount} tokens refunded.` : ""));
      setPhase("review");
    };

    try {
      const charge = await apiPost("/api/admin/showcase-studio", { action: "charge", amount });
      if (!charge.ok) { setError(charge.data.error ?? "Couldn't reserve tokens."); setPhase("review"); return; }
      charged = true;
      if (typeof charge.data.balance === "number") setBalance(charge.data.balance);

      let start: { task_id?: string; provider?: string; error?: string };
      let savedPrompt = "";
      let savedModel = "";

      if (output === "talking_head") {
        setGenStage("generating");
        savedPrompt = script.trim();
        savedModel = "HeyGen Avatar";
        const r = await apiPost("/api/admin/ad-remix", { action: "heygen_generate", script: savedPrompt, avatar_id: avatarId, voice_id: voiceId || undefined, aspect_ratio: aspectRatio });
        if (!r.ok) { await fail(r.data.error ?? "HeyGen couldn't start the video."); return; }
        start = r.data;
      } else {
        let imageUrl: string | undefined;
        if (output === "ugc" && presenterFile) {
          setGenStage("uploading");
          imageUrl = (await uploadToStorage(presenterFile)) ?? undefined;
          if (!imageUrl) { await fail("Presenter photo upload failed."); return; }
        }
        setGenStage("generating");
        const useModel = output === "ugc" ? "higgsfield-ugc" : activeModel;
        const withAudio = output === "cinematic" && modelInfo?.hasSound === true;
        // Audio models can speak the scene's line natively
        savedPrompt = withAudio && scene.voiceover.trim()
          ? `${scene.visual_prompt.trim()} The person says: "${scene.voiceover.trim()}"`
          : scene.visual_prompt.trim();
        savedModel = useModel;
        const res = await fetch("/api/generate-video", {
          // Admin login stands in for a token charge (admin tools spend the showcase balance)
          method: "POST", headers: (await authHeaders()) ?? { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: savedPrompt,
            mode: imageUrl ? "image_to_video" : "text_to_video",
            image_url: imageUrl,
            duration: output === "ugc" ? "5" : duration,
            aspect_ratio: aspectRatio,
            model: useModel,
            with_audio: withAudio,
          }),
        });
        start = await res.json();
        if (!res.ok || !start.task_id) { await fail(start.error ?? "Couldn't start generation."); return; }
      }

      const outcome = await poll(start.task_id!, start.provider ?? "kie");
      if (!outcome.url) { await fail(outcome.reason); return; }

      // Save to generations so it shows in the admin gallery
      setGenStage("saving");
      const save = await apiPost("/api/generations", {
        type: "ad_creative",
        prompt: savedPrompt,
        video_url: outcome.url,
        output_type: "video",
        status: "completed",
        tokens_used: amount,
        duration: output === "talking_head" ? String(Math.round(scriptMinutes * 60)) : (output === "ugc" ? "5" : duration),
        aspect_ratio: aspectRatio,
        model: savedModel,
        provider: start.provider ?? null,
      });
      setResult({ url: outcome.url, saved: save.ok, cost: amount });
      setPhase("done");
    } catch (e) {
      console.error("Ad remix generation error:", e);
      await fail("Something went wrong.");
    }
  };

  const startOver = () => {
    setPhase("upload"); setFile(null); setFileSeconds(0); setTranscript(null); setAnalysis(null);
    setScenes([]); setScript(""); setHook(""); setCta(""); setResult(null); setError(""); setNotes("");
  };

  // ---------------------------------------------------------------- render

  const analyzeSteps: { key: AnalyzeStage; label: string }[] = [
    { key: "uploading", label: "Uploading video" },
    { key: "frames", label: "Capturing key frames" },
    { key: "transcribing", label: "Transcribing speech (Whisper)" },
    { key: "analyzing", label: "Analysing and rewriting for KlipflowAI" },
  ];
  const genSteps: { key: GenStage; label: string; show: boolean }[] = [
    { key: "charging", label: "Showcase tokens reserved", show: true },
    { key: "uploading", label: "Uploading presenter photo", show: output === "ugc" },
    { key: "generating", label: output === "talking_head" ? "HeyGen is rendering the avatar" : "Generating video", show: true },
    { key: "saving", label: "Saving to gallery", show: true },
  ];
  const stepList = <K extends string>(steps: { key: K; label: string; show?: boolean }[], current: K) => {
    const order = steps.map((s) => s.key);
    return (
      <ul className="space-y-2">
        {steps.filter((s) => s.show !== false).map((s) => {
          const done = order.indexOf(current) > order.indexOf(s.key);
          const active = current === s.key;
          return (
            <li key={s.key} className="flex items-center gap-2 text-sm">
              {done ? <CheckCircle2 size={16} className="text-emerald-400" aria-hidden />
                : active ? <Loader2 size={16} className="animate-spin text-accent-text" aria-hidden />
                : <Circle size={16} className="text-ink-subtle" aria-hidden />}
              <span className={done || active ? "text-ink" : "text-ink-subtle"}>{s.label}</span>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Ad Remix"
        description="Upload a competitor ad, see why it works, and turn its formula into an original KlipflowAI ad."
        actions={
          <span className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
            <Coins size={15} className="text-accent-text" aria-hidden />
            <span className="tabular-nums">{balance ?? "—"}</span>
            <span className="text-ink-subtle">showcase tokens</span>
          </span>
        }
      />

      {/* ---- UPLOAD ---- */}
      {phase === "upload" && (
        <section className={`${cardClass} space-y-5 p-5 md:p-6`}>
          <input ref={fileRef} type="file" accept="video/mp4,video/webm,.mp4,.webm" onChange={onFile} className="hidden" />
          <button onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center rounded-2xl border border-dashed border-line-strong bg-canvas px-6 py-10 text-center transition-colors hover:border-accent/60">
            <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent-text"><Upload size={22} aria-hidden /></span>
            {file ? (
              <>
                <span className="text-sm font-medium text-ink">{file.name}</span>
                <span className="mt-1 text-xs text-ink-subtle">{fmt(fileSeconds)} · {(file.size / 1024 / 1024).toFixed(1)}MB · click to change</span>
              </>
            ) : (
              <>
                <span className="text-sm font-medium text-ink">Upload a competitor video ad</span>
                <span className="mt-1 text-xs text-ink-subtle">MP4 or WebM, up to 25MB</span>
              </>
            )}
          </button>
          <Field label="Feature to promote" hint="The KlipflowAI version is written around this tool">
            <Select value={feature} onChange={(e) => setFeature(e.target.value)}>
              <option value="">Best fit (AI picks)</option>
              {STUDIO_MODULES.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </Select>
          </Field>
          <Field label="Notes for the analysis (optional)" hint="e.g. who the ad targets, or what to emphasise in the KlipflowAI version">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Target e-commerce store owners. Emphasise speed." />
          </Field>
          {error && <Alert>{error}</Alert>}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-ink-subtle">Only the ad&apos;s structure is reused. The rewrite uses new words and original, fictional people.</p>
            <Button variant="primary" size="lg" onClick={analyse} disabled={!file}><Sparkles size={17} aria-hidden /> Analyse ad</Button>
          </div>
        </section>
      )}

      {/* ---- ANALYSING ---- */}
      {phase === "analyzing" && (
        <section className={`${cardClass} space-y-5 p-6`}>
          <div className="text-center">
            <h2 className="text-base font-semibold">Breaking down the ad</h2>
            <p className="mt-1 text-sm text-ink-muted">{file?.name} · usually under a minute</p>
          </div>
          <Progress value={{ uploading: 12, frames: 30, transcribing: 55, analyzing: 80 }[analyzeStage]} />
          {stepList(analyzeSteps, analyzeStage)}
        </section>
      )}

      {/* ---- REVIEW ---- */}
      {(phase === "review" || phase === "generating" || phase === "done") && analysis && (
        <div className="space-y-4">
          {/* Transcript */}
          <details className={`${cardClass} group`} open={phase === "review"}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2 text-base font-semibold"><FileText size={17} className="text-accent-text" aria-hidden /> Original transcript</span>
              <span className="text-xs text-ink-subtle">{transcript?.language ? `${transcript.language} · ` : ""}{fmt(fileSeconds)}</span>
            </summary>
            <div className="max-h-72 space-y-1.5 overflow-y-auto border-t border-line px-5 py-4 text-sm">
              {transcript?.segments.length ? transcript.segments.map((s, i) => (
                <p key={i} className={s.start < 3 ? "text-ink" : "text-ink-muted"}>
                  <span className="mr-2 inline-block w-12 font-mono text-xs text-ink-subtle">{fmt(s.start)}</span>{s.text}
                </p>
              )) : <p className="text-ink-muted">{transcript?.text || "No speech detected. The analysis used the video frames only."}</p>}
            </div>
          </details>

          {/* Analysis */}
          <section className={`${cardClass} space-y-5 p-5 md:p-6`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Why it works</h2>
              <Badge>{analysisProvider === "claude" ? "Claude" : "GPT-4o"}</Badge>
            </div>
            <div className="rounded-xl border border-accent/25 bg-accent/[0.06] p-4">
              <p className="mb-1 text-xs font-medium text-accent-text">Hook (first 3 seconds) · {analysis.hook.technique}</p>
              <p className="text-sm text-ink">{analysis.hook.first_3_seconds}</p>
              <p className="mt-2 text-xs text-ink-muted">{analysis.hook.why_it_works}</p>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-ink-subtle">Structure</p>
              <ol className="flex flex-wrap gap-2">
                {analysis.flow.map((f, i) => (
                  <li key={i} className="max-w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm sm:max-w-[48%]">
                    <span className="mr-1.5 font-medium text-ink">{i + 1}. {STAGE_LABEL[f.stage] ?? f.stage}</span>
                    <span className="text-ink-muted">{f.summary}</span>
                  </li>
                ))}
              </ol>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                { k: "Pain point", v: analysis.pain_point },
                { k: "Audience", v: analysis.target_audience },
                { k: `Visual style · ${analysis.visual_style.format.replace(/_/g, " ")}`, v: analysis.visual_style.description },
                { k: "Pacing and energy", v: `${analysis.pacing} ${analysis.energy}` },
                { k: "Text overlays", v: analysis.text_overlays },
              ].map((row) => (
                <div key={row.k} className="rounded-xl border border-line bg-canvas p-3.5">
                  <dt className="mb-1 text-xs font-medium text-ink-subtle">{row.k}</dt>
                  <dd className="text-sm text-ink-muted">{row.v}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Rewrite */}
          <section className={`${cardClass} space-y-5 p-5 md:p-6`}>
            <div className="flex items-center gap-2">
              <Repeat2 size={17} className="text-accent-text" aria-hidden />
              <h2 className="text-base font-semibold">KlipflowAI version</h2>
              <span className="text-xs text-ink-subtle">Edit anything before generating</span>
            </div>
            <Field label="Hook"><Input value={hook} onChange={(e) => setHook(e.target.value)} /></Field>
            <Field label="Full voiceover script" hint={`${wordCount(script)} words · about ${Math.max(1, Math.round(scriptMinutes * 60))} seconds spoken`}>
              <Textarea rows={6} value={script} onChange={(e) => setScript(e.target.value)} />
            </Field>
            <Field label="Call to action"><Input value={cta} onChange={(e) => setCta(e.target.value)} /></Field>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-medium text-ink-muted">Scenes</p>
                <Button size="sm" variant="ghost" onClick={() => setScenes((p) => [...p, { visual_prompt: "", voiceover: "", on_screen_text: "" }])}><Plus size={14} aria-hidden /> Add scene</Button>
              </div>
              <div className="space-y-3">
                {scenes.map((s, i) => (
                  <div key={i} className={"rounded-xl border p-4 " + (output !== "talking_head" && sceneIdx === i ? "border-accent bg-accent/[0.05]" : "border-line bg-canvas")}>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">Scene {i + 1}</span>
                      <div className="flex items-center gap-1">
                        {output !== "talking_head" && (
                          <Button size="sm" variant={sceneIdx === i ? "primary" : "secondary"} onClick={() => setSceneIdx(i)}>
                            {sceneIdx === i ? "Selected" : "Use this scene"}
                          </Button>
                        )}
                        {scenes.length > 1 && (
                          <button aria-label={`Remove scene ${i + 1}`} onClick={() => { setScenes((p) => p.filter((_, j) => j !== i)); setSceneIdx(0); }}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink-subtle hover:bg-white/5 hover:text-red-300"><Trash2 size={15} aria-hidden /></button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Field label="Visual prompt"><Textarea rows={3} value={s.visual_prompt} onChange={(e) => updateScene(i, { visual_prompt: e.target.value })} /></Field>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Voiceover"><Textarea rows={2} value={s.voiceover} onChange={(e) => updateScene(i, { voiceover: e.target.value })} /></Field>
                        <Field label="On-screen text"><Textarea rows={2} value={s.on_screen_text} onChange={(e) => updateScene(i, { on_screen_text: e.target.value })} /></Field>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Output */}
          {phase === "review" && (
            <section className={`${cardClass} space-y-5 p-5 md:p-6`}>
              <h2 className="text-base font-semibold">Output</h2>
              <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Output type">
                {OUTPUTS.map((o) => {
                  const Icon = o.icon;
                  const disabled = o.id === "ugc" && !higgsfieldOn;
                  return (
                    <button key={o.id} role="radio" aria-checked={output === o.id} disabled={disabled} onClick={() => chooseOutput(o.id)}
                      className={"rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 " + (output === o.id ? "border-accent bg-accent/10" : "border-line bg-canvas hover:border-line-strong")}>
                      <div className="mb-2 flex items-center justify-between">
                        <Icon size={18} className={output === o.id ? "text-accent-text" : "text-ink-muted"} aria-hidden />
                        {analysis.rewrite.recommended_output === o.id && <Badge tone="accent">Recommended</Badge>}
                      </div>
                      <p className="text-sm font-semibold">{o.title}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">{o.desc}</p>
                      <p className="mt-2 text-xs text-ink-subtle">{disabled ? "Enable Higgsfield in AI Providers" : o.engine}</p>
                    </button>
                  );
                })}
              </div>

              {output === "cinematic" && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Model">
                    <Select value={activeModel} onChange={(e) => setModel(e.target.value)}>
                      {cinematicModels.map((m) => <option key={m.id} value={m.id}>{m.name}{m.hasSound ? " · audio" : ""}</option>)}
                    </Select>
                  </Field>
                  <Field label="Duration">
                    <Select value={duration} onChange={(e) => setDuration(e.target.value)}>
                      <option value="5">5 seconds</option>
                      <option value="10">10 seconds</option>
                    </Select>
                  </Field>
                  <Field label="Aspect ratio">
                    <Select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
                      <option value="9:16">9:16 vertical</option>
                      <option value="16:9">16:9 widescreen</option>
                      <option value="1:1">1:1 square</option>
                    </Select>
                  </Field>
                </div>
              )}

              {output === "ugc" && (
                <div>
                  <p className="mb-1.5 text-[13px] font-medium text-ink-muted">Presenter photo</p>
                  <input ref={presenterRef} type="file" accept="image/*" onChange={onPresenter} className="hidden" />
                  <button onClick={() => presenterRef.current?.click()} className="flex w-full items-center gap-4 rounded-xl border border-dashed border-line-strong bg-canvas p-4 text-left transition-colors hover:border-accent/60">
                    {presenterPreview
                      ? <img src={presenterPreview} alt="Presenter" className="h-16 w-16 rounded-lg object-cover" />
                      : <span className="grid h-16 w-16 place-items-center rounded-lg bg-white/[0.04] text-ink-subtle"><ImagePlus size={20} aria-hidden /></span>}
                    <span className="text-sm text-ink-muted">{presenterFile ? presenterFile.name : "Upload a photo of a presenter you have the rights to use. Never the competitor's actor."}</span>
                  </button>
                </div>
              )}

              {output === "talking_head" && (
                heygenLoading ? (
                  <p className="flex items-center gap-2 text-sm text-ink-muted"><Loader2 size={16} className="animate-spin" aria-hidden /> Loading HeyGen avatars and voices…</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Avatar">
                      <Select value={avatarId} onChange={(e) => setAvatarId(e.target.value)}>
                        {avatars.length === 0 && <option value="">No avatars loaded</option>}
                        {avatars.map((a) => <option key={a.id} value={a.id}>{a.name}{a.gender ? ` · ${a.gender}` : ""}</option>)}
                      </Select>
                    </Field>
                    <Field label="Voice" hint="Default uses the avatar's own voice">
                      <Select value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
                        <option value="">Avatar default</option>
                        {voices.map((v) => <option key={v.id} value={v.id}>{v.name}{v.language ? ` · ${v.language}` : ""}{v.gender ? ` · ${v.gender}` : ""}</option>)}
                      </Select>
                    </Field>
                    <Field label="Aspect ratio">
                      <Select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
                        <option value="9:16">9:16 vertical</option>
                        <option value="16:9">16:9 widescreen</option>
                        <option value="1:1">1:1 square</option>
                      </Select>
                    </Field>
                    {avatars.find((a) => a.id === avatarId)?.preview && (
                      <img src={avatars.find((a) => a.id === avatarId)!.preview} alt="Avatar preview" className="h-28 w-28 rounded-xl border border-line object-cover" />
                    )}
                  </div>
                )
              )}

              {output !== "talking_head" && scenes.length > 0 && (
                <p className="text-xs text-ink-subtle">
                  Generates Scene {sceneIdx + 1} as one clip. Generate each scene in turn to build the full ad; clips aren&apos;t stitched together automatically.
                </p>
              )}

              {error && <Alert>{error}</Alert>}

              <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink-muted">
                  Cost: <span className="font-semibold text-ink">{cost} showcase tokens</span>
                  {output === "talking_head" && <span className="text-ink-subtle"> ({talkingRate}/min of script)</span>}
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={startOver}>Start over</Button>
                  <Button variant="primary" size="lg" onClick={generate}><Mic size={17} aria-hidden /> Generate ad</Button>
                </div>
              </div>
            </section>
          )}

          {/* Generating */}
          {phase === "generating" && (
            <section className={`${cardClass} space-y-5 p-6`}>
              <div className="text-center">
                <h2 className="text-base font-semibold">Generating your KlipflowAI ad</h2>
                <p className="mt-1 text-sm text-ink-muted">Keep this page open · {fmt(elapsed)} elapsed</p>
              </div>
              <Progress value={{ charging: 6, uploading: 12, generating: Math.min(92, 15 + (elapsed / (output === "talking_head" ? 300 : 180)) * 77), saving: 96 }[genStage]} />
              {stepList(genSteps, genStage)}
              <p className="text-center text-xs text-ink-subtle">Tokens go back to the showcase balance if this fails or takes longer than 10 minutes.</p>
            </section>
          )}

          {/* Done */}
          {phase === "done" && result && (
            <section className={`${cardClass} space-y-4 p-5`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-400" aria-hidden />
                  <h2 className="text-base font-semibold">Ad ready</h2>
                  <Badge>{result.cost} tokens</Badge>
                </div>
                <a href={result.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-accent-text hover:underline">Open <ExternalLink size={14} aria-hidden /></a>
              </div>
              <video src={result.url} controls playsInline className="max-h-[70vh] w-full rounded-xl border border-line bg-black" />
              {result.saved
                ? <Alert tone="success">Saved as an ad creative. Find it in <Link href="/admin/generations" className="underline">Admin → Generations</Link> or your Gallery.</Alert>
                : <Alert tone="warning">The video was generated but couldn&apos;t be saved to the gallery. Open it and download it now.</Alert>}
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => { setPhase("review"); setResult(null); }}>Generate another scene or output</Button>
                <Button variant="ghost" onClick={startOver}>Remix a different ad</Button>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
