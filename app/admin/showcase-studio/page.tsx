"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Coins, ExternalLink, ImagePlus, Loader2, RefreshCw, Sparkles, Star, Upload, WandSparkles } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { SHOWCASE_CATEGORIES, VIDEO_MODELS, isModelVisible } from "../../components/catalog";
import { Alert, Badge, Button, Field, Input, PageHeader, Progress, Select, Textarea, Toggle, cardClass } from "../../components/ui";
import LanguageAccentSelector, { DEFAULT_LANGUAGE, type LanguageChoice } from "../../components/LanguageAccentSelector";
import PromptTranslateBanner from "../../components/PromptTranslateBanner";
import { setChargePool } from "../../lib/token-client";
import type { SavedGeneration } from "../../lib/saved-generation";
import VideoRemix from "../../dashboard/studio/VideoRemix";
import ActorSwap from "../../dashboard/studio/ActorSwap";
import SeriesCloner from "../../dashboard/studio/SeriesCloner";
import FacelessReels from "../../dashboard/studio/FacelessReels";

// video / image / translate run here; "module" hosts the real Studio module
// (its own inputs and pipeline) billed to the showcase balance; "soon" isn't built.
type Pipeline = "video" | "image" | "translate" | "module" | "soon";
interface ShowcaseFeature {
  id: string;
  label: string;
  pipeline: Pipeline;
  type: string;            // generations.type saved for the result ("Try it" maps it back to a Studio module)
  category: string;        // default showcase category
  input?: "image" | "image-optional";
  imageLabel?: string;     // what the image upload is for
  audioOnly?: boolean;     // restrict to models with native audio
  textModule?: boolean;    // prompt-only: offers "Suggest 3 prompts"
}

const FEATURES: ShowcaseFeature[] = [
  // Text modules: a prompt is the whole input
  { id: "text_to_video",    label: "Text to Video",       pipeline: "video",     type: "text_to_video",     category: "cinematic", textModule: true },
  { id: "ai_actor",         label: "AI Actor",            pipeline: "video",     type: "ai_actor",          category: "ugc", textModule: true },
  { id: "voice",            label: "Voice Generation",    pipeline: "video",     type: "voice",             category: "faceless", audioOnly: true, textModule: true },
  { id: "prompt",           label: "Prompt Expander",     pipeline: "video",     type: "text_to_video",     category: "cinematic", textModule: true },
  { id: "script",           label: "Script Writer",       pipeline: "video",     type: "text_to_video",     category: "faceless", textModule: true },
  // Image input modules
  { id: "image_to_video",   label: "Image to Video",      pipeline: "video",     type: "image_to_video",    category: "cinematic", input: "image", imageLabel: "Source image" },
  { id: "ugc_ad",           label: "UGC Creator",         pipeline: "video",     type: "ugc_ad",            category: "ugc", input: "image-optional", imageLabel: "Product or reference image" },
  { id: "image_ad",         label: "Image Ad",            pipeline: "image",     type: "image_ad",          category: "image", input: "image-optional", imageLabel: "Product image" },
  // Video input modules
  { id: "video_translator", label: "AI Video Translator", pipeline: "translate", type: "video_translation", category: "translation" },
  { id: "video_remix",      label: "Video Remix",         pipeline: "module",    type: "video_remix",       category: "cinematic" },
  { id: "actor_swap",       label: "AI Actor Swap",       pipeline: "module",    type: "ai_actor_swap",     category: "ugc" },
  { id: "series_cloner",    label: "Series Cloner",       pipeline: "module",    type: "series_cloner",     category: "faceless" },
  { id: "faceless_reels",   label: "Faceless Reels",      pipeline: "module",    type: "faceless_reels",    category: "faceless" },
  // Mixed
  { id: "ai_music_studio",  label: "AI Music Studio (coming soon)", pipeline: "soon", type: "ai_music_studio", category: "faceless" },
];

// Image Ad target platforms → the image shape that platform shows best
const AD_PLATFORMS = [
  { id: "instagram_feed",  label: "Instagram feed",          aspect: "1:1" },
  { id: "instagram_story", label: "Instagram Story / Reels", aspect: "9:16" },
  { id: "tiktok",          label: "TikTok",                  aspect: "9:16" },
  { id: "facebook",        label: "Facebook feed",           aspect: "1:1" },
  { id: "youtube",         label: "YouTube",                 aspect: "16:9" },
  { id: "pinterest",       label: "Pinterest",               aspect: "9:16" },
] as const;

