"use client";
import type { SavedGeneration } from "../../lib/saved-generation";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowRight, Ban, CheckCircle2, ChevronLeft, Circle, Download, FileText, ImagePlus, Link2, Loader2, Package,
  Palette, Repeat2, Upload, UsersRound, type LucideIcon,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { chargeTokens, refundCharge, refundNote } from "../../lib/token-client";
import { perSecondCost } from "../../lib/duration-pricing";
import { trimVideo } from "../../lib/ffmpeg-client";
import CostSummary from "../../components/CostSummary";
import VideoTrimmer from "./VideoTrimmer";
import { VIDEO_MODELS, isModelVisible, savePendingGeneration, studioHref } from "../../components/catalog";
import { Alert, Badge, Button, Field, Input, Progress, Select, Textarea, Toggle, cardClass } from "../../components/ui";

type ModeId = "restyle" | "recreate" | "actor_swap" | "product_swap";
interface Mode {
  id: ModeId;
  title: string;
  tagline: string;
  desc: string;
  icon: LucideIcon;
  pricingKey: string;
  defaultRate: number;   // tokens per minute of source video
  toggle: string;
  maxSeconds: number;
  minSeconds: number;
  maxBytes: number;
  allowUrl: boolean;
  comingSoon?: boolean;
}

const MODES: Mode[] = [
  { id: "restyle", title: "Restyle", tagline: "Same motion, completely new look", desc: "Keeps the original movement and timing, and repaints everything in a style you describe.", icon: Palette,
    pricingKey: "video_remix_restyle", defaultRate: 80, toggle: "video_remix_restyle_enabled", maxSeconds: 30, minSeconds: 1, maxBytes: 200 * 1024 * 1024, allowUrl: true },
  { id: "recreate", title: "Recreate", tagline: "New video inspired by the same structure", desc: "AI transcribes the video, writes a new script with the same structure, and generates a fresh video.", icon: Repeat2,
    pricingKey: "video_remix_recreate", defaultRate: 60, toggle: "video_remix_recreate_enabled", maxSeconds: 180, minSeconds: 1, maxBytes: 25 * 1024 * 1024, allowUrl: false },
  { id: "actor_swap", title: "Actor Swap", tagline: "Put a different performer in the video", desc: "Transfers the original performance (expressions and movement) onto a new performer you upload.", icon: UsersRound,
    pricingKey: "video_remix_actor_swap", defaultRate: 50, toggle: "video_remix_actor_swap_enabled", maxSeconds: 30, minSeconds: 3, maxBytes: 200 * 1024 * 1024, allowUrl: true },
  { id: "product_swap", title: "Product Swap", tagline: "Keep everything, replace the product", desc: "Swap the product in a video for yours, frame by frame.", icon: Package,
    pricingKey: "video_remix_product_swap", defaultRate: 120, toggle: "", maxSeconds: 30, minSeconds: 1, maxBytes: 0, allowUrl: false, comingSoon: true },
];

const STYLE_PRESETS = ["Anime", "Claymation", "Neon cyberpunk", "Watercolor painting", "Vintage 16mm film", "3D animated film", "Comic book", "Golden hour cinematic"];
const MAX_WAIT_SECONDS = 600;
// Actor Swap uploads longer than Runway's 30s limit are trimmed in the browser
const RUNWAY_MAX_SECONDS = 30;
const TRIM_SOURCE_MAX_SECONDS = 600;

type Stage = "charging" | "trimming" | "uploading" | "transcribing" | "rewriting" | "placing" | "generating" | "restoring" | "saving";
interface RewriteResult {
  original: { hook: string; structure: string[]; style: string };
  title: string;
  script: string;
  scenes: { visual_prompt: string; voiceover: string }[];
  main_visual_prompt: string;
}

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

// ---------------------------------------------------------------- helpers

async function session() {
  return (await supabase.auth.getSession()).data.session;
}

async function authed(path: string, body: unknown) {
  const s = await session();
  if (!s) return { ok: false, data: { error: "Please sign in again." } as any };
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.access_token }, body: JSON.stringify(body) });
  let data: any = {};
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

