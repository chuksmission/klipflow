"use client";
import { useEffect, useRef, useState } from "react";
import {
  Ban, CheckCircle2, ChevronLeft, Circle, Download, ImagePlus, Languages, Loader2, ScanFace, Upload, XCircle,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { chargeTokens, refundCharge, refundNote } from "../../lib/token-client";
import { extractAudio, joinClips, splitVideo } from "../../lib/ffmpeg-client";
import {
  ACTOR_SWAP_LANGUAGES, ACTOR_SWAP_MAX_SECONDS, ACT_TWO_CHUNK_SECONDS, BACKGROUND_PRESETS,
  actorSwapCost, chunkCount, ratePerMinute, ratesFrom, type BackgroundMode, type VoiceGender,
} from "../../lib/actor-swap";
import { Alert, Badge, Button, Field, Textarea, Toggle, cardClass, Progress } from "../../components/ui";
import CostSummary from "../../components/CostSummary";
import LanguageAccentSelector from "../../components/LanguageAccentSelector";

const MAX_SOURCE_BYTES = 300 * 1024 * 1024;   // ffmpeg.wasm works in browser memory
const POLL_MS = 7000;
const RESUME_KEY = "kf_actor_swap_job";

type ClientStage = "charging" | "uploading" | "preparing" | "processing" | "stitching" | "saving";
type StepState = "done" | "active" | "pending" | "failed" | "skipped";

interface JobView {
  id: string;
  status: "running" | "needs_stitch" | "done" | "partial" | "failed";
  cost: number;
  refunded: number;
  result_url: string | null;
  error: string | null;
  steps: { compose: string; face: string; face_done: number; face_total: number; voice: string; voice_step: string | null; stitch: string; lipsync: string };
  stitch: { clips: string[]; with_audio: boolean; audio_from: string } | null;
  script: string | null;
}

interface Saved { jobId: string; chargeId: string; seconds: number; aspect: string; prompt: string }

interface Props {
  tokenBalance: number;
  setTokenBalance: (fn: (b: number) => number) => void;
  tokenPricing: Record<string, number>;
  enabledKeys: Record<string, boolean>;
  settingsLoaded: boolean;
  onBack: () => void;
  onBusyChange: (busy: boolean) => void;
}

// ---------------------------------------------------------------- helpers

async function session() {
  return (await supabase.auth.getSession()).data.session;
}

interface ApiData { error?: string; job?: JobView }

async function authed(path: string, body: unknown): Promise<{ ok: boolean; data: ApiData }> {
  const s = await session();
  if (!s) return { ok: false, data: { error: "Please sign in again." } };
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.access_token }, body: JSON.stringify(body) });
  let data: ApiData = {};
  try { data = await res.json(); } catch { data = { error: `Request failed (${res.status})` }; }
  return { ok: res.ok, data };
}

function probeVideo(src: string): Promise<{ seconds: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      if (!isFinite(v.duration) || v.duration <= 0) reject(new Error("no duration"));
      else resolve({ seconds: v.duration, width: v.videoWidth, height: v.videoHeight });
    };
    v.onerror = () => reject(new Error("unreadable"));
    v.src = src;
  });
}