const TRANSLATE_LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Italian", "Japanese", "Chinese", "Arabic", "Hindi", "Bulgarian", "Dutch", "Polish", "Korean", "Turkish", "Russian"];
const MAX_SECONDS = 600; // 10 minute timeout
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_BYTES = 500 * 1024 * 1024;

type Step = "idle" | "working" | "done";
type Stage = "charging" | "uploading" | "generating" | "saving";
interface Suggestion { title: string; prompt: string }
interface Result { url: string; outputType: "video" | "image"; generationId: number | string | null; sourceImage: string | null }

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token } : null;
}

function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(isFinite(video.duration) && video.duration > 0 ? video.duration : null); };
    video.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    video.src = url;
  });
}

export default function ShowcaseStudio() {
  // Admin balance
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceDraft, setBalanceDraft] = useState("");
  const [editingBalance, setEditingBalance] = useState(false);
  const [promptProvider, setPromptProvider] = useState<string | null>("claude");

  // Platform settings
  const [enabledKeys, setEnabledKeys] = useState<Record<string, boolean>>({});
  const [tokenPricing, setTokenPricing] = useState<Record<string, number>>({});

  // Feature + prompt
  const [featureId, setFeatureId] = useState("text_to_video");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");

  // Generation settings
  const [model, setModel] = useState("kling-v3-std");
  const [duration, setDuration] = useState("5");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSeconds, setVideoSeconds] = useState(0);
  const [targetLang, setTargetLang] = useState("Spanish");
  const [sourceLang, setSourceLang] = useState("English");
  const [adCopy, setAdCopy] = useState("");
  const [adPlatform, setAdPlatform] = useState<string>("instagram_feed");
  const [moduleBusy, setModuleBusy] = useState(false);

  // Run state
  const [step, setStep] = useState<Step>("idle");
  const [stage, setStage] = useState<Stage>("charging");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [chargedCost, setChargedCost] = useState(0);

  // Feature-on-homepage form
  const [featTitle, setFeatTitle] = useState("");
  const [featCategory, setFeatCategory] = useState("cinematic");
  const [featSort, setFeatSort] = useState("0");
  // What the public showcase card reveals (prompt is never shown for upload modules)
  const [showPrompt, setShowPrompt] = useState(true);
  const [showSource, setShowSource] = useState(true);
  const [featuring, setFeaturing] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [outputLang, setOutputLang] = useState<LanguageChoice>(DEFAULT_LANGUAGE);

  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const feature = FEATURES.find((f) => f.id === featureId)!;
  const models = VIDEO_MODELS.filter((m) => isModelVisible(m, enabledKeys) && (!feature.audioOnly || m.hasSound));
  // The chosen model, or the first one valid for this feature
  const activeModel = models.some((m) => m.id === model) ? model : (models[0]?.id ?? model);
  const currentModel = VIDEO_MODELS.find((m) => m.id === activeModel);
  const needsImage = feature.input === "image" || (feature.input === "image-optional" && activeModel === "higgsfield-ugc");
  const showImageInput = feature.input === "image" || feature.input === "image-optional";
  const platform = AD_PLATFORMS.find((p) => p.id === adPlatform) ?? AD_PLATFORMS[0];
  const imageAspect = featureId === "image_ad" ? platform.aspect : aspectRatio;

  const cost = feature.pipeline === "module" || feature.pipeline === "soon" ? 0 : feature.pipeline === "image"
    ? (tokenPricing["text_to_image"] ?? 2)
    : feature.pipeline === "translate"
      ? Math.max(tokenPricing["video_translation"] ?? 20, Math.ceil((videoSeconds / 60) * (tokenPricing["video_translation"] ?? 20)))
      : (tokenPricing[activeModel] ?? currentModel?.tokens ?? 10) * (duration === "10" ? 2 : 1);

  // ---- Load balance and settings ----
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
      if (typeof b.balance === "number") { setBalance(b.balance); setBalanceDraft(String(b.balance)); }
      setPromptProvider(b.prompt_provider ?? null);
      const s = await sRes.json();
      setEnabledKeys(s.models ?? {});
      const p = await pRes.json();
      setTokenPricing(p.pricing ?? {});
    };
    load();
  }, []);

  // Elapsed timer while working
  useEffect(() => {
    if (step !== "working") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [step]);

  const selectFeature = (id: string) => {
    const f = FEATURES.find((x) => x.id === id)!;
    setFeatureId(id);
    setSuggestions([]); setSelectedIdx(null); setPrompt(""); setError("");
    setResult(null); setFeatured(false); setStep("idle");
    setFeatCategory(f.category);
    if (f.id === "ugc_ad" && VIDEO_MODELS.some((m) => m.id === "higgsfield-ugc" && isModelVisible(m, enabledKeys))) setModel("higgsfield-ugc");
  };

  // ---- Claude prompt suggestions ----
  const generateSuggestions = async () => {
    setSuggesting(true); setError("");
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch("/api/admin/showcase-studio", {
        method: "POST", headers,
        body: JSON.stringify({ action: "prompts", feature: featureId, aspect_ratio: aspectRatio, language: outputLang.language, accent: outputLang.accent }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Couldn't generate prompts."); return; }
      setSuggestions(data.prompts ?? []);
      setSelectedIdx(null);
    } catch {
      setError("Couldn't generate prompts.");
    } finally {
      setSuggesting(false);
    }
  };

  const pickSuggestion = (i: number) => {
    setSelectedIdx(i);
    setPrompt(suggestions[i].prompt);
    setFeatTitle(suggestions[i].title);
  };

  // ---- File inputs ----
  const onImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file."); return; }
    if (file.size > IMAGE_MAX_BYTES) { setError("Image must be under 10MB."); return; }
    setError(""); setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(String(ev.target?.result ?? ""));
    reader.readAsDataURL(file);
  };

  const onVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["mp4", "mov", "webm"].includes(ext)) { setError("Please choose an MP4, MOV or WebM video."); return; }
    if (file.size > VIDEO_MAX_BYTES) { setError("Video must be under 500MB."); return; }
    const seconds = await readVideoDuration(file);
    if (!seconds) { setError("Couldn't read this video's length. Try converting it to MP4."); return; }
    setError(""); setVideoFile(file); setVideoSeconds(seconds);
  };

  const uploadInput = async (file: File): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const ext = file.name.split(".").pop() ?? "bin";
    const filename = `showcase-${session.user.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("generation-inputs").upload(filename, file, { contentType: file.type });
    if (upErr) { console.error("Upload error:", upErr); return null; }
    return supabase.storage.from("generation-inputs").getPublicUrl(filename).data.publicUrl;
  };

  // ---- Admin balance ----
  const balanceCall = async (body: Record<string, unknown>) => {
    const headers = await authHeaders();
    if (!headers) return { ok: false, data: { error: "Please sign in." } };
    const res = await fetch("/api/admin/showcase-studio", { method: "POST", headers, body: JSON.stringify(body) });
    const data = await res.json();
    if (typeof data.balance === "number") setBalance(data.balance);
    return { ok: res.ok, data };
  };

  const saveBalance = async () => {
    const { ok, data } = await balanceCall({ action: "set_balance", balance: parseInt(balanceDraft, 10) });
    if (!ok) { setError(data.error ?? "Couldn't update balance."); return; }
    setEditingBalance(false);
  };

  // ---- Poll the existing status endpoint ----
  const poll = (taskId: string, provider: string): Promise<{ url: string | null; reason: string }> =>
    new Promise((resolve) => {
      const interval = provider === "heygen" ? 10000 : 5000;
      const started = Date.now();
      const timer = setInterval(async () => {
        if (Date.now() - started > MAX_SECONDS * 1000) { clearInterval(timer); resolve({ url: null, reason: "Generation timed out after 10 minutes." }); return; }
        try {
          const res = await fetch(`/api/video-status?task_id=${encodeURIComponent(taskId)}&provider=${provider}`);
          const sd = await res.json();
          if (sd.completed && sd.video_url) { clearInterval(timer); resolve({ url: sd.video_url, reason: "" }); }
          else if (sd.failed) { clearInterval(timer); resolve({ url: null, reason: sd.fail_reason ?? "Generation failed." }); }
        } catch { /* keep polling */ }
      }, interval);
    });

  // ---- Generate ----
  const handleGenerate = async () => {
    if (feature.pipeline === "module" || feature.pipeline === "soon") return;
    if (feature.pipeline !== "translate" && !prompt.trim()) { setError(featureId === "image_ad" ? "Describe the ad scene first." : "Pick or write a prompt first."); return; }
    if (feature.pipeline === "translate" && sourceLang === targetLang) { setError("Pick a different target language."); return; }
    if (needsImage && !imageFile) { setError(activeModel === "higgsfield-ugc" ? "Higgsfield UGC needs a reference image." : "Upload an image to animate."); return; }
    if (feature.pipeline === "translate" && !videoFile) { setError("Upload a source video to translate."); return; }
    if (balance !== null && balance < cost) { setError(`Not enough showcase tokens: this costs ${cost}, balance is ${balance}.`); return; }

    setError(""); setResult(null); setFeatured(false); setElapsed(0); setStep("working"); setStage("charging");
    const amount = cost;
    let charged = false;

    const fail = async (message: string) => {
      if (charged) await balanceCall({ action: "refund", amount });
      setError(message + (charged ? ` ${amount} tokens refunded.` : ""));
      setStep("idle");
    };

    try {
      const charge = await balanceCall({ action: "charge", amount });
      if (!charge.ok) { setError(charge.data.error ?? "Couldn't reserve tokens."); setStep("idle"); return; }
      charged = true;
      setChargedCost(amount);

      // Upload input media if this pipeline needs it
      let imageUrl: string | undefined;
      let videoUrl: string | undefined;
      if ((showImageInput && imageFile) || feature.pipeline === "translate") {
        setStage("uploading");
        if (feature.pipeline === "translate" && videoFile) {
          videoUrl = (await uploadInput(videoFile)) ?? undefined;
          if (!videoUrl) { await fail("Video upload failed."); return; }
        } else if (imageFile) {
          imageUrl = (await uploadInput(imageFile)) ?? undefined;
          if (!imageUrl) { await fail("Image upload failed."); return; }
        }
      }

      // Start the job on the existing pipeline. No user_id/tokens_used is sent,
      // so the generation routes never touch a user's token balance.
      setStage("generating");
      let startRes: Response;
      if (feature.pipeline === "image") {
        const imgAspect = imageAspect === "9:16" ? "2:3" : imageAspect === "1:1" ? "1:1" : "3:2";
        const isAd = featureId === "image_ad";
        startRes = await fetch("/api/generate-image", {
          // Admin login stands in for a token charge (admin tools spend the showcase balance)
          method: "POST", headers: (await authHeaders()) ?? { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: isAd ? `${prompt.trim()} Designed for ${platform.label}.` : prompt,
            image_url: imageUrl, aspect_ratio: imgAspect, language: outputLang.language, accent: outputLang.accent,
            ...(isAd ? { purpose: "ad", headline: adCopy.trim() || undefined } : {}),
          }),
        });
      } else if (feature.pipeline === "translate") {
        const headers = await authHeaders();
        startRes = await fetch("/api/translate-video", {
          method: "POST", headers: headers ?? { "Content-Type": "application/json" },
          body: JSON.stringify({ video_url: videoUrl, source_language: sourceLang, target_language: targetLang }),
        });
      } else {
        startRes = await fetch("/api/generate-video", {
          // Admin login stands in for a token charge (admin tools spend the showcase balance)
          method: "POST", headers: (await authHeaders()) ?? { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            mode: imageUrl ? "image_to_video" : "text_to_video",
            image_url: imageUrl,
            duration,
            aspect_ratio: aspectRatio,
            model: activeModel,
            with_audio: currentModel?.hasSound === true,
            language: outputLang.language, accent: outputLang.accent,
          }),
        });
      }
      const start = await startRes.json() as { task_id?: string; provider?: string; error?: string };
      if (!startRes.ok || !start.task_id) { await fail(start.error ?? "Couldn't start generation."); return; }

      const outcome = await poll(start.task_id, start.provider ?? (feature.pipeline === "translate" ? "heygen" : "kie"));
      if (!outcome.url) { await fail(outcome.reason); return; }

      // Save to generations (the admin's own gallery) so it can be featured
      setStage("saving");
      const outputType = feature.pipeline === "image" ? "image" : "video";
      let generationId: number | string | null = null;
      const headers = await authHeaders();
      if (headers) {
        const saveRes = await fetch("/api/generations", {
          method: "POST", headers,
          body: JSON.stringify({
            type: feature.type,
            prompt: feature.pipeline === "translate" ? `${sourceLang} → ${targetLang}: ${videoFile?.name ?? "video"}` : prompt,
            ...(outputType === "image" ? { image_url: outcome.url } : { video_url: outcome.url }),
            output_type: outputType,
            status: "completed",
            tokens_used: amount,
            duration: feature.pipeline === "video" ? duration : feature.pipeline === "translate" ? String(Math.round(videoSeconds)) : undefined,
            aspect_ratio: feature.pipeline === "translate" ? undefined : imageAspect,
            model: feature.pipeline === "translate" ? "HeyGen Translate" : feature.pipeline === "image" ? (featureId === "image_ad" ? "Image Ad · gpt-image-1.5" : "gpt-image-1.5") : activeModel,
            ...(feature.pipeline === "translate" ? { settings: { from: sourceLang, to: targetLang } } : featureId === "image_ad" ? { settings: { platform: platform.label } } : {}),
            provider: start.provider ?? null,
            ...(feature.pipeline === "translate" ? {} : { language: outputLang.language, accent: outputLang.accent }),
            source_image_url: imageUrl,
          }),
        });
        const saved = await saveRes.json();
        generationId = saved.generation?.id ?? null;
      }

      setResult({ url: outcome.url, outputType, generationId, sourceImage: imageUrl ?? null });
      if (!featTitle) setFeatTitle(feature.label);
      setStep("done");
    } catch (e) {
      console.error("Showcase generation error:", e);
      await fail("Something went wrong.");
    }
  };

  // ---- Feature on homepage ----
  const featureOnHomepage = async () => {
    if (!result?.generationId) { setError("This result wasn't saved, so it can't be featured. Feature it from Admin → Generations instead."); return; }
    setFeaturing(true); setError("");
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch("/api/admin/generations", {
        method: "PATCH", headers,
        body: JSON.stringify({
          id: result.generationId,
          is_featured: true,
          featured_category: featCategory,
          featured_title: featTitle,
          featured_sort: parseInt(featSort, 10) || 0,
          show_prompt: showPrompt,
          show_source_image: showSource,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error ?? "").includes("featured_sort")
          ? "Run supabase/showcase_studio.sql first to add the sort-order column."
          : /show_prompt|show_source_image/.test(String(data.error ?? ""))
          ? "Run supabase/showcase_details.sql first to add the visibility columns."
          : (data.error ?? "Couldn't feature this result."));
        return;
      }
      setFeatured(true);
    } finally {
      setFeaturing(false);
    }
  };

  const resetRun = () => { setStep("idle"); setResult(null); setFeatured(false); setElapsed(0); };

  // A hosted Studio module saved a result: offer it for the homepage
  const onModuleSaved = useCallback((g: SavedGeneration) => {
    setResult({ url: g.url, outputType: g.outputType, generationId: g.id, sourceImage: g.sourceImage ?? null });
    setFeatured(false); setShowPrompt(false);
    setFeatTitle((t) => t || FEATURES.find((f) => f.id === featureId)?.label || "");
  }, [featureId]);

  // Hosted modules charge the showcase balance while they're on screen
  useEffect(() => {
    if (feature.pipeline !== "module") return;
    setChargePool("showcase");
    return () => setChargePool("user");
  }, [feature.pipeline]);

  const moduleProps = {
    tokenBalance: balance ?? 0,
    setTokenBalance: (fn: (b: number) => number) => setBalance((b) => fn(b ?? 0)),
    tokenPricing, enabledKeys, settingsLoaded: true,
    onBack: () => {}, onBusyChange: setModuleBusy, onSaved: onModuleSaved,
  };

  const stages: { key: Stage; label: string; show: boolean }[] = [
    { key: "charging", label: "Showcase tokens reserved", show: true },
    { key: "uploading", label: feature.pipeline === "translate" ? "Uploading source video" : "Uploading reference image", show: (showImageInput && !!imageFile) || feature.pipeline === "translate" },
    { key: "generating", label: feature.pipeline === "translate" ? "Translating with lip-sync" : feature.pipeline === "image" ? "Generating image" : "Generating video", show: true },
    { key: "saving", label: "Saving result", show: true },
  ];
  const order: Stage[] = ["charging", "uploading", "generating", "saving"];
  const progress = step === "done" ? 100 : stage === "generating" ? Math.min(92, 10 + (elapsed / (feature.pipeline === "translate" ? MAX_SECONDS : 180)) * 82) : stage === "saving" ? 96 : 6;

  const featureCard = result && (
    <section className={`${cardClass} space-y-4 p-5 md:p-6`}>
      <div className="flex items-center gap-2">
        <Star size={17} className="text-accent-text" aria-hidden />
        <h2 className="text-base font-semibold">Feature on homepage</h2>
      </div>
      {featured ? (
        <Alert tone="success">
          Featured. It appears in the homepage gallery within about 30 seconds. <Link href="/#showcase" className="underline">View homepage</Link>
        </Alert>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-[1fr_200px_110px]">
            <Field label="Title"><Input value={featTitle} onChange={(e) => setFeatTitle(e.target.value)} placeholder="Card title" /></Field>
            <Field label="Category">
              <Select value={featCategory} onChange={(e) => setFeatCategory(e.target.value)}>
                {SHOWCASE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>
            </Field>
            <Field label="Sort order" hint="Lower shows first"><Input type="number" value={featSort} onChange={(e) => setFeatSort(e.target.value)} /></Field>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            {feature.pipeline !== "translate" && (
              <label className="flex items-center gap-2.5"><Toggle size="sm" checked={showPrompt} onChange={() => setShowPrompt(!showPrompt)} label="Show prompt publicly" /> Show prompt publicly</label>
            )}
            {result.sourceImage && (
              <label className="flex items-center gap-2.5"><Toggle size="sm" checked={showSource} onChange={() => setShowSource(!showSource)} label="Show source image publicly" /> Show source image publicly</label>
            )}
          </div>
          {error && <Alert>{error}</Alert>}
          <Button variant="primary" onClick={featureOnHomepage} disabled={featuring || !result.generationId}>
            {featuring ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Star size={16} aria-hidden />} Feature on homepage
          </Button>
          {!result.generationId && <p className="text-xs text-ink-subtle">The result couldn&apos;t be saved to Generations, so it can&apos;t be featured from here.</p>}
        </>
      )}
    </section>
  );

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Showcase Studio"
        description="Generate portfolio pieces for the homepage gallery. Admin only; spends the showcase token balance, never a user's tokens."
      />

      {/* BALANCE */}
      <div className={`${cardClass} mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent-text"><Coins size={19} aria-hidden /></span>
          <div>
            <p className="text-[13px] text-ink-muted">Showcase token balance</p>
            <p className="text-xl font-semibold tabular-nums tracking-tight">{balance ?? "—"}</p>
          </div>
        </div>
        {editingBalance ? (
          <div className="flex items-center gap-2">
            <Input type="number" min={0} value={balanceDraft} onChange={(e) => setBalanceDraft(e.target.value)} className="w-28" aria-label="New balance" />
            <Button variant="primary" size="sm" onClick={saveBalance}>Save</Button>
            <Button variant="ghost" size="sm" onClick={() => { setEditingBalance(false); setBalanceDraft(String(balance ?? 0)); }}>Cancel</Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setEditingBalance(true)}>Set balance</Button>
        )}
      </div>

      {step === "idle" && (
        <div className="space-y-4">
          {/* 1. FEATURE + PROMPTS */}
          <section className={`${cardClass} space-y-5 p-5 md:p-6`}>
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-xs font-semibold text-white">1</span>
              <h2 className="text-base font-semibold">Feature and inputs</h2>
            </div>

            <Field label="Feature to showcase">
              <Select value={featureId} onChange={(e) => selectFeature(e.target.value)} disabled={moduleBusy}>
                {FEATURES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </Select>
            </Field>

            {(feature.pipeline === "translate" || feature.pipeline === "module" || feature.input) && (
              <Alert tone="info">Upload a sample: this will be featured on the homepage showing what {feature.label} can do with real content. Use footage and photos you have the rights to show.</Alert>
            )}

            {feature.pipeline === "soon" ? (
              <Alert tone="warning">AI Music Studio isn&apos;t built yet, so there&apos;s nothing to generate. Its inputs (music description, genre, mood, vocals and video style) will appear here once it ships.</Alert>
            ) : feature.pipeline === "module" ? (
              <p className="text-sm text-ink-muted">This runs the real {feature.label} module below, with the same inputs users see. It spends the showcase balance; when the result is saved you can feature it.</p>
            ) : feature.pipeline === "translate" ? (
              <div className="space-y-4">
                <p className="text-sm text-ink-muted">Translation needs real footage of someone speaking, ideally a clip you generated with AI Actor.</p>
                <input ref={videoRef} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={onVideo} className="hidden" />
                <button onClick={() => videoRef.current?.click()} className="w-full rounded-xl border border-dashed border-line-strong bg-canvas p-6 text-center transition-colors hover:border-accent/60">
                  <Upload size={20} className="mx-auto mb-2 text-ink-subtle" aria-hidden />
                  {videoFile
                    ? <p className="text-sm font-medium text-ink">{videoFile.name} · {Math.round(videoSeconds)}s</p>
                    : <p className="text-sm text-ink-muted">Upload source video (MP4, MOV, WebM, up to 500MB)</p>}
                </button>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Source language">
                    <Select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
                      {TRANSLATE_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                    </Select>
                  </Field>
                  <Field label="Target language">
                    <Select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                      {TRANSLATE_LANGUAGES.filter((l) => l !== sourceLang).map((l) => <option key={l} value={l}>{l}</option>)}
                    </Select>
                  </Field>
                </div>
              </div>
            ) : (
              <>
                {feature.textModule && <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" onClick={generateSuggestions} disabled={suggesting || !promptProvider}>
                    {suggesting ? <Loader2 size={16} className="animate-spin" aria-hidden /> : suggestions.length ? <RefreshCw size={16} aria-hidden /> : <WandSparkles size={16} aria-hidden />}
                    {suggesting ? "Writing prompts…" : suggestions.length ? "Regenerate all 3" : "Suggest 3 prompts"}
                  </Button>
                  {!promptProvider && <span className="text-xs text-ink-subtle">Add a Claude or OpenAI key in <Link href="/admin/ai-providers" className="text-accent-text hover:underline">AI Providers</Link> to get suggestions.</span>}
                </div>}

                {feature.textModule && suggestions.length > 0 && (
                  <div className="grid gap-3 md:grid-cols-3">
                    {suggestions.map((s, i) => (
                      <button key={i} onClick={() => pickSuggestion(i)}
                        className={"rounded-xl border p-3.5 text-left transition-colors " + (selectedIdx === i ? "border-accent bg-accent/10" : "border-line bg-canvas hover:border-line-strong")}>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">{s.title}</span>
                          {selectedIdx === i && <CheckCircle2 size={16} className="flex-shrink-0 text-accent-text" aria-hidden />}
                        </div>
                        <p className="line-clamp-5 text-xs leading-relaxed text-ink-muted">{s.prompt}</p>
                      </button>
                    ))}
                  </div>
                )}

                <Field
                  label={featureId === "image_ad" ? "Ad scene" : "Prompt"}
                  hint={feature.textModule ? "Pick a suggestion above and edit it here, or write your own." : featureId === "image_ad" ? "How the product should be shown: setting, props, lighting, mood." : "What should happen: action, setting, lighting, camera movement."}>
                  <Textarea rows={feature.textModule ? 5 : 4} value={prompt} onChange={(e) => setPrompt(e.target.value)}
                    placeholder={featureId === "image_ad" ? "The serum bottle on a marble counter with fresh oranges and soft morning light" : "Describe the shot: subject, action, setting, lighting, camera movement, mood"} />
                </Field>
                {featureId === "image_ad" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Ad copy" hint="The headline written on the ad, in the output language. Leave empty for no text.">
                      <Input value={adCopy} maxLength={80} onChange={(e) => setAdCopy(e.target.value)} placeholder="Glow in 7 days" />
                    </Field>
                    <Field label="Target platform" hint={`Shapes the ad for that placement (${platform.aspect}).`}>
                      <Select value={adPlatform} onChange={(e) => setAdPlatform(e.target.value)}>
                        {AD_PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </Select>
                    </Field>
                  </div>
                )}
                <PromptTranslateBanner text={prompt} onTextChange={setPrompt} target={outputLang} />
                <LanguageAccentSelector label="Output Language & Accent" value={outputLang} onChange={setOutputLang} />
                {feature.textModule && <p className="-mt-1 text-xs text-ink-subtle">Suggestions are written in this language: change it, then refresh the suggestions.</p>}

                {showImageInput && (
                  <div>
                    <p className="mb-1.5 text-[13px] font-medium text-ink-muted">
                      {feature.imageLabel ?? "Reference image"} {feature.input === "image-optional" && activeModel !== "higgsfield-ugc" ? "(optional)" : ""}
                    </p>
                    <input ref={imageRef} type="file" accept="image/*" onChange={onImage} className="hidden" />
                    <button onClick={() => imageRef.current?.click()} className="flex w-full items-center gap-4 rounded-xl border border-dashed border-line-strong bg-canvas p-4 text-left transition-colors hover:border-accent/60">
                      {imagePreview
                        ? <img src={imagePreview} alt="Reference" className="h-16 w-16 rounded-lg object-cover" />
                        : <span className="grid h-16 w-16 place-items-center rounded-lg bg-white/[0.04] text-ink-subtle"><ImagePlus size={20} aria-hidden /></span>}
                      <span className="text-sm text-ink-muted">{imageFile ? imageFile.name : "Upload JPG, PNG or WebP, up to 10MB"}</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Hosted Studio module (its own inputs, pipeline and language controls) */}
          {feature.pipeline === "module" && (
            <div className="space-y-4">
              {featureId === "video_remix" && <VideoRemix {...moduleProps} />}
              {featureId === "actor_swap" && <ActorSwap {...moduleProps} />}
              {featureId === "series_cloner" && <SeriesCloner {...moduleProps} />}
              {featureId === "faceless_reels" && <FacelessReels {...moduleProps} />}
              {moduleBusy && <p className="text-center text-xs text-ink-subtle">Keep this page open until it finishes.</p>}
              {featureCard}
            </div>
          )}

          {/* 2. MODEL + SETTINGS */}
          {(feature.pipeline === "video" || feature.pipeline === "image") && (
            <section className={`${cardClass} space-y-5 p-5 md:p-6`}>
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-xs font-semibold text-white">2</span>
                <h2 className="text-base font-semibold">Model and format</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {feature.pipeline === "video" && (
                  <Field label="Model">
                    <Select value={activeModel} onChange={(e) => setModel(e.target.value)}>
                      {models.map((m) => <option key={m.id} value={m.id}>{m.name}{m.hasSound ? " · audio" : ""}</option>)}
                    </Select>
                  </Field>
                )}
                {feature.pipeline === "video" && (
                  <Field label="Duration">
                    <Select value={duration} onChange={(e) => setDuration(e.target.value)}>
                      <option value="5">5 seconds</option>
                      <option value="10">10 seconds</option>
                    </Select>
                  </Field>
                )}
                {featureId !== "image_ad" && <Field label="Aspect ratio">
                  <Select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
                    <option value="16:9">16:9 widescreen</option>
                    <option value="9:16">9:16 vertical</option>
                    <option value="1:1">1:1 square</option>
                  </Select>
                </Field>}
              </div>
              {feature.pipeline === "video" && models.length === 0 && (
                <Alert tone="warning">No {feature.audioOnly ? "audio " : ""}models are enabled. Turn some on in Admin → AI Providers.</Alert>
              )}
            </section>
          )}

          {error && feature.pipeline !== "module" && <Alert>{error}</Alert>}

          {feature.pipeline !== "module" && feature.pipeline !== "soon" && <div className={`${cardClass} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}>
            <p className="text-sm text-ink-muted">
              Cost: <span className="font-semibold text-ink">{cost} showcase tokens</span>
              {feature.pipeline === "translate" && !videoFile && <span className="text-ink-subtle"> (minimum; depends on video length)</span>}
            </p>
            <Button variant="primary" size="lg" onClick={handleGenerate}>
              <Sparkles size={17} aria-hidden /> Generate
            </Button>
          </div>}
        </div>
      )}

      {/* PROGRESS */}
      {step === "working" && (
        <section className={`${cardClass} space-y-5 p-6`}>
          <div className="text-center">
            <h2 className="text-base font-semibold">Generating your showcase piece</h2>
            <p className="mt-1 text-sm text-ink-muted">{feature.label} · keep this page open</p>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-ink-subtle">
              <span>{Math.round(progress)}% complete</span>
              <span>{Math.floor(elapsed / 60) > 0 ? `${Math.floor(elapsed / 60)}m ` : ""}{elapsed % 60}s elapsed</span>
            </div>
            <Progress value={progress} />
          </div>
          <ul className="space-y-2">
            {stages.filter((s) => s.show).map((s) => {
              const done = order.indexOf(stage) > order.indexOf(s.key);
              const active = stage === s.key;
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
          <p className="text-center text-xs text-ink-subtle">Tokens are refunded to the showcase balance if this fails or takes longer than 10 minutes.</p>
        </section>
      )}

      {/* RESULT + FEATURE */}
      {step === "done" && result && (
        <div className="space-y-4">
          <section className={`${cardClass} space-y-4 p-5`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-400" aria-hidden />
                <h2 className="text-base font-semibold">Ready</h2>
                <Badge>{chargedCost} tokens</Badge>
              </div>
              <a href={result.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-accent-text hover:underline">
                Open <ExternalLink size={14} aria-hidden />
              </a>
            </div>
            {result.outputType === "image"
              ? <img src={result.url} alt="Generated showcase" className="w-full rounded-xl border border-line" />
              : <video src={result.url} controls playsInline className="w-full rounded-xl border border-line bg-black" />}
          </section>

          {featureCard}

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={resetRun}>Generate another</Button>
            <Button variant="ghost" onClick={() => { resetRun(); setPrompt(""); setSuggestions([]); setSelectedIdx(null); setFeatTitle(""); }}>Start over</Button>
          </div>
        </div>
      )}
    </div>
  );
}