async function extractFrames(file: File, duration: number): Promise<{ time: number; data_url: string }[]> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video");
    v.preload = "auto"; v.muted = true; v.playsInline = true; v.src = url;
    await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(); });
    const times = [0.5, 2, duration * 0.4, duration * 0.7].filter((t, i, a) => t < duration - 0.1 && a.indexOf(t) === i);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 512 / Math.max(v.videoWidth || 512, v.videoHeight || 512));
    canvas.width = Math.round((v.videoWidth || 512) * scale);
    canvas.height = Math.round((v.videoHeight || 512) * scale);
    const ctx = canvas.getContext("2d");
    const out: { time: number; data_url: string }[] = [];
    for (const t of times) {
      await new Promise<void>((res) => { const done = () => { v.removeEventListener("seeked", done); res(); }; v.addEventListener("seeked", done); v.currentTime = t; setTimeout(done, 3000); });
      if (ctx) { ctx.drawImage(v, 0, 0, canvas.width, canvas.height); out.push({ time: t, data_url: canvas.toDataURL("image/jpeg", 0.72) }); }
    }
    return out;
  } catch {
    return [];
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function upload(file: File): Promise<string | null> {
  const s = await session();
  if (!s) return null;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `video-remix/${s.user.id}-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
  const { error } = await supabase.storage.from("generation-inputs").upload(path, file, { contentType: file.type || undefined });
  if (error) { console.error("Upload error:", error); return null; }
  return supabase.storage.from("generation-inputs").getPublicUrl(path).data.publicUrl;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const actRatio = (w: number, h: number) => (w > h * 1.2 ? "1280:720" : h > w * 1.2 ? "720:1280" : "960:960");
const aspectFromDims = (w: number, h: number) => (w > h * 1.2 ? "16:9" : h > w * 1.2 ? "9:16" : "1:1");

// ---------------------------------------------------------------- component

export default function VideoRemix({ tokenBalance, setTokenBalance, tokenPricing, enabledKeys, settingsLoaded, onBack, onBusyChange, onSaved }: Props) {
  const t = useTranslations("remix");
  const c = useTranslations("common");
  const router = useRouter();
  const modeText = (m: Mode, field: "title" | "tagline" | "desc") => t(`modes.${m.id}.${field}`);
  const trimMessage = t("trimMessage");
  const [modeId, setModeId] = useState<ModeId | null>(null);

  // Source
  const [sourceKind, setSourceKind] = useState<"upload" | "url">("upload");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceMeta, setSourceMeta] = useState<{ seconds: number; width: number; height: number } | null>(null);
  const [probing, setProbing] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimProgress, setTrimProgress] = useState(0);

  // Mode options
  const [style, setStyle] = useState("");
  const [topic, setTopic] = useState("");
  const [model, setModel] = useState("kling-v3-std");
  const [duration, setDuration] = useState("5");
  const [performer, setPerformer] = useState<File | null>(null);
  const [performerPreview, setPerformerPreview] = useState("");
  const [bodyControl, setBodyControl] = useState(true);
  const [intensity, setIntensity] = useState(3);
  const [preserveBg, setPreserveBg] = useState(true);
  const [notice, setNotice] = useState("");

  // Run state
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<Stage>("charging");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url: string; cost: number } | null>(null);
  const [rewrite, setRewrite] = useState<RewriteResult | null>(null);
  const [runwayTask, setRunwayTask] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const chargeRef = useRef<string | null>(null);

  const sourceRef = useRef<HTMLInputElement>(null);
  const performerRef = useRef<HTMLInputElement>(null);

  const mode = MODES.find((m) => m.id === modeId) ?? null;
  const moduleOn = enabledKeys["video_remix_enabled"] === true;
  const modeAvailable = (m: Mode) => !m.comingSoon && moduleOn && enabledKeys[m.toggle] === true;
  const models = VIDEO_MODELS.filter((m) => isModelVisible(m, enabledKeys) && m.provider !== "higgsfield");
  const activeModel = models.some((m) => m.id === model) ? model : (models[0]?.id ?? model);
  const modelInfo = VIDEO_MODELS.find((m) => m.id === activeModel);

  const baseRate = mode ? (tokenPricing[mode.pricingKey] ?? mode.defaultRate) : 0;
  // Actor Swap can keep the source's background: needs an uploaded video and a performer photo
  const bgRate = tokenPricing["video_remix_bg_preserve"] ?? 20;
  const bgAvailable = mode?.id === "actor_swap" && enabledKeys["remix_bg_preserve_enabled"] === true;
  const bgEligible = bgAvailable && sourceKind === "upload" && (!performer || performer.type.startsWith("image/"));
  const bgOn = bgEligible && preserveBg;
  const rate = baseRate + (bgOn ? bgRate : 0);
  const needsTrim = mode?.id === "actor_swap" && sourceKind === "upload" && !!sourceMeta && sourceMeta.seconds > RUNWAY_MAX_SECONDS + 0.5;
  const billedSeconds = sourceMeta ? (needsTrim ? RUNWAY_MAX_SECONDS : sourceMeta.seconds) : null;
  // Runway modes bill per second (15s minimum); Recreate keeps a one-minute minimum
  const perSecond = mode?.id === "restyle" || mode?.id === "actor_swap";
  const cost = perSecond
    ? perSecondCost(rate, billedSeconds ?? 0)
    : sourceMeta && mode ? Math.max(rate, Math.ceil((sourceMeta.seconds / 60) * rate)) : rate;

  useEffect(() => { onBusyChange(running); }, [running, onBusyChange]);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const resetSource = () => { setSourceFile(null); setSourceUrl(""); setSourceMeta(null); setTrimStart(0); };
  const pickMode = (id: ModeId) => { setModeId(id); setError(""); setResult(null); setRewrite(null); setSourceKind("upload"); resetSource(); };

  const validateDuration = (seconds: number, kind: "upload" | "url" = sourceKind) => {
    if (!mode) return "";
    if (mode.id === "actor_swap" && kind === "upload") {
      if (seconds > TRIM_SOURCE_MAX_SECONDS + 0.5) return t("errors.trimSourceTooLong", { minutes: TRIM_SOURCE_MAX_SECONDS / 60 });
    } else if (mode.id === "actor_swap" && seconds > mode.maxSeconds + 0.5) {
      return `${trimMessage} ${t("errors.linkTooLong", { seconds: Math.round(seconds) })}`;
    } else if (seconds > mode.maxSeconds + 0.5) return t("errors.tooLong", { mode: modeText(mode, "title"), max: mode.maxSeconds, seconds: Math.round(seconds) });
    if (seconds < mode.minSeconds) return t("errors.tooShort", { mode: modeText(mode, "title"), min: mode.minSeconds });
    return "";
  };

  // ---- source input ----
  const onSourceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !mode) return;
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    const allowed = mode.id === "recreate" ? ["mp4", "webm"] : ["mp4", "mov", "webm"];
    if (!allowed.includes(ext)) { setError(mode.id === "recreate" ? t("errors.formatRecreate") : t("errors.format")); return; }
    if (f.size > mode.maxBytes) { setError(t("errors.videoTooBig", { mb: Math.round(mode.maxBytes / 1024 / 1024) })); return; }
    const url = URL.createObjectURL(f);
    try {
      const meta = await probeVideo(url);
      const problem = validateDuration(meta.seconds, "upload");
      if (problem) { setError(problem); return; }
      setSourceFile(f); setSourceMeta(meta); setTrimStart(0); setError("");
    } catch {
      setError(t("errors.unreadable"));
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const checkSourceUrl = async () => {
    const url = sourceUrl.trim();
    if (!/^https:\/\/.+/i.test(url)) { setError(t("errors.badLink")); return; }
    setProbing(true); setError("");
    try {
      const meta = await probeVideo(url);
      const problem = validateDuration(meta.seconds, "url");
      if (problem) { setError(problem); setSourceMeta(null); return; }
      setSourceMeta(meta);
    } catch {
      setError(t("errors.linkLoad"));
      setSourceMeta(null);
    } finally {
      setProbing(false);
    }
  };

  const onPerformer = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const isImage = f.type.startsWith("image/");
    const isVideo = f.type.startsWith("video/");
    if (!isImage && !isVideo) { setError(t("errors.performerType")); return; }
    if (f.size > (isImage ? 10 : 100) * 1024 * 1024) { setError(isImage ? t("errors.photoSize") : t("errors.videoSize")); return; }
    if (isVideo) {
      const url = URL.createObjectURL(f);
      try {
        const meta = await probeVideo(url);
        if (meta.seconds > 30.5) { setError(t("errors.performerLength")); return; }
      } catch { setError(t("errors.unreadableThat")); return; }
      finally { URL.revokeObjectURL(url); }
      setPerformerPreview("");
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => setPerformerPreview(String(ev.target?.result ?? ""));
      reader.readAsDataURL(f);
    }
    setPerformer(f); setError("");
  };

  // ---- polling (stops early on cancel) ----
  const poll = (taskId: string, provider: string): Promise<{ url: string | null; reason: string }> =>
    new Promise((resolve) => {
      const started = Date.now();
      const timer = setInterval(async () => {
        if (cancelRef.current) { clearInterval(timer); resolve({ url: null, reason: t("errors.cancelled") }); return; }
        if (Date.now() - started > MAX_WAIT_SECONDS * 1000) { clearInterval(timer); resolve({ url: null, reason: t("errors.timeout") }); return; }
        try {
          const res = await fetch(`/api/video-status?task_id=${encodeURIComponent(taskId)}&provider=${provider}`);
          const sd = await res.json();
          if (sd.completed && sd.video_url) { clearInterval(timer); resolve({ url: sd.video_url, reason: "" }); }
          else if (sd.failed) { clearInterval(timer); resolve({ url: null, reason: sd.fail_reason ?? t("errors.generationFailed") }); }
        } catch { /* keep polling */ }
      }, provider === "runway" ? 6000 : 5000);
    });

  const cancel = async () => {
    cancelRef.current = true;
    if (runwayTask) await authed("/api/video-remix", { action: "cancel", task_id: runwayTask, charge_id: chargeRef.current });
  };

  // ---- run ----
  const run = async () => {
    if (!mode || !modeAvailable(mode)) return;
    const hasSource = sourceKind === "upload" ? !!sourceFile : !!sourceMeta;
    if (!hasSource || !sourceMeta) { setError(sourceKind === "url" ? t("errors.checkLink") : t("errors.uploadSource")); return; }
    if (mode.id === "restyle" && !style.trim()) { setError(t("errors.describeStyle")); return; }
    if (mode.id === "actor_swap" && !performer) { setError(t("errors.uploadPerformer")); return; }
    if (tokenBalance < cost) { setError(t("errors.notEnough", { cost, balance: tokenBalance })); return; }

    const s = await session();
    if (!s) { setError(t("errors.signIn")); return; }

    cancelRef.current = false;
    setError(""); setNotice(""); setResult(null); setRewrite(null); setRunwayTask(null); setElapsed(0); setRunning(true); setStage("charging");
    const amount = cost;
    chargeRef.current = null;

    const fail = async (message: string) => {
      const r = await refundCharge(chargeRef.current);
      if (r.balance !== undefined) setTokenBalance(() => r.balance!);
      setError(message + refundNote(r));
      setRunning(false);
    };

    try {
      // 1. Deduct tokens before any processing (creates the charge this job is tied to)
      const charge = await chargeTokens(amount, `video_remix_${mode.id}`);
      if (!charge.ok) { setError(charge.error); setRunning(false); return; }
      chargeRef.current = charge.chargeId;
      const chargeId = charge.chargeId;
      setTokenBalance(() => charge.balance);

      // 2. Source into our storage (or use the pasted link for Runway modes)
      // Long Actor Swap uploads: cut the chosen 30 seconds in the browser first
      let uploadFile = sourceFile;
      if (needsTrim && sourceFile) {
        setStage("trimming"); setTrimProgress(0);
        try {
          const clip = await trimVideo(sourceFile, trimStart, RUNWAY_MAX_SECONDS, setTrimProgress);
          uploadFile = new File([clip], "clip.mp4", { type: "video/mp4" });
        } catch (e) {
          console.error("Trim error:", e);
          await fail(t("errors.trimFailed"));
          return;
        }
        if (cancelRef.current) { await fail(t("errors.cancelled")); return; }
      }

      setStage("uploading");
      let videoUrl = sourceUrl.trim();
      if (sourceKind === "upload" && uploadFile) {
        const up = await upload(uploadFile);
        if (!up) { await fail(t("errors.uploadFailed")); return; }
        videoUrl = up;
      }
      if (cancelRef.current) { await fail(t("errors.cancelled")); return; }

      let start: { task_id?: string; provider?: string; error?: string } = {};
      let savedPrompt = "";
      let preservedBg = false;
      let bgRefund = 0;
      const aspect = aspectFromDims(sourceMeta.width, sourceMeta.height);

      if (mode.id === "restyle") {
        setStage("generating");
        savedPrompt = style.trim();
        const r = await authed("/api/video-remix", { action: "restyle", video_url: videoUrl, prompt: savedPrompt, duration: billedSeconds, charge_id: chargeId });
        if (!r.ok) { await fail(r.data.error ?? t("errors.restyleStart")); return; }
        start = r.data;
        setRunwayTask(r.data.task_id);
      } else if (mode.id === "actor_swap") {
        const performerUrl = await upload(performer!);
        if (!performerUrl) { await fail(t("errors.performerUpload")); return; }
        // Last point a cancel can still refund in full (placing can't be stopped)
        if (cancelRef.current) { await fail(t("errors.cancelled")); return; }
        savedPrompt = "Actor swap";
        const swapBody = {
          video_url: videoUrl, character_url: performerUrl, charge_id: chargeId, duration: billedSeconds,
          character_type: performer!.type.startsWith("video/") ? "video" : "image",
          ratio: actRatio(sourceMeta.width, sourceMeta.height), body_control: bodyControl, expression_intensity: intensity,
          width: sourceMeta.width, height: sourceMeta.height,
        };
        setStage(bgOn ? "placing" : "generating");
        let r = await authed("/api/video-remix", { action: "actor_swap", ...swapBody, preserve_background: bgOn });
        if (!r.ok) { await fail(r.data.error ?? t("errors.swapStart")); return; }
        // Original background: the performer is first placed into the video's own opening frame
        if (r.data.stage === "placing") {
          const placed = await poll(r.data.task_id, "kie");
          if (cancelRef.current) { await fail(t("errors.cancelled")); return; }
          r = await authed("/api/video-remix", { action: "actor_swap_start", ...swapBody, task_id: r.data.task_id, bg_price: r.data.bg_price, preserve_background: !!placed.url });
          if (!r.ok) { await fail(r.data.error ?? t("errors.swapStart")); return; }
        }
        if (bgOn && r.data.preserved === false) {
          if (r.data.bg_refunded > 0) { bgRefund = r.data.bg_refunded; setTokenBalance((b) => b + r.data.bg_refunded); }
          setNotice(t("bgFallback"));
        }
        preservedBg = r.data.preserved === true;
        setStage("generating");
        start = r.data;
        setRunwayTask(r.data.task_id);
      } else {
        // Recreate: transcribe → rewrite → generate with the chosen model
        setStage("transcribing");
        const frames = sourceFile ? await extractFrames(sourceFile, sourceMeta.seconds) : [];
        const tr = await authed("/api/video-remix", { action: "transcribe", video_url: videoUrl, charge_id: chargeId });
        if (!tr.ok) { await fail(tr.data.error ?? t("errors.transcription")); return; }
        if (cancelRef.current) { await fail(t("errors.cancelled")); return; }

        setStage("rewriting");
        const rw = await authed("/api/video-remix", {
          action: "rewrite", charge_id: chargeId, transcript: tr.data.text, segments: tr.data.segments, frames, duration: sourceMeta.seconds, topic,
        });
        if (!rw.ok) { await fail(rw.data.error ?? t("errors.rewrite")); return; }
        const rewritten: RewriteResult = rw.data.result;
        setRewrite(rewritten);
        if (cancelRef.current) { await fail(t("errors.cancelled")); return; }

        setStage("generating");
        const line = rewritten.scenes?.[0]?.voiceover?.trim();
        savedPrompt = modelInfo?.hasSound && line ? `${rewritten.main_visual_prompt} The narrator says: "${line}"` : rewritten.main_visual_prompt;
        const res = await fetch("/api/generate-video", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: savedPrompt, mode: "text_to_video", duration, aspect_ratio: aspect, model: activeModel, with_audio: modelInfo?.hasSound === true, charge_id: chargeId }),
        });
        start = await res.json();
        if (!res.ok || !start.task_id) { await fail(start.error ?? t("errors.genStart")); return; }
      }

      const outcome = await poll(start.task_id!, start.provider ?? "kie");
      setRunwayTask(null);
      if (!outcome.url) { await fail(outcome.reason); return; }
      let finalUrl: string = outcome.url;

      // Put the source's real, moving background back behind the new performer.
      // If that can't finish, the swap already kept the setting from the opening frame.
      if (preservedBg && sourceKind === "upload") {
        setStage("restoring");
        let bgState: Record<string, unknown> = {};
        for (let i = 0; i < 120; i++) {
          const rs = await authed("/api/video-remix", { action: "bg_restore", charge_id: chargeId, video_url: videoUrl, result_url: outcome.url, bg_state: bgState });
          if (!rs.ok) break;
          if (rs.data.done) { if (rs.data.url) finalUrl = rs.data.url; break; }
          bgState = rs.data.bg_state ?? bgState;
          await new Promise((res) => setTimeout(res, 6000));
        }
      }

      // 3. Save to the gallery
      setStage("saving");
      const save = await authed("/api/generations", {
        type: "video_remix",
        prompt: savedPrompt,
        video_url: finalUrl,
        output_type: "video",
        status: "completed",
        tokens_used: amount - bgRefund,
        duration: String(mode.id === "recreate" ? duration : Math.round(billedSeconds ?? sourceMeta.seconds)),
        aspect_ratio: aspect,
        model: `Video Remix - ${mode.title}`,
        settings: { mode: mode.id },
        charge_id: chargeId,
        provider: start.provider ?? null,
      });
      if (!save.ok) console.error("Gallery save failed:", save.data.error);
      else if (save.data.generation?.id != null) onSaved?.({ id: save.data.generation.id, url: finalUrl, outputType: "video" });
      setResult({ url: finalUrl, cost: amount - bgRefund });
      setRunning(false);
    } catch (e) {
      console.error("Video remix error:", e);
      await fail(t("errors.generic"));
    }
  };

  const download = async (url: string) => {
    try {
      const b = await (await fetch(url)).blob();
      const href = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = href; a.download = `klipflowai-remix-${Date.now()}.mp4`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(href);
    } catch { window.open(url, "_blank"); }
  };

  const openInScriptToVideo = () => {
    if (!rewrite) return;
    savePendingGeneration({ module: "script_to_video", prompt: rewrite.script, aspect_ratio: sourceMeta ? aspectFromDims(sourceMeta.width, sourceMeta.height) : undefined });
    router.push(studioHref("script_to_video"));
  };

  // ---------------------------------------------------------------- render

  const stepsFor: Record<string, { key: Stage; label: string }[]> = {
    restyle: [
      { key: "charging", label: t("steps.reserved") }, { key: "uploading", label: t("steps.uploading") },
      { key: "generating", label: t("steps.restyling") }, { key: "saving", label: t("steps.saving") },
    ],
    recreate: [
      { key: "charging", label: t("steps.reserved") }, { key: "uploading", label: t("steps.uploading") },
      { key: "transcribing", label: t("steps.transcribing") }, { key: "rewriting", label: t("steps.rewriting") },
      { key: "generating", label: t("steps.generating") }, { key: "saving", label: t("steps.saving") },
    ],
    actor_swap: [
      { key: "charging", label: t("steps.reserved") },
      ...(needsTrim ? [{ key: "trimming" as Stage, label: stage === "trimming" ? t("steps.trimmingProgress", { percent: Math.round(trimProgress * 100) }) : t("steps.trimming") }] : []),
      { key: "uploading", label: t("steps.uploadingBoth") },
      ...(bgOn ? [{ key: "placing" as Stage, label: t("steps.placing") }] : []),
      { key: "generating", label: t("steps.transferring") },
      ...(bgOn ? [{ key: "restoring" as Stage, label: t("steps.restoring") }] : []),
      { key: "saving", label: t("steps.saving") },
    ],
  };
  const steps = mode ? stepsFor[mode.id] ?? [] : [];
  const stepIndex = steps.findIndex((s) => s.key === stage);
  const progress = result ? 100 : stage === "generating" ? Math.min(92, 35 + (elapsed / 240) * 57) : Math.max(5, (stepIndex / Math.max(steps.length, 1)) * 60);

  const header = (
    <div className="flex items-center gap-2">
      {!running && (
        <button onClick={mode && !result ? () => { setModeId(null); setError(""); } : onBack}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-raised ps-2 pe-3 text-sm text-ink transition-colors hover:border-line-strong">
          <ChevronLeft size={16} className="rtl:-scale-x-100" aria-hidden /> {mode && !result ? t("modesBack") : c("allTools")}
        </button>
      )}
      <h2 className="text-base font-semibold">{t("title")}{mode ? ` · ${modeText(mode, "title")}` : ""}</h2>
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

  // Mode picker
  if (!mode) {
    return (
      <div className="space-y-4">
        {header}
        <p className="text-sm text-ink-muted">{t("intro")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODES.map((m) => {
            const Icon = m.icon;
            const available = modeAvailable(m);
            const r = tokenPricing[m.pricingKey] ?? m.defaultRate;
            return (
              <button key={m.id} onClick={() => available && pickMode(m.id)} disabled={!available}
                className={"rounded-2xl border p-5 text-start transition-colors " + (available ? "border-line bg-surface hover:border-line-strong hover:bg-raised" : "cursor-not-allowed border-line bg-surface opacity-60")}>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent-text"><Icon size={20} aria-hidden /></span>
                  {m.comingSoon ? <Badge tone="signal">{t("comingSoon")}</Badge> : !available ? <Badge>{t("unavailableMode")}</Badge> : <Badge>{t("perMin", { count: r })}</Badge>}
                </div>
                <p className="text-[15px] font-semibold text-ink">{modeText(m, "title")}</p>
                <p className="text-sm text-accent-text">{modeText(m, "tagline")}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{modeText(m, "desc")}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}

      {/* RESULT */}
      {result && (
        <div className="space-y-4">
          <section className={`${cardClass} space-y-4 p-5`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-400" aria-hidden />
              <h3 className="font-semibold">{t("ready")}</h3>
              <Badge>{c("tokens", { count: result.cost })}</Badge>
            </div>
            <video src={result.url} controls playsInline className="max-h-[70vh] w-full rounded-xl border border-line bg-black" />
            <div className="grid grid-cols-2 gap-3">
              <Button variant="primary" onClick={() => download(result.url)}><Download size={16} aria-hidden /> {t("saveVideo")}</Button>
              <Button variant="secondary" onClick={() => { setResult(null); setRewrite(null); resetSource(); }}>{t("another")}</Button>
            </div>
            {notice && <Alert tone="warning">{notice}</Alert>}
            <p className="text-xs text-ink-subtle">{t("saved")}</p>
          </section>
          {rewrite && (
            <section className={`${cardClass} space-y-3 p-5`}>
              <div className="flex items-center gap-2"><FileText size={17} className="text-accent-text" aria-hidden /><h3 className="font-semibold">{rewrite.title}</h3></div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">{rewrite.script}</p>
              <Button variant="secondary" onClick={openInScriptToVideo}>{t("toMultiScene")} <ArrowRight size={16} className="rtl:-scale-x-100" aria-hidden /></Button>
            </section>
          )}
        </div>
      )}

      {/* PROGRESS */}
      {running && (
        <section className={`${cardClass} space-y-5 p-6`}>
          <div className="text-center">
            <h3 className="font-semibold">{t("remixing")}</h3>
            <p className="mt-1 text-sm text-ink-muted">{t("progressLine", { mode: modeText(mode, "title"), time: fmt(elapsed) })}</p>
          </div>
          <Progress value={progress} />
          <ul className="space-y-2">
            {steps.map((st, i) => {
              const done = i < stepIndex;
              const active = i === stepIndex;
              return (
                <li key={st.key} className="flex items-center gap-2 text-sm">
                  {done ? <CheckCircle2 size={16} className="text-emerald-400" aria-hidden />
                    : active ? <Loader2 size={16} className="animate-spin text-accent-text" aria-hidden />
                    : <Circle size={16} className="text-ink-subtle" aria-hidden />}
                  <span className={done || active ? "text-ink" : "text-ink-subtle"}>{st.label}</span>
                </li>
              );
            })}
          </ul>
          {rewrite && mode.id === "recreate" && (
            <div className="rounded-xl border border-line bg-canvas p-4">
              <p className="mb-1 text-xs font-medium text-ink-subtle">{t("newScript")}</p>
              <p className="line-clamp-4 text-sm text-ink-muted">{rewrite.script}</p>
            </div>
          )}
          {/* Cancel only where it actually stops the work: before generation, or a Runway task */}
          {(runwayTask || ["charging", "trimming", "uploading", "transcribing", "rewriting"].includes(stage)) && (
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" onClick={cancel}><Ban size={15} aria-hidden /> {t("cancelRefund")}</Button>
            </div>
          )}
        </section>
      )}

      {/* FORM */}
      {!running && !result && (
        <div className="space-y-4">
          <section className={`${cardClass} space-y-4 p-5`}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">{t("source")}</h3>
              {mode.allowUrl && (
                <div className="inline-flex rounded-lg border border-line p-0.5" role="tablist">
                  {(["upload", "url"] as const).map((k) => (
                    <button key={k} role="tab" aria-selected={sourceKind === k} onClick={() => { setSourceKind(k); resetSource(); setError(""); }}
                      className={"h-8 rounded-md px-3 text-xs font-medium transition-colors " + (sourceKind === k ? "bg-raised text-ink" : "text-ink-muted hover:text-ink")}>
                      {k === "upload" ? t("upload") : t("pasteLink")}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {sourceKind === "upload" ? (
              <>
                <input ref={sourceRef} type="file" accept={mode.id === "recreate" ? "video/mp4,video/webm,.mp4,.webm" : "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"} onChange={onSourceFile} className="hidden" />
                <button onClick={() => sourceRef.current?.click()} className="flex w-full flex-col items-center rounded-xl border border-dashed border-line-strong bg-canvas px-6 py-8 text-center transition-colors hover:border-accent/60">
                  <Upload size={20} className="mb-2 text-ink-subtle" aria-hidden />
                  {sourceFile && sourceMeta
                    ? <span className="text-sm font-medium text-ink">{sourceFile.name} · {fmt(sourceMeta.seconds)}</span>
                    : <span className="text-sm text-ink-muted">{mode.id === "actor_swap"
                        ? t("uploadHintTrim", { mb: Math.round(mode.maxBytes / 1024 / 1024) })
                        : mode.maxSeconds >= 60 ? t("uploadHintMinutes", { minutes: mode.maxSeconds / 60, mb: Math.round(mode.maxBytes / 1024 / 1024) }) : t("uploadHintSeconds", { seconds: mode.maxSeconds, mb: Math.round(mode.maxBytes / 1024 / 1024) })}</span>}
                </button>
                {needsTrim && sourceFile && sourceMeta && (
                  <VideoTrimmer file={sourceFile} duration={sourceMeta.seconds} windowSeconds={RUNWAY_MAX_SECONDS} start={trimStart} onChange={setTrimStart} message={trimMessage} />
                )}
              </>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input type="url" value={sourceUrl} onChange={(e) => { setSourceUrl(e.target.value); setSourceMeta(null); }} placeholder="https://example.com/video.mp4" aria-label={t("videoLink")} />
                <Button variant="secondary" onClick={checkSourceUrl} disabled={probing || !sourceUrl.trim()}>
                  {probing ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Link2 size={16} aria-hidden />} {sourceMeta ? t("loaded", { time: fmt(sourceMeta.seconds) }) : t("checkLink")}
                </Button>
              </div>
            )}
          </section>

          {mode.id === "restyle" && (
            <section className={`${cardClass} space-y-4 p-5`}>
              <h3 className="font-semibold">{t("newStyle")}</h3>
              <div className="flex flex-wrap gap-2">
                {STYLE_PRESETS.map((p, i) => (
                  <button key={p} onClick={() => setStyle(p)} className={"h-8 rounded-full border px-3 text-xs transition-colors " + (style === p ? "border-accent bg-accent/15 text-ink" : "border-line text-ink-muted hover:border-line-strong hover:text-ink")}>{t(`stylePresets.${i}`)}</button>
                ))}
              </div>
              <Field label={t("describeLook")} hint={t("describeLookHint")}>
                <Textarea rows={3} value={style} onChange={(e) => setStyle(e.target.value)} placeholder={t("lookPlaceholder")} />
              </Field>
            </section>
          )}

          {mode.id === "recreate" && (
            <section className={`${cardClass} space-y-4 p-5`}>
              <h3 className="font-semibold">{t("yourVersion")}</h3>
              <Field label={t("topic")} hint={t("topicHint")}>
                <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t("topicPlaceholder")} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("videoModel")}>
                  <Select value={activeModel} onChange={(e) => setModel(e.target.value)}>
                    {models.map((m) => <option key={m.id} value={m.id}>{m.name}{m.hasSound ? ` · ${t("audio")}` : ""}</option>)}
                  </Select>
                </Field>
                <Field label={t("clipLength")}>
                  <Select value={duration} onChange={(e) => setDuration(e.target.value)}>
                    <option value="5">{t("sec5")}</option>
                    <option value="10">{t("sec10")}</option>
                  </Select>
                </Field>
              </div>
              <p className="text-xs text-ink-subtle">{t("recreateNote")}</p>
            </section>
          )}

          {mode.id === "actor_swap" && (
            <section className={`${cardClass} space-y-4 p-5`}>
              <h3 className="font-semibold">{t("newPerformer")}</h3>
              <input ref={performerRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" onChange={onPerformer} className="hidden" />
              <button onClick={() => performerRef.current?.click()} className="flex w-full items-center gap-4 rounded-xl border border-dashed border-line-strong bg-canvas p-4 text-start transition-colors hover:border-accent/60">
                {performerPreview
                  ? <img src={performerPreview} alt={t("newPerformer")} className="h-16 w-16 rounded-lg object-cover" />
                  : <span className="grid h-16 w-16 place-items-center rounded-lg bg-white/[0.04] text-ink-subtle"><ImagePlus size={20} aria-hidden /></span>}
                <span className="text-sm text-ink-muted">{performer ? performer.name : t("performerHint")}</span>
              </button>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas p-3.5">
                <div>
                  <p className="text-sm font-medium">{t("bodyMovement")}</p>
                  <p className="text-xs text-ink-subtle">{t("bodyMovementDesc")}</p>
                </div>
                <Toggle checked={bodyControl} onChange={() => setBodyControl(!bodyControl)} label={t("bodyMovement")} />
              </div>
              <Field label={t("intensity", { value: intensity })}>
                <input type="range" min={1} max={5} step={1} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} className="w-full accent-[var(--kf-accent)]" aria-label={t("intensityAria")} />
              </Field>
              {bgAvailable && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas p-3.5">
                  <div>
                    <p className="text-sm font-medium">{t("bgPreserve")}</p>
                    <p className="text-xs text-ink-subtle">{bgEligible ? t("bgPreserveDesc", { rate: bgRate }) : t("bgPreserveNeeds")}</p>
                  </div>
                  <Toggle checked={bgOn} onChange={() => bgEligible && setPreserveBg(!preserveBg)} label={t("bgPreserve")} />
                </div>
              )}
              <p className="text-xs text-ink-subtle">{bgOn ? t("performerNoteKept") : t("performerNote")}</p>
            </section>
          )}

          {error && <Alert>{error}</Alert>}

          <div className={`${cardClass} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}>
            {perSecond ? (
              <div className="space-y-1">
                <CostSummary cost={cost} ratePerMinute={rate} seconds={billedSeconds} balance={tokenBalance} rateLabel={needsTrim ? t("selected30") : undefined} />
                {bgOn && <p className="text-xs text-ink-subtle">{t("bgBreakdown", { swap: baseRate, bg: bgRate })}</p>}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">
                {t.rich("costLine", { cost, strong: (chunks) => <span className="font-semibold text-ink">{chunks}</span> })}
                <span className="text-ink-subtle"> · {sourceMeta ? t("costDetailVideo", { rate, time: fmt(sourceMeta.seconds), balance: tokenBalance }) : t("costDetailMin", { rate, balance: tokenBalance })}</span>
              </p>
            )}
            <Button variant="primary" size="lg" onClick={run} disabled={!sourceMeta}>
              <Repeat2 size={17} aria-hidden /> {t("submit")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