async function upload(blob: Blob, ext: string): Promise<string | null> {
  const s = await session();
  if (!s) return null;
  const path = `actor-swap/${s.user.id}-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
  const { error } = await supabase.storage.from("generation-inputs").upload(path, blob, { contentType: blob.type || undefined });
  if (error) { console.error("Upload error:", error); return null; }
  return supabase.storage.from("generation-inputs").getPublicUrl(path).data.publicUrl;
}

const readSaved = (): Saved | null => { try { return JSON.parse(localStorage.getItem(RESUME_KEY) ?? "null"); } catch { return null; } };
const writeSaved = (v: Saved | null) => { try { if (v) localStorage.setItem(RESUME_KEY, JSON.stringify(v)); else localStorage.removeItem(RESUME_KEY); } catch { /* storage unavailable */ } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const aspectFromDims = (w: number, h: number) => (w > h * 1.2 ? "16:9" : h > w * 1.2 ? "9:16" : "1:1");
const fileExt = (f: File, fallback: string) => f.name.split(".").pop()?.toLowerCase() || fallback;

// ---------------------------------------------------------------- component

export default function ActorSwap({ tokenBalance, setTokenBalance, tokenPricing, enabledKeys, settingsLoaded, onBack, onBusyChange }: Props) {
  // Source
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceMeta, setSourceMeta] = useState<{ seconds: number; width: number; height: number } | null>(null);

  // Choices
  const [changeFace, setChangeFace] = useState(true);
  const [changeVoice, setChangeVoice] = useState(false);
  const [reference, setReference] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState("");
  const [bgMode, setBgMode] = useState<BackgroundMode>("model");
  const [bgPreset, setBgPreset] = useState<string>(BACKGROUND_PRESETS[0].id);
  const [bgDescription, setBgDescription] = useState("");
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgPreview, setBgPreview] = useState("");
  const [languageCode, setLanguageCode] = useState("");
  const [accent, setAccent] = useState("");
  const [gender, setGender] = useState<VoiceGender>("female");
  const [consent, setConsent] = useState(false);

  // Run state
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<ClientStage>("charging");
  const [prepProgress, setPrepProgress] = useState(0);
  const [job, setJob] = useState<JobView | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url: string; cost: number; refunded: number; partial: string | null } | null>(null);
  // A job left running when the page was closed can be picked up again
  const [resumable, setResumable] = useState<Saved | null>(() => (typeof window === "undefined" ? null : readSaved()));
  const cancelRef = useRef(false);
  const chargeRef = useRef<string | null>(null);
  const creditedRef = useRef(0);

  const sourceRef = useRef<HTMLInputElement>(null);
  const referenceRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);

  const moduleOn = enabledKeys["ai_actor_swap_enabled"] === true;
  const language = ACTOR_SWAP_LANGUAGES.find((l) => l.code === languageCode) ?? null;
  const background: BackgroundMode = changeFace ? bgMode : "model";
  const rates = ratesFrom(tokenPricing);
  const choices = { changeFace, changeVoice, background };
  const rate = ratePerMinute(choices, rates);
  const cost = actorSwapCost(choices, rates, sourceMeta?.seconds ?? 15);
  const rateLabel = [changeFace && "new face", changeVoice && "new voice", changeFace && background !== "model" && "new background"].filter(Boolean).join(" + ");

  useEffect(() => { onBusyChange(running); }, [running, onBusyChange]);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  // ---- inputs ----
  const onSourceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!["mp4", "mov", "webm"].includes(fileExt(f, ""))) { setError("Upload an MP4, MOV or WebM video."); return; }
    if (f.size > MAX_SOURCE_BYTES) { setError(`Video must be under ${MAX_SOURCE_BYTES / 1024 / 1024}MB.`); return; }
    const url = URL.createObjectURL(f);
    try {
      const meta = await probeVideo(url);
      if (meta.seconds > ACTOR_SWAP_MAX_SECONDS + 0.5) { setError(`Videos can be up to 2 minutes. This one is ${fmt(meta.seconds)}. Trim it first.`); return; }
      if (meta.seconds < 3) { setError("The video needs to be at least 3 seconds long."); return; }
      setSourceFile(f); setSourceMeta(meta); setError("");
    } catch {
      setError("Couldn't read this video. Try converting it to MP4.");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const onImage = (setFile: (f: File) => void, setPreview: (s: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) { setError("Upload a JPG, PNG or WebP image."); return; }
    if (f.size > 10 * 1024 * 1024) { setError("Image must be under 10MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(String(ev.target?.result ?? ""));
    reader.readAsDataURL(f);
    setFile(f); setError("");
  };


  // ---- job loop (shared by new runs and resumed ones) ----
  const credit = (j: JobView) => {
    const diff = j.refunded - creditedRef.current;
    if (diff > 0) { creditedRef.current = j.refunded; setTokenBalance((b) => b + diff); }
  };

  const followJob = async (saved: Saved, localSource: File | null) => {
    setStage("processing");
    let current: JobView | null = null;
    while (true) {
      if (cancelRef.current) {
        const r = await authed("/api/actor-swap", { action: "abort", job_id: saved.jobId });
        if (r.data.job) { credit(r.data.job); setJob(r.data.job); }
        writeSaved(null);
        setError("Cancelled. Your tokens have been refunded.");
        setRunning(false);
        return;
      }
      const r = await authed("/api/actor-swap", { action: "advance", job_id: saved.jobId });
      if (r.ok && r.data.job) {
        current = r.data.job as JobView;
        setJob(current);
        credit(current);
      } else if (r.data?.error === "Job not found") {
        writeSaved(null); setError("This job no longer exists."); setRunning(false); return;
      }

      if (current?.status === "needs_stitch" && current.stitch) {
        setStage("stitching");
        try {
          const joined = await joinClips(current.stitch.clips, current.stitch.with_audio ? (localSource ?? current.stitch.audio_from) : undefined);
          const url = await upload(new Blob([joined], { type: "video/mp4" }), "mp4");
          if (!url) throw new Error("upload failed");
          const s = await authed("/api/actor-swap", { action: "stitched", job_id: saved.jobId, url });
          if (s.data.job) { current = s.data.job as JobView; setJob(current); credit(current); }
        } catch (e) {
          console.error("Stitch error:", e);
          const s = await authed("/api/actor-swap", { action: "stitch_failed", job_id: saved.jobId });
          if (s.data.job) { current = s.data.job as JobView; setJob(current); credit(current); }
        }
        setStage("processing");
      }

      if (current && (current.status === "done" || current.status === "partial")) {
        setStage("saving");
        const save = await authed("/api/generations", {
          type: "ai_actor_swap",
          prompt: saved.prompt,
          video_url: current.result_url,
          output_type: "video",
          status: "completed",
          tokens_used: current.cost - current.refunded,
          duration: String(Math.round(saved.seconds)),
          aspect_ratio: saved.aspect,
          model: "AI Actor Swap",
          charge_id: saved.chargeId,
          provider: "actor_swap",
        });
        if (!save.ok) console.error("Gallery save failed:", save.data.error);
        writeSaved(null);
        setResult({
          url: current.result_url!, cost: current.cost, refunded: current.refunded,
          partial: current.status === "partial" ? current.error ?? "The new voice couldn't be created." : null,
        });
        setRunning(false);
        return;
      }
      if (current?.status === "failed") {
        writeSaved(null);
        setError((current.error ?? "Actor swap failed.") + (current.refunded > 0 ? ` ${current.refunded} tokens have been refunded.` : ""));
        setRunning(false);
        return;
      }
      await sleep(POLL_MS);
    }
  };

  const resume = async () => {
    if (!resumable) return;
    cancelRef.current = false; creditedRef.current = 0;
    setError(""); setResult(null); setJob(null); setElapsed(0); setRunning(true);
    const saved = resumable;
    setResumable(null);
    try { await followJob(saved, null); }
    catch (e) { console.error("Actor swap resume error:", e); setError("Lost connection to the job. Reload the page to resume."); setRunning(false); }
  };

  // ---- run ----
  const run = async () => {
    if (!moduleOn || !sourceFile || !sourceMeta) { setError("Upload a source video."); return; }
    if (!changeFace && !changeVoice) { setError("Choose what to change."); return; }
    if (changeFace && !reference) { setError("Upload a photo of the new person."); return; }
    if (changeFace && bgMode === "upload" && !bgFile) { setError("Upload the background image."); return; }
    if (changeFace && bgMode === "describe" && !bgDescription.trim()) { setError("Describe the background you want."); return; }
    if (changeVoice && !language) { setError("Choose a language."); return; }
    if (!consent) { setError("Confirm you have permission to use these people's likeness and voice."); return; }
    if (tokenBalance < cost) { setError(`Not enough tokens: this costs ${cost} and you have ${tokenBalance}.`); return; }
    if (!(await session())) { setError("Please sign in."); return; }

    cancelRef.current = false; creditedRef.current = 0;
    setError(""); setResult(null); setJob(null); setElapsed(0); setPrepProgress(0); setRunning(true); setStage("charging");
    chargeRef.current = null;
    const meta = sourceMeta;

    // Before the job exists the client still holds the charge, so it refunds it
    const fail = async (message: string) => {
      const r = await refundCharge(chargeRef.current);
      if (r.balance !== undefined) setTokenBalance(() => r.balance!);
      setError(message + refundNote(r));
      setRunning(false);
    };

    try {
      const charge = await chargeTokens(cost, "ai_actor_swap");
      if (!charge.ok) { setError(charge.error); setRunning(false); return; }
      chargeRef.current = charge.chargeId;
      setTokenBalance(() => charge.balance);

      setStage("uploading");
      const sourceUrl = await upload(sourceFile, fileExt(sourceFile, "mp4"));
      if (!sourceUrl) { await fail("Video upload failed."); return; }
      const referenceUrl = changeFace && reference ? await upload(reference, fileExt(reference, "jpg")) : null;
      if (changeFace && !referenceUrl) { await fail("Photo upload failed."); return; }
      const bgUrl = changeFace && bgMode === "upload" && bgFile ? await upload(bgFile, fileExt(bgFile, "jpg")) : null;
      if (changeFace && bgMode === "upload" && !bgUrl) { await fail("Background upload failed."); return; }
      if (cancelRef.current) { await fail("Cancelled."); return; }

      // Split into Runway-sized parts and pull the audio track, in the browser
      setStage("preparing");
      const chunkUrls: string[] = [];
      if (changeFace) {
        const parts = await splitVideo(sourceFile, meta.seconds, ACT_TWO_CHUNK_SECONDS, (p) => setPrepProgress(p * (changeVoice ? 0.8 : 1)));
        for (const part of parts) {
          if (cancelRef.current) { await fail("Cancelled."); return; }
          const u = await upload(part, "mp4");
          if (!u) { await fail("Upload of a video part failed."); return; }
          chunkUrls.push(u);
        }
      }
      let audioUrl: string | null = null;
      if (changeVoice) {
        audioUrl = await upload(await extractAudio(sourceFile), "mp3");
        if (!audioUrl) { await fail("Audio upload failed."); return; }
        setPrepProgress(1);
      }
      if (cancelRef.current) { await fail("Cancelled."); return; }

      const start = await authed("/api/actor-swap", {
        action: "start", charge_id: charge.chargeId,
        source_url: sourceUrl, source_seconds: meta.seconds, width: meta.width, height: meta.height,
        chunk_urls: chunkUrls, audio_url: audioUrl,
        change_face: changeFace, change_voice: changeVoice, reference_url: referenceUrl,
        background: { mode: background, preset_id: bgPreset, description: bgDescription.trim(), image_url: bgUrl },
        language_code: changeVoice ? languageCode : null, accent: changeVoice ? accent : null, gender,
      });
      if (!start.ok || !start.data.job) { await fail(start.data.error ?? "Couldn't start the actor swap."); return; }

      const prompt = [
        changeFace && "New face",
        changeFace && background !== "model" && "new background",
        changeVoice && `${language?.name}${accent ? ` (${accent})` : ""} ${gender} voice`,
      ].filter(Boolean).join(", ");
      const saved: Saved = { jobId: start.data.job.id, chargeId: charge.chargeId, seconds: meta.seconds, aspect: aspectFromDims(meta.width, meta.height), prompt: `AI Actor Swap: ${prompt}` };
      writeSaved(saved);
      setJob(start.data.job);
      await followJob(saved, sourceFile);
    } catch (e) {
      console.error("Actor swap error:", e);
      // Once the job exists the server owns the refund
      const saved = readSaved();
      if (saved) { setError("Lost connection to the job. Reload the page to resume it."); setRunning(false); setResumable(saved); }
      else await fail(e instanceof Error && /ffmpeg|memory|wasm/i.test(e.message) ? "Your browser couldn't process this video. Try a shorter or smaller file." : "Something went wrong.");
    }
  };

  const download = async (url: string) => {
    try {
      const b = await (await fetch(url)).blob();
      const href = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = href; a.download = `klipflowai-actor-swap-${Date.now()}.mp4`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(href);
    } catch { window.open(url, "_blank"); }
  };

  // ---------------------------------------------------------------- render

  const st = job?.steps;
  const serverStep = (s: string | undefined): StepState =>
    s === "done" ? "done" : s === "running" ? "active" : s === "failed" ? "failed" : s === "skipped" ? "skipped" : "pending";
  const order: ClientStage[] = ["charging", "uploading", "preparing", "processing"];
  const clientStep = (s: ClientStage): StepState => {
    const i = order.indexOf(stage === "stitching" || stage === "saving" ? "processing" : stage);
    const j = order.indexOf(s);
    return j < i ? "done" : j === i ? "active" : "pending";
  };
  const voiceSub = (sub: "script" | "tts"): StepState => {
    if (!st || st.voice === "skipped") return "skipped";
    if (st.voice === "done") return "done";
    if (st.voice === "failed") return "failed";
    const at = st.voice_step === "tts" ? "tts" : st.voice_step ? "script" : null;
    if (sub === "script") return at === "tts" ? "done" : at ? "active" : "pending";
    return at === "tts" ? "active" : "pending";
  };

  const steps: { label: string; state: StepState }[] = [
    { label: "Tokens reserved", state: clientStep("charging") },
    { label: "Uploading", state: clientStep("uploading") },
    { label: changeFace || st ? "Preparing your video" : "Preparing audio", state: clientStep("preparing") },
    ...(!st ? [] : [
      { label: "Placing the new person in the background", state: serverStep(st.compose) },
      { label: `Swapping the performer${st.face_total > 1 ? ` (${st.face_done}/${st.face_total} parts)` : ""}`, state: serverStep(st.face) },
      { label: "Translating and adapting the script", state: voiceSub("script") },
      { label: "Generating the new voice", state: voiceSub("tts") },
      { label: "Joining the video parts", state: stage === "stitching" ? "active" as StepState : st.stitch === "done" ? "done" as StepState : st.stitch === "skipped" || (st.stitch === "pending" && st.face_total <= 1) ? "skipped" as StepState : "pending" as StepState },
      { label: "Syncing lips to the new voice", state: serverStep(st.lipsync) },
    ]),
    { label: "Saving to your gallery", state: (stage === "saving" ? "active" : "pending") as StepState },
  ].filter((s) => s.state !== "skipped");
  const doneCount = steps.filter((s) => s.state === "done").length;
  const progress = result ? 100 : Math.max(4, Math.min(96, ((doneCount + (stage === "preparing" ? prepProgress : 0.4)) / steps.length) * 100));

  const header = (
    <div className="flex items-center gap-2">
      {!running && (
        <button onClick={onBack} className="inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-raised pl-2 pr-3 text-sm text-ink transition-colors hover:border-line-strong">
          <ChevronLeft size={16} aria-hidden /> All tools
        </button>
      )}
      <h2 className="text-base font-semibold">AI Actor Swap</h2>
    </div>
  );

  if (settingsLoaded && !moduleOn) {
    return (
      <div className="space-y-4">
        {header}
        <div className={`${cardClass} p-6 text-center`}>
          <p className="mb-1 font-medium text-ink">AI Actor Swap isn&apos;t available yet</p>
          <p className="text-sm text-ink-muted">It&apos;s coming soon. In the meantime, try another tool.</p>
        </div>
      </div>
    );
  }

  const choiceCard = (on: boolean, toggle: () => void, Icon: typeof ScanFace, title: string, desc: string) => (
    <button onClick={toggle} aria-pressed={on}
      className={"flex items-start gap-3 rounded-xl border p-4 text-left transition-colors " + (on ? "border-accent bg-accent/10" : "border-line bg-canvas hover:border-line-strong")}>
      <span className={"grid h-9 w-9 shrink-0 place-items-center rounded-lg " + (on ? "bg-accent/20 text-accent-text" : "bg-white/[0.04] text-ink-subtle")}><Icon size={18} aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs leading-relaxed text-ink-muted">{desc}</span>
      </span>
      {on ? <CheckCircle2 size={18} className="shrink-0 text-accent-text" aria-hidden /> : <Circle size={18} className="shrink-0 text-ink-subtle" aria-hidden />}
    </button>
  );

  const bgOptions: { id: BackgroundMode; label: string; hint: string }[] = [
    { id: "model", label: "From the photo", hint: "Recommended" },
    { id: "preset", label: "Preset scene", hint: `+${rates.background}/min` },
    { id: "upload", label: "Upload image", hint: `+${rates.background}/min` },
    { id: "describe", label: "Describe it", hint: `+${rates.background}/min` },
  ];

  return (
    <div className="space-y-4">
      {header}

      {resumable && !running && !result && (
        <Alert tone="info">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>You have an Actor Swap still in progress.</span>
            <Button variant="secondary" size="sm" onClick={resume}>Resume</Button>
          </span>
        </Alert>
      )}

      {/* RESULT */}
      {result && (
        <section className={`${cardClass} space-y-4 p-5`}>
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-400" aria-hidden />
            <h3 className="font-semibold">Your video is ready</h3>
            <Badge>{result.cost - result.refunded} tokens</Badge>
          </div>
          {result.partial && (
            <Alert tone="warning">
              The new face worked, but the new voice couldn&apos;t be created ({result.partial}), so this version keeps the original voice. {result.refunded} tokens for the voice have been refunded.
            </Alert>
          )}
          <video src={result.url} controls playsInline className="max-h-[70vh] w-full rounded-xl border border-line bg-black" />
          <div className="grid grid-cols-2 gap-3">
            <Button variant="primary" onClick={() => download(result.url)}><Download size={16} aria-hidden /> Save video</Button>
            <Button variant="secondary" onClick={() => { setResult(null); setJob(null); }}>Swap another</Button>
          </div>
          <p className="text-xs text-ink-subtle">Saved to your Gallery.</p>
        </section>
      )}

      {/* PROGRESS */}
      {running && (
        <section className={`${cardClass} space-y-5 p-6`}>
          <div className="text-center">
            <h3 className="font-semibold">Creating your new version</h3>
            <p className="mt-1 text-sm text-ink-muted">{fmt(elapsed)} elapsed · usually 5–15 minutes · keep this page open</p>
          </div>
          <Progress value={progress} />
          <ul className="space-y-2">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-sm">
                {s.state === "done" ? <CheckCircle2 size={16} className="text-emerald-400" aria-hidden />
                  : s.state === "active" ? <Loader2 size={16} className="animate-spin text-accent-text" aria-hidden />
                  : s.state === "failed" ? <XCircle size={16} className="text-red-400" aria-hidden />
                  : <Circle size={16} className="text-ink-subtle" aria-hidden />}
                <span className={s.state === "pending" ? "text-ink-subtle" : "text-ink"}>{s.label}{s.state === "failed" ? " (failed, original voice kept)" : ""}</span>
              </li>
            ))}
          </ul>
          {job?.script && (
            <div className="rounded-xl border border-line bg-canvas p-4">
              <p className="mb-1 text-xs font-medium text-ink-subtle">New script</p>
              <p className="line-clamp-4 text-sm text-ink-muted">{job.script}</p>
            </div>
          )}
          {stage !== "stitching" && stage !== "saving" && (
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" onClick={() => { cancelRef.current = true; }}><Ban size={15} aria-hidden /> Cancel and refund</Button>
            </div>
          )}
        </section>
      )}

      {/* FORM */}
      {!running && !result && (
        <div className="space-y-4">
          <section className={`${cardClass} space-y-4 p-5`}>
            <h3 className="font-semibold">Original video</h3>
            <input ref={sourceRef} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={onSourceFile} className="hidden" />
            <button onClick={() => sourceRef.current?.click()} className="flex w-full flex-col items-center rounded-xl border border-dashed border-line-strong bg-canvas px-6 py-8 text-center transition-colors hover:border-accent/60">
              <Upload size={20} className="mb-2 text-ink-subtle" aria-hidden />
              {sourceFile && sourceMeta
                ? <span className="text-sm font-medium text-ink">{sourceFile.name} · {fmt(sourceMeta.seconds)}{changeFace && chunkCount(sourceMeta.seconds) > 1 ? ` · processed in ${chunkCount(sourceMeta.seconds)} parts` : ""}</span>
                : <span className="text-sm text-ink-muted">A video of one person talking to camera, up to 2 minutes and {MAX_SOURCE_BYTES / 1024 / 1024}MB</span>}
            </button>
          </section>

          <section className={`${cardClass} space-y-3 p-5`}>
            <h3 className="font-semibold">What do you want to change?</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {choiceCard(changeFace, () => setChangeFace(!changeFace), ScanFace, "New person", "Replace the performer with someone from a photo, keeping every expression and movement.")}
              {choiceCard(changeVoice, () => setChangeVoice(!changeVoice), Languages, "New language and voice", "Translate the speech, give it a new accent and voice, and sync the lips.")}
            </div>
          </section>

          {changeFace && (
            <section className={`${cardClass} space-y-4 p-5`}>
              <h3 className="font-semibold">New person</h3>
              <input ref={referenceRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onImage(setReference, setReferencePreview)} className="hidden" />
              <button onClick={() => referenceRef.current?.click()} className="flex w-full items-center gap-4 rounded-xl border border-dashed border-line-strong bg-canvas p-4 text-left transition-colors hover:border-accent/60">
                {referencePreview
                  ? <img src={referencePreview} alt="New person" className="h-16 w-16 rounded-lg object-cover" />
                  : <span className="grid h-16 w-16 place-items-center rounded-lg bg-white/[0.04] text-ink-subtle"><ImagePlus size={20} aria-hidden /></span>}
                <span className="text-sm text-ink-muted">{reference ? reference.name : "A clear, front-facing photo, framed like your video (head and shoulders or half body)."}</span>
              </button>

              <div>
                <p className="mb-2 text-sm font-medium text-ink">Background</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {bgOptions.map((o) => (
                    <button key={o.id} onClick={() => setBgMode(o.id)} aria-pressed={bgMode === o.id}
                      className={"rounded-lg border px-3 py-2 text-left transition-colors " + (bgMode === o.id ? "border-accent bg-accent/10" : "border-line hover:border-line-strong")}>
                      <span className="block text-sm text-ink">{o.label}</span>
                      <span className="block text-[11px] text-ink-subtle">{o.hint}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink-subtle">
                  {bgMode === "model" ? "The new person appears in the setting from their photo." : "We'll place the new person into this background before the swap."}
                </p>
              </div>

              {bgMode === "preset" && (
                <div className="flex flex-wrap gap-2">
                  {BACKGROUND_PRESETS.map((p) => (
                    <button key={p.id} onClick={() => setBgPreset(p.id)} className={"h-8 rounded-full border px-3 text-xs transition-colors " + (bgPreset === p.id ? "border-accent bg-accent/15 text-ink" : "border-line text-ink-muted hover:border-line-strong hover:text-ink")}>{p.label}</button>
                  ))}
                </div>
              )}
              {bgMode === "upload" && (
                <>
                  <input ref={bgRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onImage(setBgFile, setBgPreview)} className="hidden" />
                  <button onClick={() => bgRef.current?.click()} className="flex w-full items-center gap-4 rounded-xl border border-dashed border-line-strong bg-canvas p-4 text-left transition-colors hover:border-accent/60">
                    {bgPreview
                      ? <img src={bgPreview} alt="Background" className="h-16 w-24 rounded-lg object-cover" />
                      : <span className="grid h-16 w-24 place-items-center rounded-lg bg-white/[0.04] text-ink-subtle"><ImagePlus size={20} aria-hidden /></span>}
                    <span className="text-sm text-ink-muted">{bgFile ? bgFile.name : "Upload a background image"}</span>
                  </button>
                </>
              )}
              {bgMode === "describe" && (
                <Field label="Describe the background">
                  <Textarea rows={2} maxLength={400} value={bgDescription} onChange={(e) => setBgDescription(e.target.value)} placeholder="A cosy coffee shop with warm lights and wooden tables" />
                </Field>
              )}
            </section>
          )}

          {changeVoice && (
            <section className={`${cardClass} space-y-4 p-5`}>
              <h3 className="font-semibold">New language and voice</h3>
              <LanguageAccentSelector
                value={{ language: languageCode, accent }}
                onChange={(v) => { setLanguageCode(v.language); setAccent(v.accent); }}
                languageLabel="1. Language" accentLabel="2. Accent" allowEmpty
              />
              <Field label="3. Voice">
                <div className="inline-flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label="Voice">
                  {(["female", "male"] as const).map((g) => (
                    <button key={g} role="radio" aria-checked={gender === g} onClick={() => setGender(g)}
                      className={"h-8 rounded-md px-4 text-sm font-medium capitalize transition-colors " + (gender === g ? "bg-raised text-ink" : "text-ink-muted hover:text-ink")}>
                      {g}
                    </button>
                  ))}
                </div>
              </Field>
              <p className="text-xs text-ink-subtle">The speech is translated and adapted to sound natural, then lip-synced to the video.</p>
            </section>
          )}

          <label className={`${cardClass} flex cursor-pointer items-center justify-between gap-3 p-4`}>
            <span className="text-sm text-ink-muted">I have permission to use the likeness and voice of everyone in these files.</span>
            <Toggle checked={consent} onChange={() => setConsent(!consent)} label="Permission confirmed" />
          </label>

          {error && <Alert>{error}</Alert>}

          <div className={`${cardClass} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}>
            {rate
              ? <CostSummary cost={cost} ratePerMinute={rate} seconds={sourceMeta?.seconds ?? null} balance={tokenBalance} rateLabel={rateLabel} />
              : <p className="text-sm text-ink-muted">Choose what to change to see the cost · you have {tokenBalance}</p>}
            <Button variant="primary" size="lg" onClick={run} disabled={!sourceMeta || (!changeFace && !changeVoice)}>
              <ScanFace size={17} aria-hidden /> Swap
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
