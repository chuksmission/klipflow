"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, CheckCircle2, ChevronLeft, Circle, Coins, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { chargeTokens, refundCharge, refundNote } from "../../lib/token-client";
import VideoRemix from "./VideoRemix";
import ActorSwap from "./ActorSwap";
import SeriesCloner from "./SeriesCloner";
import FacelessReels from "./FacelessReels";
import LanguageAccentSelector, { DEFAULT_LANGUAGE, type LanguageChoice } from "../../components/LanguageAccentSelector";
import PromptTranslateBanner from "../../components/PromptTranslateBanner";
import { ACTOR_SWAP_LANGUAGES } from "../../lib/actor-swap";
import { VIDEO_MODELS, getStudioModule, isModelVisible, studioHref, takePendingGeneration, type StudioModuleId, type VideoModel } from "../../components/catalog";

type Model = VideoModel;

interface Module {
  id: string;
  title: string;
  desc: string;
  badge: string;
}

interface Scene {
  scene_number: number;
  narration: string;
  visual_prompt: string;
  video_url?: string;
  status?: "pending" | "generating" | "done" | "failed";
}

function Studio() {
  const t = useTranslations("studio");
  const c = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlModule = searchParams.get("module");
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("5");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [useUrl, setUseUrl] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [tokenBalance, setTokenBalance] = useState(25);
  const [selectedModel, setSelectedModel] = useState("kling-v1-6-pro");
  const [enabledKeys, setEnabledKeys] = useState<Record<string, boolean>>({});
  const [tokenPricing, setTokenPricing] = useState<Record<string, number>>({});
  const [modelLabels, setModelLabels] = useState<Record<string, string>>({});
  const [modelDescs, setModelDescs] = useState<Record<string, string>>({});
  const [modelBadges, setModelBadges] = useState<Record<string, string>>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [remixBusy, setRemixBusy] = useState(false);
  const [swapBusy, setSwapBusy] = useState(false);
  const [clonerBusy, setClonerBusy] = useState(false);
  const [reelsBusy, setReelsBusy] = useState(false);
  // Output language & accent, shared by the prompt-based modules (defaults to English)
  const [outputLang, setOutputLang] = useState<LanguageChoice>(DEFAULT_LANGUAGE);
  // Image Ad: optional headline rendered into the ad
  const [adHeadline, setAdHeadline] = useState("");

  // Prompt Expander
  const [expandedPrompt, setExpandedPrompt] = useState("");
  const [expandLoading, setExpandLoading] = useState(false);

  // Script Writer
  const [scriptTopic, setScriptTopic] = useState("");
  const [scriptFormat, setScriptFormat] = useState("storytelling");
  const [scriptPlatform, setScriptPlatform] = useState("tiktok");
  const [scriptDuration, setScriptDuration] = useState("30");
  const [generatedScript, setGeneratedScript] = useState("");
  const [scriptLoading, setScriptLoading] = useState(false);

  // Script to Video
  const [s2vScript, setS2vScript] = useState("");
  const [s2vModel, setS2vModel] = useState("kling-v3-std");
  const [s2vAspectRatio, setS2vAspectRatio] = useState("9:16");
  const [s2vScenes, setS2vScenes] = useState<Scene[]>([]);
  const [s2vStep, setS2vStep] = useState<"input" | "review" | "generating" | "done">("input");
  const [s2vSplitting, setS2vSplitting] = useState(false);
  const [s2vCurrentScene, setS2vCurrentScene] = useState(0);
  const [s2vModelPhoto, setS2vModelPhoto] = useState("");
  const [s2vModelPhotoFile, setS2vModelPhotoFile] = useState<File | null>(null);
  const [s2vModelDesc, setS2vModelDesc] = useState("");
  const [s2vSceneStyles, setS2vSceneStyles] = useState<Record<number, string>>({});
  const [s2vSceneDuration, setS2vSceneDuration] = useState("10");
  const s2vPhotoRef = useRef<HTMLInputElement>(null);

  // AI Video Translator
  const [vtFile, setVtFile] = useState<File | null>(null);
  const [vtDuration, setVtDuration] = useState(0);
  const [vtSourceLang, setVtSourceLang] = useState("English");
  const [vtTargetLang, setVtTargetLang] = useState("Spanish");
  const [vtStep, setVtStep] = useState<"input" | "uploading" | "translating" | "done">("input");
  const [vtElapsed, setVtElapsed] = useState(0);
  const [vtVideoUrl, setVtVideoUrl] = useState<string | null>(null);
  const vtFileRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const tokenCostRef = useRef(10);
  const selectedModelRef = useRef("kling-v1-6-pro");
  const activeModuleRef = useRef<string | null>(null);
  const providerRef = useRef("kie");

  useEffect(() => { selectedModelRef.current = selectedModel; }, [selectedModel]);
  useEffect(() => { activeModuleRef.current = activeModule; }, [activeModule]);

  const ALL_MODELS: Model[] = VIDEO_MODELS;

  // Only confirmed audio models for Script to Video
  const AUDIO_MODELS = [
    { id: "kling-v3-std", name: "Kling 3.0 Standard", tokens: 15, desc: t("s2v.models.klingStd") },
    { id: "kling-v3-pro", name: "Kling 3.0 Pro",      tokens: 20, desc: t("s2v.models.klingPro") },
    { id: "veo3-fast",    name: "Veo 3.1 Fast",        tokens: 15, desc: t("s2v.models.veoFast") },
  ];

  const VT_LANGUAGES = [
    "English", "Arabic", "Bulgarian", "Chinese", "Dutch", "French", "German", "Hindi",
    "Italian", "Japanese", "Korean", "Polish", "Portuguese", "Russian", "Spanish", "Turkish",
  ];
  // Values stay HeyGen's English names; labels use the browser's names in the interface language
  const VT_CODES: Record<string, string> = { English: "en", Arabic: "ar", Bulgarian: "bg", Chinese: "zh", Dutch: "nl", French: "fr", German: "de", Hindi: "hi", Italian: "it", Japanese: "ja", Korean: "ko", Polish: "pl", Portuguese: "pt", Russian: "ru", Spanish: "es", Turkish: "tr" };
  const languageNames = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames([locale], { type: "language" }) : null;
  const vtLabel = (lang: string) => { const name = languageNames?.of(VT_CODES[lang] ?? "") ?? lang; return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1); };
  const VT_MAX_BYTES = 500 * 1024 * 1024;
  const VT_MAX_SECONDS = 600; // 10 minute processing timeout

  const modules: Module[] = [
    { id: "text_to_video",   title: t("cards.text_to_video.title"),    desc: t("cards.text_to_video.desc"), badge: t("badges.mostPopular") },
    { id: "image_to_video",  title: t("cards.image_to_video.title"),   desc: t("cards.image_to_video.desc"),    badge: "" },
    { id: "ugc_ad",          title: t("cards.ugc_ad.title"),   desc: t("cards.ugc_ad.desc"),  badge: t("badges.bestForAds") },
    { id: "ai_actor",        title: t("cards.ai_actor.title"),         desc: t("cards.ai_actor.desc"),           badge: "" },
    { id: "voice",           title: t("cards.voice.title"), desc: t("cards.voice.desc"),                 badge: "" },
    { id: "text_to_image",   title: t("cards.text_to_image.title"),    desc: t("cards.text_to_image.desc"),     badge: t("badges.twoTokens") },
    { id: "script_to_video", title: t("cards.script_to_video.title"),  desc: t("cards.script_to_video.desc"), badge: t("badges.new") },
    { id: "video_remix",     title: t("cards.video_remix.title"),      desc: t("cards.video_remix.desc"),           badge: t("badges.new") },
    { id: "ai_actor_swap",   title: t("cards.ai_actor_swap.title"),    desc: t("cards.ai_actor_swap.desc"),   badge: t("badges.new") },
    { id: "series_cloner",   title: t("cards.series_cloner.title"),    desc: t("cards.series_cloner.desc"), badge: t("badges.new") },
    { id: "faceless_reels",  title: t("cards.faceless_reels.title"),   desc: t("cards.faceless_reels.desc"), badge: t("badges.new") },
    { id: "video_translator", title: t("cards.video_translator.title"), desc: t("cards.video_translator.desc"), badge: t("badges.new") },
    { id: "image_ad",        title: t("cards.image_ad.title"),         desc: t("cards.image_ad.desc"),             badge: t("badges.cheapest") },
    { id: "prompt",          title: t("cards.prompt.title"),  desc: t("cards.prompt.desc"),    badge: t("badges.free") },
    { id: "script",          title: t("cards.script.title"),    desc: t("cards.script.desc"),             badge: t("badges.free") },
  ];

  // AI Video Translator only shows once HeyGen is enabled in Admin > AI Providers
  const visibleModules = modules.filter((mod) =>
    (mod.id !== "video_translator" || enabledKeys["heygen_enabled"] === true) &&
    (mod.id !== "video_remix" || enabledKeys["video_remix_enabled"] === true) &&
    (mod.id !== "ai_actor_swap" || enabledKeys["ai_actor_swap_enabled"] === true) &&
    (mod.id !== "series_cloner" || enabledKeys["series_cloner_enabled"] === true) &&
    (mod.id !== "faceless_reels" || enabledKeys["faceless_reels_enabled"] === true));

  const visibleModels = ALL_MODELS.filter((m) => isModelVisible(m, enabledKeys));

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (loading) {
      setElapsedTime(0); setProgress(0);
      timer = setInterval(() => {
        setElapsedTime((prev) => {
          const t = prev + 1;
          setProgress(Math.min(90, (t / 180) * 100));
          return t;
        });
      }, 1000);
    } else if (videoUrl) setProgress(100);
    return () => { if (timer) clearInterval(timer); };
  }, [loading, videoUrl]);

  const vtBusy = vtStep === "uploading" || vtStep === "translating";
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (vtBusy) timer = setInterval(() => setVtElapsed((prev) => prev + 1), 1000);
    return () => { if (timer) clearInterval(timer); };
  }, [vtBusy]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/tokens", { headers: { Authorization: "Bearer " + session.access_token } });
      const data = await res.json();
      if (data.balance !== undefined) setTokenBalance(data.balance);
      const sRes = await fetch("/api/settings/models");
      const sData = await sRes.json();
      setEnabledKeys(sData.models ?? {});
      setModelLabels(sData.labels ?? {});
      setModelDescs(sData.descs ?? {});
      setModelBadges(sData.badges ?? {});
      setSettingsLoaded(true);
      const pRes = await fetch("/api/token-pricing");
      const pData = await pRes.json();
      setTokenPricing(pData.pricing ?? {});
    };
    init();
  }, []);

  useEffect(() => {
    if (activeModule === "ugc_ad") setSelectedModel("higgsfield-ugc");
    else if (selectedModel === "higgsfield-ugc") setSelectedModel("kling-v1-6-pro");
  }, [activeModule]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    return m > 0 ? m + "m " + (s % 60) + "s" : s + "s";
  };

  const getStatusMsg = (e: number) => {
    if (e < 10) return t("progress.init");
    if (e < 30) return t("progress.analyzing");
    if (e < 60) return t("progress.frames");
    if (e < 120) return t("progress.rendering");
    return t("progress.finalizing");
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => { if (ev.target?.result) setImagePreview(ev.target.result as string); };
    reader.readAsDataURL(file);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const ext = file.name.split(".").pop() ?? "jpg";
    const filename = session.user.id + "-" + Date.now() + "." + ext;
    const { error } = await supabase.storage.from("generation-inputs").upload(filename, file, { contentType: file.type });
    if (error) { console.error("Upload error:", error); return null; }
    const { data: { publicUrl } } = supabase.storage.from("generation-inputs").getPublicUrl(filename);
    return publicUrl;
  };

  // ---- PROMPT EXPANDER ----
  const handleExpandPrompt = async () => {
    if (!prompt) { setError(t("errors.enterIdea")); return; }
    setExpandLoading(true); setError(""); setExpandedPrompt("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError(t("errors.signIn")); setExpandLoading(false); return; }
      const res = await fetch("/api/expand-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ idea: prompt, aspect_ratio: aspectRatio, language: outputLang.language, accent: outputLang.accent }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? t("errors.expandFailed")); setExpandLoading(false); return; }
      setExpandedPrompt(data.prompt);
    } catch { setError(t("errors.generic")); }
    setExpandLoading(false);
  };

  // ---- SCRIPT WRITER ----
  const handleWriteScript = async () => {
    if (!scriptTopic) { setError(t("errors.enterTopic")); return; }
    setScriptLoading(true); setError(""); setGeneratedScript("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError(t("errors.signIn")); setScriptLoading(false); return; }
      const res = await fetch("/api/write-script", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ topic: scriptTopic, format: scriptFormat, platform: scriptPlatform, duration: scriptDuration, language: outputLang.language, accent: outputLang.accent }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? t("errors.scriptFailed")); setScriptLoading(false); return; }
      setGeneratedScript(data.script);
    } catch { setError(t("errors.generic")); }
    setScriptLoading(false);
  };

  // ---- SCRIPT TO VIDEO: Split into scenes ----
  const handleSplitScenes = async () => {
    if (!s2vScript.trim()) { setError(t("errors.enterScript")); return; }
    setS2vSplitting(true); setError(""); setS2vScenes([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError(t("errors.signIn")); setS2vSplitting(false); return; }
      const res = await fetch("/api/script-to-scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ script: s2vScript, aspect_ratio: s2vAspectRatio, model_description: s2vModelDesc || undefined, scene_styles: s2vSceneStyles }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? t("errors.splitFailed")); setS2vSplitting(false); return; }
      setS2vScenes(data.scenes.map((s: Scene) => ({ ...s, status: "pending" })));
      setS2vStep("review");
    } catch { setError(t("errors.generic")); }
    setS2vSplitting(false);
  };

  // ---- SCRIPT TO VIDEO: Generate all scenes ----
  const handleGenerateScenes = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError(t("errors.signIn")); return; }

    const modelData = AUDIO_MODELS.find(m => m.id === s2vModel);
    const tokenCostPerScene = tokenPricing[s2vModel] ?? modelData?.tokens ?? 15;
    const totalCost = tokenCostPerScene * s2vScenes.length;

    if (tokenBalance < totalCost) {
      setError(t("errors.insufficientScenes", { cost: totalCost, scenes: s2vScenes.length, balance: tokenBalance }));
      return;
    }

    setS2vStep("generating");
    setS2vCurrentScene(0);
    setError("");

    const updatedScenes = [...s2vScenes];

    for (let i = 0; i < updatedScenes.length; i++) {
      setS2vCurrentScene(i);
      updatedScenes[i] = { ...updatedScenes[i], status: "generating" };
      setS2vScenes([...updatedScenes]);

      try {
        // Deduct tokens (creates a charge this scene's job is tied to)
        const charge = await chargeTokens(tokenCostPerScene, "script_to_video");
        if (!charge.ok) { setError(charge.error); break; }
        setTokenBalance(charge.balance);
        const sceneRefund = async () => { const r = await refundCharge(charge.chargeId); if (r.balance !== undefined) setTokenBalance(r.balance); };

        // Generate video
        const genRes = await fetch("/api/generate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: updatedScenes[i].visual_prompt,
            mode: s2vModelPhoto ? "image_to_video" : "text_to_video",
            image_url: s2vModelPhoto || undefined,
            duration: s2vSceneDuration,
            aspect_ratio: s2vAspectRatio,
            model: s2vModel,
            with_audio: true,
            charge_id: charge.chargeId,
          }),
        });
        const genData = await genRes.json();

        if (!genRes.ok || !genData.task_id) {
          updatedScenes[i] = { ...updatedScenes[i], status: "failed" };
          setS2vScenes([...updatedScenes]);
          await sceneRefund();
          continue;
        }

        // Poll for completion
        const videoUrl = await pollForVideo(genData.task_id, genData.provider ?? "kie");

        if (videoUrl) {
          updatedScenes[i] = { ...updatedScenes[i], status: "done", video_url: videoUrl };
          setS2vScenes([...updatedScenes]);

          // Save to gallery
          try {
            await fetch("/api/generations", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
              body: JSON.stringify({
                type: "script_to_video",
                prompt: updatedScenes[i].visual_prompt,
                video_url: videoUrl,
                output_type: "video",
                status: "completed",
                tokens_used: tokenCostPerScene,
                model: s2vModel,
                scene_index: i + 1,
                charge_id: charge.chargeId,
              }),
            });
          } catch { /* non-critical */ }
        } else {
          updatedScenes[i] = { ...updatedScenes[i], status: "failed" };
          setS2vScenes([...updatedScenes]);
          await sceneRefund();
        }
      } catch (e) {
        console.error("Scene generation error:", e);
        updatedScenes[i] = { ...updatedScenes[i], status: "failed" };
        setS2vScenes([...updatedScenes]);
      }
    }

    setS2vStep("done");
  };

  const pollForVideo = (taskId: string, provider: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const maxAttempts = 120; // 10 minutes
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) { clearInterval(poll); resolve(null); return; }
        try {
          const sr = await fetch(`/api/video-status?task_id=${taskId}&provider=${provider}`);
          const sd = await sr.json();
          if (sd.completed && sd.video_url) { clearInterval(poll); resolve(sd.video_url); }
          else if (sd.failed) { clearInterval(poll); resolve(null); }
        } catch { /* continue polling */ }
      }, 5000);
    });
  };

  // ---- AI VIDEO TRANSLATOR ----
  const readVideoDuration = (file: File): Promise<number | null> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      const url = URL.createObjectURL(file);
      video.preload = "metadata";
      video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(isFinite(video.duration) && video.duration > 0 ? video.duration : null); };
      video.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      video.src = url;
    });
  };

  const handleVtFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(""); setVtFile(null); setVtDuration(0);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["mp4", "mov", "webm"].includes(ext)) { setError(t("errors.videoFormat")); return; }
    if (file.size > VT_MAX_BYTES) { setError(t("errors.videoTooLarge")); return; }
    const seconds = await readVideoDuration(file);
    if (!seconds) { setError(t("errors.videoLength")); return; }
    setVtFile(file); setVtDuration(seconds);
  };

  // HeyGen translations are slower than generations, so poll every 10s for up to 10 minutes
  const pollForTranslation = (taskId: string): Promise<{ videoUrl: string | null; reason: string }> => {
    return new Promise((resolve) => {
      const maxAttempts = VT_MAX_SECONDS / 10;
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) { clearInterval(poll); resolve({ videoUrl: null, reason: t("errors.translationTimeout") }); return; }
        try {
          const sr = await fetch(`/api/video-status?task_id=${encodeURIComponent(taskId)}&provider=heygen`);
          const sd = await sr.json();
          if (sd.completed && sd.video_url) { clearInterval(poll); resolve({ videoUrl: sd.video_url, reason: "" }); }
          else if (sd.failed) { clearInterval(poll); resolve({ videoUrl: null, reason: sd.fail_reason ?? t("errors.translationFailed") }); }
        } catch { /* continue polling */ }
      }, 10000);
    });
  };

  const handleTranslateVideo = async () => {
    if (!vtFile || !vtDuration) { setError(t("errors.uploadVideo")); return; }
    if (vtSourceLang === vtTargetLang) { setError(t("errors.sameLanguage")); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError(t("errors.signIn")); return; }
    const cost = vtTokenCost;
    if (tokenBalance < cost) { setError(t("errors.insufficient", { cost, balance: tokenBalance })); return; }

    setError(""); setVtVideoUrl(null); setVtElapsed(0); setVtStep("uploading");

    let chargeId: string | null = null;
    const refund = async (message: string) => {
      setVtStep("input");
      const r = await refundCharge(chargeId);
      if (r.balance !== undefined) setTokenBalance(r.balance);
      setError(message + refundNote(r));
    };

    let charged = false;
    try {
      // Deduct tokens before anything starts (creates the charge this job is tied to)
      const charge = await chargeTokens(cost, "video_translation");
      if (!charge.ok) { setError(charge.error); setVtStep("input"); return; }
      charged = true;
      chargeId = charge.chargeId;
      setTokenBalance(charge.balance);

      const uploadedUrl = await uploadImage(vtFile);
      if (!uploadedUrl) { await refund(t("errors.videoUploadFailed")); return; }

      setVtStep("translating");
      const res = await fetch("/api/translate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ video_url: uploadedUrl, source_language: vtSourceLang, target_language: vtTargetLang, charge_id: chargeId }),
      });
      const data = await res.json() as { task_id?: string; error?: string };
      if (!res.ok || !data.task_id) { await refund(data.error ?? t("errors.translationStart")); return; }

      const result = await pollForTranslation(data.task_id);
      if (!result.videoUrl) { await refund(result.reason); return; }

      setVtVideoUrl(result.videoUrl); setVtStep("done");
      try {
        const { data: { session: fs } } = await supabase.auth.getSession();
        if (fs) {
          await fetch("/api/generations", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + fs.access_token },
            body: JSON.stringify({
              type: "video_translation",
              prompt: `${vtSourceLang} → ${vtTargetLang}: ${vtFile.name}`,
              video_url: result.videoUrl,
              output_type: "video",
              status: "completed",
              tokens_used: cost,
              duration: String(Math.round(vtDuration)),
              model: "HeyGen Translate",
              provider: "heygen",
              settings: { from: vtSourceLang, to: vtTargetLang },
              charge_id: chargeId,
            }),
          });
        }
      } catch (e) { console.error("Save error:", e); }
    } catch (e) {
      console.error("Video translation error:", e);
      if (charged) await refund(t("errors.generic"));
      else { setError(t("errors.generic")); setVtStep("input"); }
    }
  };

  // ---- IMAGE GENERATION ----
  const handleGenerateImage = async () => {
    const isAd = activeModule === "image_ad";
    setLoading(true); setError(""); setVideoUrl(null); setProgress(0);
    const tokenCostImg = tokenPricing["text_to_image"] ?? 2;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError(t("errors.signIn")); setLoading(false); return; }
      const charge = await chargeTokens(tokenCostImg, isAd ? "image_ad" : "text_to_image");
      if (!charge.ok) { setError(charge.error); setLoading(false); return; }
      setTokenBalance(charge.balance);
      const chargeId = charge.chargeId;
      const imgRefund = async (message: string) => { const r = await refundCharge(chargeId); if (r.balance !== undefined) setTokenBalance(r.balance); setError(message + refundNote(r)); };
      let refImageUrl = imageUrlInput;
      if (imageFile && !useUrl) { const uploaded = await uploadImage(imageFile); if (uploaded) refImageUrl = uploaded; }
      const imgAspectRatio = aspectRatio === "9:16" ? "2:3" : aspectRatio === "1:1" ? "1:1" : "3:2";
      const res = await fetch("/api/generate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, image_url: refImageUrl || undefined, aspect_ratio: imgAspectRatio, charge_id: chargeId, language: outputLang.language, accent: outputLang.accent, ...(isAd ? { purpose: "ad", headline: adHeadline.trim() || undefined } : {}) }) });
      const data = await res.json() as { task_id?: string; error?: string };
      if (!res.ok || !data.task_id) { setLoading(false); await imgRefund(data.error ?? t("errors.startFailed")); return; }
      let generationComplete = false;
      const poll = setInterval(async () => {
        try {
          const sr = await fetch("/api/video-status?task_id=" + data.task_id + "&provider=kie");
          const sd = await sr.json() as { completed?: boolean; failed?: boolean; video_url?: string };
          if (sd.completed && sd.video_url) {
            generationComplete = true;
            setVideoUrl(sd.video_url); setProgress(100); setLoading(false); clearInterval(poll);
            try {
              const { data: { session: fs } } = await supabase.auth.getSession();
              if (fs) { await fetch("/api/generations", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + fs.access_token }, body: JSON.stringify({ type: isAd ? "image_ad" : "text_to_image", prompt, image_url: sd.video_url, output_type: "image", status: "completed", tokens_used: tokenCostImg, charge_id: chargeId, model: isAd ? "Image Ad · gpt-image-1.5" : "gpt-image-1.5", language: outputLang.language, accent: outputLang.accent, source_image_url: refImageUrl || undefined }) }); }
            } catch (e) { console.error("Save error:", e); }
          } else if (sd.failed) {
            setLoading(false); clearInterval(poll);
            await imgRefund(t("errors.generationFailed"));
          }
        } catch (e) { console.error("Poll error:", e); }
      }, 5000);
      void generationComplete;
    } catch (e) { setError(t("errors.generic")); setLoading(false); }
  };

  // ---- VIDEO GENERATION ----
  const handleGenerate = async () => {
    if (!prompt) { setError(t("errors.enterPrompt")); return; }
    if (activeModule === "text_to_image" || activeModule === "image_ad") { await handleGenerateImage(); return; }
    const needsImage = activeModule === "image_to_video" || activeModule === "ugc_ad";
    if (needsImage && !imageFile && !imageUrlInput) { setError(t("errors.needImage")); return; }
    setLoading(true); setError(""); setVideoUrl(null); setProgress(0);
    const modelData = ALL_MODELS.find((m) => m.id === selectedModel);
    const tokenCost = tokenPricing[selectedModel] ?? modelData?.tokens ?? 10;
    const provider = modelData?.provider ?? "kie";
    tokenCostRef.current = tokenCost; providerRef.current = provider;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError(t("errors.signIn")); setLoading(false); return; }
      const charge = await chargeTokens(tokenCost, activeModule ?? "text_to_video");
      if (!charge.ok) { setError(charge.error); setLoading(false); return; }
      setTokenBalance(charge.balance);
      const chargeId = charge.chargeId;
      const videoRefund = async (message: string) => { const r = await refundCharge(chargeId); if (r.balance !== undefined) setTokenBalance(r.balance); setError(message + refundNote(r)); };
      let imageUrl = imageUrlInput;
      if (needsImage && imageFile && !useUrl) {
        const uploaded = await uploadImage(imageFile);
        if (!uploaded) { setLoading(false); await videoRefund(t("errors.imageUploadFailed")); return; }
        imageUrl = uploaded;
      }
      const capturedModule = activeModuleRef.current;
      const capturedModel = selectedModelRef.current;
      const capturedCost = tokenCostRef.current;
      const capturedProvider = providerRef.current;
      const capturedMode = needsImage ? "image_to_video" : "text_to_video";
      const useAudio = modelData?.hasSound === true;
      const res = await fetch("/api/generate-video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, mode: capturedMode, image_url: imageUrl || undefined, duration: String(duration), aspect_ratio: aspectRatio, model: selectedModel, with_audio: useAudio, charge_id: chargeId, language: outputLang.language, accent: outputLang.accent }) });
      const data = await res.json() as { task_id?: string; error?: string; provider?: string };
      if (!res.ok || !data.task_id) { setLoading(false); await videoRefund(data.error ?? t("errors.startFailed")); return; }
      const genProvider = data.provider ?? capturedProvider;
      let timedOut = false; let generationComplete = false; let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const poll = setInterval(async () => {
        try {
          const sr = await fetch("/api/video-status?task_id=" + data.task_id + "&mode=" + capturedMode + "&provider=" + genProvider);
          const sd = await sr.json() as { completed?: boolean; failed?: boolean; video_url?: string };
          if (sd.completed && sd.video_url) {
            if (timedOut) return; generationComplete = true; clearTimeout(timeoutHandle);
            setVideoUrl(sd.video_url); setProgress(100); setLoading(false); clearInterval(poll);
            try { const { data: { session: fs } } = await supabase.auth.getSession(); if (fs) { await fetch("/api/generations", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + fs.access_token }, body: JSON.stringify({ type: capturedModule, prompt, video_url: sd.video_url, status: "completed", tokens_used: capturedCost, duration, aspect_ratio: aspectRatio, model: capturedModel, charge_id: chargeId, language: outputLang.language, accent: outputLang.accent, source_image_url: imageUrl || undefined }) }); } } catch (e) { console.error("Save error:", e); }
          } else if (sd.failed) {
            setLoading(false); clearInterval(poll);
            await videoRefund(t("errors.generationFailed"));
          }
        } catch (e) { console.error("Poll error:", e); }
      }, 5000);
      const timeoutMs = ["veo3-fast", "veo3-quality", "sora-2", "seedance-2", "seedance-2-fast"].includes(selectedModel) ? 600000 : 300000;
      timeoutHandle = setTimeout(async () => {
        if (generationComplete) return; timedOut = true; clearInterval(poll); setLoading(false);
        await videoRefund(t("errors.timedOut"));
      }, timeoutMs);
    } catch (e) { setError(t("errors.generic")); setLoading(false); }
  };

  const handleDownload = async (url: string, isImg = false) => {
    try {
      const r = await fetch(url); const b = await r.blob();
      const bu = window.URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = bu; a.download = "klipflowai-" + Date.now() + (isImg ? ".png" : ".mp4");
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(bu);
    } catch { window.open(url, "_blank"); }
  };

  const resetForm = () => {
    setActiveModule(null); setPrompt(""); setError(""); setVideoUrl(null);
    setImageFile(null); setImagePreview(""); setImageUrlInput(""); setUseUrl(false);
    setProgress(0); setElapsedTime(0); setSelectedModel("kling-v1-6-pro");
    setExpandedPrompt(""); setGeneratedScript(""); setScriptTopic("");
    setS2vScript(""); setS2vScenes([]); setS2vStep("input"); setS2vCurrentScene(0);
    setS2vModelPhoto(""); setS2vModelPhotoFile(null); setS2vModelDesc(""); setS2vSceneStyles({}); setS2vSceneDuration("10");
    setVtFile(null); setVtDuration(0); setVtSourceLang("English"); setVtTargetLang("Spanish"); setVtStep("input"); setVtElapsed(0); setVtVideoUrl(null);
  };

  const goBackToModules = () => { resetForm(); router.replace("/dashboard/studio"); };
  const isBusy = loading || vtBusy || s2vStep === "generating" || remixBusy || swapBusy || clonerBusy || reelsBusy;

  // Open the module named in the URL (sidebar links) and apply any prompt or
  // template handed over from the homepage.
  useEffect(() => {
    const pending = takePendingGeneration();
    const target = getStudioModule(pending?.module ?? urlModule)?.id;
    if (!target) {
      // Syncing from an external source (the URL), which is what effects are for
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!urlModule && !isBusy) setActiveModule(null);
      return;
    }
    if (!pending && target === activeModuleRef.current) return;
    if (isBusy) {
      // Don't abandon a running generation; keep the URL on the current module
      router.replace(activeModuleRef.current ? studioHref(activeModuleRef.current as StudioModuleId) : "/dashboard/studio");
      return;
    }
    resetForm();
    setActiveModule(target);
    if (pending) {
      if (pending.prompt) {
        if (target === "script_to_video") setS2vScript(pending.prompt);
        else if (target === "script") setScriptTopic(pending.prompt);
        else setPrompt(pending.prompt);
      }
      if (pending.model && ALL_MODELS.some((m) => m.id === pending.model)) setSelectedModel(pending.model);
      if (pending.aspect_ratio) { setAspectRatio(pending.aspect_ratio); setS2vAspectRatio(pending.aspect_ratio); }
      if (pending.duration && ["5", "8", "10", "15"].includes(pending.duration)) setDuration(pending.duration);
      const lang = ACTOR_SWAP_LANGUAGES.find((l) => l.code === pending.language);
      if (lang) setOutputLang({ language: lang.code, accent: lang.accents.includes(pending.accent ?? "") ? pending.accent! : lang.accents[0] });
      if (target !== urlModule) router.replace(studioHref(target));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlModule]);

  const currentModel = ALL_MODELS.find((m) => m.id === selectedModel);
  const durationMultiplier = duration === "5" ? 1 : duration === "8" ? 1.6 : duration === "10" ? 2 : duration === "15" ? 3 : 1;
  const baseTokens = tokenPricing[selectedModel] ?? currentModel?.tokens ?? 10;
  const tokenCost = Math.ceil(baseTokens * durationMultiplier);
  const needsImage = activeModule === "image_to_video" || activeModule === "ugc_ad" || activeModule === "text_to_image" || activeModule === "image_ad";
  const showModels = activeModule === "text_to_video" || activeModule === "image_to_video" || activeModule === "ugc_ad" || activeModule === "ai_actor";
  // Image Ad and Text to Image both produce images (Image Ad adds ad framing and an optional headline)
  const isImageModule = activeModule === "text_to_image" || activeModule === "image_ad";
  const isImageAd = activeModule === "image_ad";
  const isPromptModule = activeModule === "prompt";
  const isScriptModule = activeModule === "script";
  const isS2VModule = activeModule === "script_to_video";
  const isVTModule = activeModule === "video_translator";
  const isRemixModule = activeModule === "video_remix";
  const isSwapModule = activeModule === "ai_actor_swap";
  const isClonerModule = activeModule === "series_cloner";
  const isReelsModule = activeModule === "faceless_reels";

  // Charged per minute of source video, prorated, with a minimum of one minute's worth
  const vtTokensPerMinute = tokenPricing["video_translation"] ?? 20;
  const vtTokenCost = Math.max(vtTokensPerMinute, Math.ceil((vtDuration / 60) * vtTokensPerMinute));
  const vtProgress = vtStep === "done" ? 100 : vtStep === "uploading" ? 5 : Math.min(95, 10 + (vtElapsed / VT_MAX_SECONDS) * 85);

  const s2vModelData = AUDIO_MODELS.find(m => m.id === s2vModel);
  const s2vTokensPerScene = tokenPricing[s2vModel] ?? s2vModelData?.tokens ?? 15;
  const s2vTotalTokens = s2vScenes.length * s2vTokensPerScene;

  return (
    <div className={"space-y-4 mx-auto " + (activeModule ? "max-w-2xl" : "max-w-5xl")}>
      {!activeModule && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("pickerTitle")}</h1>
          <p className="text-ink-muted text-sm mt-1">{t("pickerSubtitle")}</p>
        </div>
      )}

      <div className="bg-surface border border-line rounded-xl p-3 ps-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Coins size={18} className="text-accent-text flex-shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-ink font-medium text-sm">{c("tokens", { count: tokenBalance })}</p>
            {activeModule && <p className="text-ink-subtle text-xs truncate">{isVTModule ? t("header.translator", { rate: vtTokensPerMinute }) : isSwapModule ? t("header.actorSwap") : isClonerModule ? t("cards.series_cloner.title") : isReelsModule ? t("cards.faceless_reels.title") : t("header.model", { model: currentModel?.name ?? "", cost: tokenCost })}</p>}
          </div>
        </div>
        <a href="/dashboard/billing" className="inline-flex items-center h-9 px-4 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors flex-shrink-0">{t("topUp")}</a>
      </div>

      {!activeModule && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {visibleModules.map((mod) => {
            const Icon = getStudioModule(mod.id)?.icon;
            return (
              <button key={mod.id} onClick={() => router.push(studioHref(mod.id as StudioModuleId))} className="text-start bg-surface border border-line rounded-2xl p-4 hover:border-line-strong hover:bg-raised transition-colors">
                <div className="flex items-start justify-between gap-2 mb-3">
                  {Icon && <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent-text"><Icon size={20} aria-hidden /></span>}
                  {mod.badge && <span className="bg-white/[0.06] text-ink-muted text-[11px] font-medium px-2 py-0.5 rounded-full">{mod.badge}</span>}
                </div>
                <h3 className="font-medium text-[15px] text-ink mb-1">{mod.title}</h3>
                <p className="text-ink-muted text-xs leading-relaxed">{mod.desc}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* ---- PROMPT EXPANDER ---- */}
      {isPromptModule && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={goBackToModules} className="inline-flex items-center gap-1 h-9 ps-2 pe-3 rounded-lg border border-line bg-raised text-ink text-sm hover:border-line-strong transition-colors"><ChevronLeft size={16} className="rtl:-scale-x-100" aria-hidden /> {c("allTools")}</button>
            <h2 className="font-semibold text-base">{t("cards.prompt.title")}</h2>
          </div>
          <div className="bg-surface border border-line rounded-2xl p-5 space-y-5">
            <div className="bg-accent/[0.07] border border-accent/25 rounded-xl p-3.5">
              <p className="text-accent-text text-xs font-semibold mb-1">{t("freeNoTokens")}</p>
              <p className="text-ink-muted text-xs">{t("expander.intro")}</p>
            </div>
            <div>
              <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">{t("expander.idea")}</label>
              <textarea placeholder={t("expander.ideaPlaceholder")} value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-4 py-3 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm resize-none" />
            </div>
            <PromptTranslateBanner text={prompt} onTextChange={setPrompt} target={outputLang} />
            <LanguageAccentSelector label={t("outputLanguage")} value={outputLang} onChange={setOutputLang} />
            <div>
              <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">{t("expander.format")}</label>
              <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm">
                <option value="16:9">{t("expander.formatWide")}</option>
                <option value="9:16">{t("expander.formatVertical")}</option>
                <option value="1:1">{t("expander.formatSquare")}</option>
              </select>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={handleExpandPrompt} disabled={expandLoading} className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition">
              {expandLoading ? t("expander.expanding") : t("expander.submit")}
            </button>
            {expandedPrompt && (
              <div className="space-y-3">
                <div className="bg-canvas border border-line rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-emerald-400 text-xs font-semibold">{t("expander.result")}</p>
                    <button onClick={() => navigator.clipboard.writeText(expandedPrompt)} className="text-ink-muted hover:text-white text-xs transition">{t("copy")}</button>
                  </div>
                  <p className="text-ink text-sm leading-relaxed">{expandedPrompt}</p>
                </div>
                <button onClick={() => { setPrompt(expandedPrompt); setActiveModule("text_to_video"); setExpandedPrompt(""); router.replace(studioHref("text_to_video")); }} className="w-full bg-raised hover:bg-raised-hover border border-line text-white font-semibold py-2.5 rounded-xl transition text-sm">
                  {t("expander.useIt")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- SCRIPT WRITER ---- */}
      {isScriptModule && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={goBackToModules} className="inline-flex items-center gap-1 h-9 ps-2 pe-3 rounded-lg border border-line bg-raised text-ink text-sm hover:border-line-strong transition-colors"><ChevronLeft size={16} className="rtl:-scale-x-100" aria-hidden /> {c("allTools")}</button>
            <h2 className="font-semibold text-base">{t("cards.script.title")}</h2>
          </div>
          <div className="bg-surface border border-line rounded-2xl p-5 space-y-5">
            <div className="bg-accent/[0.07] border border-accent/25 rounded-xl p-3.5">
              <p className="text-accent-text text-xs font-semibold mb-1">{t("freeNoTokens")}</p>
              <p className="text-ink-muted text-xs">{t("writer.intro")}</p>
            </div>
            <div>
              <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">{t("writer.topic")}</label>
              <textarea placeholder={t("writer.topicPlaceholder")} value={scriptTopic} onChange={(e) => setScriptTopic(e.target.value)} rows={3} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-4 py-3 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm resize-none" />
            </div>
            <PromptTranslateBanner text={scriptTopic} onTextChange={setScriptTopic} target={outputLang} />
            <LanguageAccentSelector label={t("outputLanguage")} value={outputLang} onChange={setOutputLang} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">{t("writer.platform")}</label>
                <select value={scriptPlatform} onChange={(e) => setScriptPlatform(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm">
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">{t("writer.instagram")}</option>
                  <option value="youtube">{t("writer.youtube")}</option>
                  <option value="facebook">Facebook</option>
                </select>
              </div>
              <div>
                <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">{t("writer.length")}</label>
                <select value={scriptDuration} onChange={(e) => setScriptDuration(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm">
                  <option value="15">{t("sec15")}</option>
                  <option value="30">{t("sec30")}</option>
                  <option value="60">{t("sec60")}</option>
                  <option value="90">{t("sec90")}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">{t("writer.style")}</label>
              <select value={scriptFormat} onChange={(e) => setScriptFormat(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm">
                <option value="storytelling">{t("writer.storytelling")}</option>
                <option value="educational">{t("writer.educational")}</option>
                <option value="listicle">{t("writer.listicle")}</option>
                <option value="what-if">{t("writer.whatIf")}</option>
                <option value="ugc">{t("writer.ugc")}</option>
                <option value="motivation">{t("writer.motivation")}</option>
              </select>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={handleWriteScript} disabled={scriptLoading} className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition">
              {scriptLoading ? t("writer.writing") : t("writer.submit")}
            </button>
            {generatedScript && (
              <div className="space-y-3">
                <div className="bg-canvas border border-line rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-emerald-400 text-xs font-semibold">{t("writer.result")}</p>
                    <button onClick={() => navigator.clipboard.writeText(generatedScript)} className="text-ink-muted hover:text-white text-xs transition">{t("copy")}</button>
                  </div>
                  <pre className="text-ink text-xs leading-relaxed whitespace-pre-wrap">{generatedScript}</pre>
                </div>
                <button
                  onClick={() => { setS2vScript(generatedScript); setActiveModule("script_to_video"); setGeneratedScript(""); router.replace(studioHref("script_to_video")); }}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 rounded-xl transition text-sm"
                >
                  {t("writer.toVideo")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- SCRIPT TO VIDEO ---- */}
      {isS2VModule && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={goBackToModules} className="inline-flex items-center gap-1 h-9 ps-2 pe-3 rounded-lg border border-line bg-raised text-ink text-sm hover:border-line-strong transition-colors"><ChevronLeft size={16} className="rtl:-scale-x-100" aria-hidden /> {c("allTools")}</button>
            <h2 className="font-semibold text-base">{t("cards.script_to_video.title")}</h2>
            {s2vStep !== "input" && (
              <div className="ms-auto flex gap-2">
                {["input", "review", "generating", "done"].map((step, i) => (
                  <div key={step} className={"w-2 h-2 rounded-full " + (["input", "review", "generating", "done"].indexOf(s2vStep) >= i ? "bg-purple-500" : "bg-raised-hover")} />
                ))}
              </div>
            )}
          </div>

          {/* STEP 1 — Input */}
          {s2vStep === "input" && (
            <div className="bg-surface border border-line rounded-2xl p-5 space-y-5">
              <div className="bg-accent/[0.07] border border-accent/25 rounded-xl p-3.5">
                <p className="text-accent-text text-xs font-semibold mb-1">{t("howItWorks")}</p>
                <p className="text-ink-muted text-xs">{t("s2v.howItWorksDesc")}</p>
              </div>
              <div>
                <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">{t("writer.result")}</label>
                <textarea
                  placeholder={t("s2v.scriptPlaceholder")}
                  value={s2vScript} onChange={(e) => setS2vScript(e.target.value)} rows={8}
                  className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-4 py-3 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm resize-none"
                />
              </div>
              <div>
                <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">{t("s2v.format")}</label>
                <select value={s2vAspectRatio} onChange={(e) => setS2vAspectRatio(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm">
                  <option value="9:16">{t("s2v.formatVertical")}</option>
                  <option value="16:9">{t("s2v.formatWide")}</option>
                  <option value="1:1">{t("expander.formatSquare")}</option>
                </select>
              </div>
              <div className="border border-line rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-xs font-semibold">{t("s2v.photoTitle")}</p>
                    <p className="text-ink-subtle text-xs">{t("s2v.photoDesc")}</p>
                  </div>
                  <span className="text-ink-subtle text-xs">{t("optional")}</span>
                </div>
                <input type="file" accept="image/*" ref={s2vPhotoRef} onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setS2vModelPhotoFile(file);
                  setS2vModelPhoto("uploading");
                  const uploaded = await uploadImage(file);
                  if (uploaded) {
                    setS2vModelPhoto(uploaded);
                  } else {
                    setS2vModelPhoto("");
                    setError(t("errors.photoUploadFailed"));
                  }
                }} className="hidden" />
                {s2vModelPhoto === "uploading" ? (
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-xl bg-raised animate-pulse" />
                    <p className="text-ink-muted text-xs">{t("s2v.uploadingPhoto")}</p>
                  </div>
                ) : s2vModelPhoto ? (
                  <div className="flex items-center gap-3">
                    <img src={s2vModelPhoto} alt={t("s2v.modelAlt")} className="w-16 h-16 rounded-xl object-cover" />
                    <div>
                      <p className="text-emerald-400 text-xs font-semibold mb-1">{t("s2v.photoUploaded")}</p>
                      <button onClick={() => { setS2vModelPhoto(""); setS2vModelPhotoFile(null); }} className="text-ink-subtle hover:text-white text-xs transition">{t("remove")}</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => s2vPhotoRef.current?.click()} className="w-full border border-dashed border-line-strong hover:border-accent/60 bg-canvas rounded-xl p-4 text-center transition">
                    <p className="text-ink-muted text-xs font-semibold">{t("s2v.uploadPhoto")}</p>
                    <p className="text-ink-subtle text-xs mt-1">{t("s2v.photoHint")}</p>
                  </button>
                )}
                <div>
                  <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">{t("s2v.describeModel")}</label>
                  <input type="text" placeholder={t("s2v.describePlaceholder")} value={s2vModelDesc} onChange={(e) => setS2vModelDesc(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-xs" />
                </div>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button onClick={handleSplitScenes} disabled={s2vSplitting} className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition">
                {s2vSplitting ? t("s2v.analyzing") : t("s2v.split")}
              </button>
            </div>
          )}

          {/* STEP 2 — Review scenes */}
          {s2vStep === "review" && (
            <div className="space-y-4">
              <div className="bg-surface border border-line rounded-2xl p-5 space-y-5">
                <div>
                  <p className="text-white font-semibold text-sm mb-1">{t("s2v.found", { count: s2vScenes.length })}</p>
                  <p className="text-ink-muted text-xs">{t("s2v.reviewHint")}</p>
                </div>
                <div className="space-y-3">
                  {s2vScenes.map((scene, i) => (
                    <div key={i} className="bg-canvas border border-line rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-purple-600 text-white text-xs font-semibold w-6 h-6 rounded-full flex items-center justify-center">{scene.scene_number}</span>
                        <span className="text-ink-muted text-xs font-semibold">{t("s2v.scene", { number: scene.scene_number })}</span>
                      </div>
                      <p className="text-ink-muted text-xs mb-2 italic">&ldquo;{scene.narration}&rdquo;</p>
                      <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">{t("s2v.visualPrompt")}</label>
                      <textarea
                        value={scene.visual_prompt}
                        onChange={(e) => {
                          const updated = [...s2vScenes];
                          updated[i] = { ...updated[i], visual_prompt: e.target.value };
                          setS2vScenes(updated);
                        }}
                        rows={3}
                        className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition resize-none"
                      />
                      <div className="mt-2">
                        <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">{t("s2v.styleOverride")}</label>
                        <input
                          type="text"
                          placeholder={t("s2v.stylePlaceholder")}
                          value={s2vSceneStyles[scene.scene_number] || ""}
                          onChange={(e) => setS2vSceneStyles({ ...s2vSceneStyles, [scene.scene_number]: e.target.value })}
                          className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="text-ink-muted text-[13px] font-medium mb-2 block">{t("s2v.modelLabel")}</label>
                  <div className="grid grid-cols-1 gap-2">
                    {AUDIO_MODELS.map((model) => (
                      <button key={model.id} onClick={() => setS2vModel(model.id)}
                        className={"p-3 rounded-xl border text-start transition " + (s2vModel === model.id ? "border-accent bg-accent/10" : "border-line bg-surface hover:border-line-strong")}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-xs">{model.name}</div>
                            <div className="text-ink-subtle text-xs">{model.desc}</div>
                          </div>
                          <div className="text-accent-text text-xs font-semibold">{t("s2v.perScene", { count: tokenPricing[model.id] ?? model.tokens })}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {s2vModelPhoto && (
                  <div className="bg-emerald-500/[0.07] border border-emerald-500/25 rounded-xl p-3 flex items-center gap-3">
                    <img src={s2vModelPhoto} alt={t("s2v.modelAlt")} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    <div>
                      <p className="text-emerald-400 text-xs font-semibold">{t("s2v.photoActive")}</p>
                      <p className="text-ink-subtle text-xs">{t("s2v.photoActiveDesc")}</p>
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-ink-muted text-[13px] font-medium mb-2 block">{t("s2v.duration")}</label>
                  <select value={s2vSceneDuration} onChange={(e) => setS2vSceneDuration(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm">
                    <option value="5">{t("s2v.d5")}</option>
                    <option value="8">{t("s2v.d8")}</option>
                    <option value="10">{t("s2v.d10")}</option>
                    <option value="15">{t("s2v.d15")}</option>
                  </select>
                </div>
                <div className="bg-amber-500/[0.07] border border-amber-500/25 rounded-xl p-3">
                  <p className="text-amber-300 text-xs font-semibold">{t("totalCost", { count: s2vTotalTokens })}</p>
                  <p className="text-ink-subtle text-xs">{t("s2v.costBreakdown", { scenes: s2vScenes.length, each: s2vTokensPerScene, balance: tokenBalance })}</p>
                </div>

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setS2vStep("input")} className="bg-raised hover:bg-raised-hover border border-line text-white font-semibold py-3 rounded-xl transition text-sm">{t("s2v.editScript")}</button>
                  <button onClick={handleGenerateScenes} disabled={tokenBalance < s2vTotalTokens} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition text-sm">
                    {t("s2v.generateAll", { count: s2vScenes.length })}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — Generating */}
          {s2vStep === "generating" && (
            <div className="bg-surface border border-line rounded-2xl p-6 space-y-5">
              <div className="text-center">
                <h3 className="font-semibold mb-1">{t("s2v.generatingTitle")}</h3>
                <p className="text-ink-muted text-sm">{t("s2v.progress", { current: s2vCurrentScene + 1, total: s2vScenes.length })}</p>
              </div>
              <div className="space-y-3">
                {s2vScenes.map((scene, i) => (
                  <div key={i} className="flex items-center gap-3 bg-canvas rounded-xl px-4 py-3">
                    <div className={"w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 " +
                      (scene.status === "done" ? "bg-green-600 text-white" :
                       scene.status === "generating" ? "bg-purple-600 text-white animate-pulse" :
                       scene.status === "failed" ? "bg-red-600 text-white" :
                       "bg-raised-hover text-ink-muted")}>
                      {scene.status === "done" ? <Check size={13} aria-hidden /> : scene.status === "failed" ? <X size={13} aria-hidden /> : scene.scene_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-ink truncate">{scene.narration}</p>
                    </div>
                    <span className={"text-xs font-semibold " +
                      (scene.status === "done" ? "text-emerald-400" :
                       scene.status === "generating" ? "text-purple-400" :
                       scene.status === "failed" ? "text-red-400" : "text-ink-subtle")}>
                      {scene.status === "done" ? t("status.done") : scene.status === "generating" ? t("status.generating") : scene.status === "failed" ? t("status.failed") : t("status.waiting")}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-ink-subtle text-xs text-center">{t("s2v.sceneTime")}</p>
            </div>
          )}

          {/* STEP 4 — Done */}
          {s2vStep === "done" && (
            <div className="space-y-4">
              <div className="bg-emerald-500/[0.07] border border-emerald-500/25 rounded-xl p-4">
                <p className="text-emerald-400 font-semibold mb-1">{t("s2v.allDone")}</p>
                <p className="text-ink-muted text-xs">{t("s2v.allDoneDesc")}</p>
              </div>
              <div className="space-y-4">
                {s2vScenes.map((scene, i) => (
                  <div key={i} className="bg-surface border border-line rounded-xl overflow-hidden">
                    <div className="px-4 py-2 border-b border-line flex items-center justify-between">
                      <span className="text-xs font-semibold text-accent-text">{t("s2v.scene", { number: scene.scene_number })}</span>
                      {scene.status === "done" && scene.video_url && (
                        <button onClick={() => handleDownload(scene.video_url!)} className="text-purple-400 hover:text-white text-xs transition font-semibold">{t("download")}</button>
                      )}
                      {scene.status === "failed" && <span className="text-red-400 text-xs">{t("status.failed")}</span>}
                    </div>
                    {scene.status === "done" && scene.video_url ? (
                      <video src={scene.video_url} controls playsInline className="w-full" />
                    ) : (
                      <div className="p-4 text-center text-ink-subtle text-sm">{t("s2v.sceneFailed")}</div>
                    )}
                    <div className="px-4 py-2">
                      <p className="text-ink-subtle text-xs italic">&ldquo;{scene.narration}&rdquo;</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setS2vStep("input"); setS2vScenes([]); setS2vScript(""); }} className="bg-raised hover:bg-raised-hover border border-line text-white font-semibold py-3 rounded-xl transition text-sm">{t("s2v.newScript")}</button>
                <button onClick={goBackToModules} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl transition text-sm">{t("backToStudio")}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- AI VIDEO TRANSLATOR ---- */}
      {isVTModule && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {!vtBusy && <button onClick={goBackToModules} className="inline-flex items-center gap-1 h-9 ps-2 pe-3 rounded-lg border border-line bg-raised text-ink text-sm hover:border-line-strong transition-colors"><ChevronLeft size={16} className="rtl:-scale-x-100" aria-hidden /> {c("allTools")}</button>}
            <h2 className="font-semibold text-base">{t("cards.video_translator.title")}</h2>
          </div>

          {settingsLoaded && enabledKeys["heygen_enabled"] !== true && vtStep === "input" && (
            <div className="bg-surface border border-line rounded-xl p-6 text-center">
              <p className="text-ink font-medium mb-1">{t("vt.unavailable")}</p>
              <p className="text-ink-muted text-sm">{t("vt.unavailableDesc")}</p>
            </div>
          )}

          {settingsLoaded && enabledKeys["heygen_enabled"] === true && vtStep === "input" && (
            <div className="bg-surface border border-line rounded-2xl p-5 space-y-5">
              <div className="bg-accent/[0.07] border border-accent/25 rounded-xl p-3.5">
                <p className="text-accent-text text-xs font-semibold mb-1">{t("howItWorks")}</p>
                <p className="text-ink-muted text-xs">{t("vt.howItWorksDesc", { rate: vtTokensPerMinute })}</p>
              </div>
              <div>
                <input type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" ref={vtFileRef} onChange={handleVtFile} className="hidden" />
                <div onClick={() => vtFileRef.current?.click()} className="border border-dashed border-line-strong hover:border-accent/60 bg-canvas rounded-xl p-6 text-center cursor-pointer transition">
                  {vtFile ? (
                    <div>
                      <p className="text-emerald-400 text-sm font-semibold mb-1 truncate">{vtFile.name}</p>
                      <p className="text-ink-subtle text-xs">{t("vt.fileInfo", { time: formatTime(Math.round(vtDuration)), size: (vtFile.size / (1024 * 1024)).toFixed(1) })}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-ink-muted text-sm font-semibold mb-1">{t("vt.upload")}</p>
                      <p className="text-ink-subtle text-xs">{t("vt.uploadHint")}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">{t("vt.source")}</label>
                  <select value={vtSourceLang} onChange={(e) => { const lang = e.target.value; setVtSourceLang(lang); if (lang === vtTargetLang) setVtTargetLang(VT_LANGUAGES.find((l) => l !== lang) ?? ""); }} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm">
                    {VT_LANGUAGES.map((lang) => <option key={lang} value={lang}>{vtLabel(lang)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">{t("vt.target")}</label>
                  <select value={vtTargetLang} onChange={(e) => setVtTargetLang(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm">
                    {VT_LANGUAGES.filter((lang) => lang !== vtSourceLang).map((lang) => <option key={lang} value={lang}>{vtLabel(lang)}</option>)}
                  </select>
                </div>
              </div>
              {vtFile && (
                <div className="bg-amber-500/[0.07] border border-amber-500/25 rounded-xl p-3">
                  <p className="text-amber-300 text-xs font-semibold">{t("totalCost", { count: vtTokenCost })}</p>
                  <p className="text-ink-subtle text-xs">{t("vt.costBreakdown", { minutes: (vtDuration / 60).toFixed(1), rate: vtTokensPerMinute, balance: tokenBalance })}</p>
                </div>
              )}
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button onClick={handleTranslateVideo} disabled={!vtFile || vtSourceLang === vtTargetLang || tokenBalance < vtTokenCost} className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition">
                {vtFile ? t("vt.translateCost", { count: vtTokenCost }) : t("vt.translate")}
              </button>
            </div>
          )}

          {vtBusy && (
            <div className="bg-surface border border-line rounded-2xl p-6 space-y-5">
              <div className="text-center">
                <h3 className="font-semibold mb-1">{t("vt.translatingTitle")}</h3>
                <p className="text-ink-muted text-sm">{vtStep === "uploading" ? t("vt.uploading") : t("vt.translating", { from: vtLabel(vtSourceLang), to: vtLabel(vtTargetLang) })}</p>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-ink-subtle mb-2">
                  <span>{t("percentComplete", { percent: Math.round(vtProgress) })}</span>
                  <span>{t("elapsed", { time: formatTime(vtElapsed) })}</span>
                </div>
                <div className="w-full h-2 bg-white/[0.07] rounded-full overflow-hidden">
                  <div className={"h-full bg-accent rounded-full transition-all duration-1000" + (vtStep === "uploading" ? " animate-pulse" : "")} style={{ width: vtProgress + "%" }} />
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { label: t("steps.reserved"), done: true },
                  { label: t("vt.stepUploaded"), done: vtStep === "translating" },
                  { label: t("vt.stepSpeech"), done: false },
                  { label: t("vt.stepLipsync"), done: false },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={step.done ? "text-emerald-400" : "text-ink-subtle"}>{step.done ? <CheckCircle2 size={15} aria-hidden /> : <Circle size={15} aria-hidden />}</span>
                    <span className={step.done ? "text-ink" : "text-ink-subtle"}>{step.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-ink-subtle text-xs text-center">{t("vt.keepOpen")}</p>
            </div>
          )}

          {vtStep === "done" && vtVideoUrl && (
            <div className="bg-surface border border-line rounded-2xl p-5 space-y-5">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-semibold">{t("done")}</span>
                <h3 className="font-semibold">{t("vt.ready", { language: vtLabel(vtTargetLang) })}</h3>
              </div>
              <video src={vtVideoUrl} controls playsInline className="w-full rounded-xl" />
              <p className="text-ink-subtle text-xs">{t("savedToGallery")}</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleDownload(vtVideoUrl)} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl transition text-sm">{t("saveVideo")}</button>
                <button onClick={() => { setVtStep("input"); setVtVideoUrl(null); setVtElapsed(0); }} className="bg-raised hover:bg-raised-hover border border-line text-white font-semibold py-3 rounded-xl transition text-sm">{t("vt.another")}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- VIDEO / IMAGE MODULES ---- */}
      {isRemixModule && (
        <VideoRemix
          tokenBalance={tokenBalance}
          setTokenBalance={setTokenBalance}
          tokenPricing={tokenPricing}
          enabledKeys={enabledKeys}
          settingsLoaded={settingsLoaded}
          onBack={goBackToModules}
          onBusyChange={setRemixBusy}
        />
      )}

      {isSwapModule && (
        <ActorSwap
          tokenBalance={tokenBalance}
          setTokenBalance={setTokenBalance}
          tokenPricing={tokenPricing}
          enabledKeys={enabledKeys}
          settingsLoaded={settingsLoaded}
          onBack={goBackToModules}
          onBusyChange={setSwapBusy}
        />
      )}

      {isClonerModule && (
        <SeriesCloner
          tokenBalance={tokenBalance}
          setTokenBalance={setTokenBalance}
          tokenPricing={tokenPricing}
          enabledKeys={enabledKeys}
          settingsLoaded={settingsLoaded}
          onBack={goBackToModules}
          onBusyChange={setClonerBusy}
        />
      )}

      {isReelsModule && (
        <FacelessReels
          tokenBalance={tokenBalance}
          setTokenBalance={setTokenBalance}
          tokenPricing={tokenPricing}
          enabledKeys={enabledKeys}
          settingsLoaded={settingsLoaded}
          onBack={goBackToModules}
          onBusyChange={setReelsBusy}
        />
      )}

      {activeModule && !isPromptModule && !isScriptModule && !isS2VModule && !isVTModule && !isRemixModule && !isSwapModule && !isClonerModule && !isReelsModule && !loading && !videoUrl && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={goBackToModules} className="inline-flex items-center gap-1 h-9 ps-2 pe-3 rounded-lg border border-line bg-raised text-ink text-sm hover:border-line-strong transition-colors"><ChevronLeft size={16} className="rtl:-scale-x-100" aria-hidden /> {c("allTools")}</button>
            <h2 className="font-semibold text-base">{modules.find((m) => m.id === activeModule)?.title}</h2>
          </div>
          <div className="bg-surface border border-line rounded-2xl p-5 space-y-5">
            {needsImage && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => setUseUrl(false)} className={"px-3 py-1.5 rounded-xl text-xs font-semibold transition " + (!useUrl ? "bg-purple-600 text-white" : "bg-raised text-ink-muted")}>{t("gen.uploadImage")}</button>
                  <button onClick={() => setUseUrl(true)} className={"px-3 py-1.5 rounded-xl text-xs font-semibold transition " + (useUrl ? "bg-purple-600 text-white" : "bg-raised text-ink-muted")}>{t("gen.useUrl")}</button>
                </div>
                {!useUrl ? (
                  <div>
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageFile} className="hidden" />
                    <div onClick={() => fileInputRef.current?.click()} className="border border-dashed border-line-strong hover:border-accent/60 bg-canvas rounded-xl p-6 text-center cursor-pointer transition">
                      {imagePreview ? <img src={imagePreview} alt={t("gen.preview")} className="max-h-40 mx-auto rounded-lg object-contain" /> : <div><p className="text-ink-muted text-sm font-semibold mb-1">{t("gen.clickUpload")}</p><p className="text-ink-subtle text-xs">{t("gen.uploadHint")}</p></div>}
                    </div>
                    {imageFile && <p className="text-emerald-400 text-xs">{t("gen.fileReady", { name: imageFile.name })}</p>}
                  </div>
                ) : (
                  <div>
                    <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">{t("gen.imageUrl")}</label>
                    <input type="url" placeholder="https://example.com/image.jpg" value={imageUrlInput} onChange={(e) => setImageUrlInput(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-4 py-3 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm" />
                  </div>
                )}
              </div>
            )}
            {activeModule === "ugc_ad" && (
              <div className="bg-accent/[0.07] border border-accent/25 rounded-xl p-3.5">
                <p className="text-accent-text text-xs font-semibold mb-1">{t("gen.ugcMode")}</p>
                <p className="text-ink-muted text-xs">{t("gen.ugcModeDesc")}</p>
              </div>
            )}
            {isImageModule && (
              <>
                <div className="bg-accent/[0.07] border border-accent/25 rounded-xl p-3.5">
                  <p className="text-accent-text text-xs font-semibold mb-1">{isImageAd ? t("gen.productPhoto") : t("gen.referenceImage")}</p>
                  <p className="text-ink-muted text-xs">{isImageAd ? t("gen.productPhotoDesc") : t("gen.referenceDesc")}</p>
                </div>
                <div>
                  <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">{t("gen.aspect")}</label>
                  <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm">
                    <option value="16:9">{t("gen.landscape")}</option>
                    <option value="9:16">{t("gen.portrait")}</option>
                    <option value="1:1">{t("gen.square")}</option>
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">
                {activeModule === "ugc_ad" ? t("gen.describeUgc") : isImageAd ? t("gen.describeAd") : activeModule === "text_to_image" ? t("gen.describeImage") : t("gen.describeVideo")}
              </label>
              <textarea
                placeholder={activeModule === "ugc_ad" ? t("gen.placeholderUgc") : isImageAd ? t("gen.placeholderAd") : activeModule === "text_to_image" ? t("gen.placeholderImage") : t("gen.placeholderVideo")}
                value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4}
                className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-4 py-3 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm resize-none"
              />
            </div>
            {isImageAd && (
              <div>
                <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">{t("gen.headline")}</label>
                <input type="text" maxLength={80} value={adHeadline} onChange={(e) => setAdHeadline(e.target.value)} placeholder={t("gen.headlinePlaceholder")} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-4 py-3 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm" />
                <p className="text-ink-subtle text-xs mt-1">{t("gen.headlineHint")}</p>
              </div>
            )}
            <PromptTranslateBanner text={prompt} onTextChange={setPrompt} target={outputLang} />
            <LanguageAccentSelector label={t("outputLanguage")} value={outputLang} onChange={setOutputLang} />
            {showModels && (
              <>
                <div>
                  <label className="text-ink-muted text-[13px] font-medium mb-2 block">{t("gen.model")}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {visibleModels.map((model) => (
                      <button key={model.id} onClick={() => model.available && setSelectedModel(model.id)} disabled={!model.available}
                        className={"p-3 rounded-xl border text-start transition " + (selectedModel === model.id ? "border-accent bg-accent/10" : model.available ? "border-line bg-surface hover:border-line-strong" : "border-line/60 opacity-40 cursor-not-allowed")}
                      >
                        <div className="flex flex-wrap gap-1 mb-1">
                          {(modelBadges[model.id] ? modelBadges[model.id].split(",").map(b => b.trim()).filter(Boolean) : model.badges ?? (model.badge ? [model.badge] : [])).map((b, bi) => (
                            <div key={bi} className={"text-xs font-semibold px-1.5 py-0.5 rounded-full inline-block " + (model.available ? "bg-white/[0.06] text-ink-muted" : "bg-white/[0.04] text-ink-subtle")}>{b}</div>
                          ))}
                        </div>
                        <div className="font-semibold text-xs mb-0.5">{modelLabels[model.id] || model.name}</div>
                        <div className="text-ink-subtle text-xs">{t("gen.modelCost", { count: tokenPricing[model.id] ?? model.tokens, desc: modelDescs[model.id] || model.desc })}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">{t("gen.duration")}</label>
                    <select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm">
                      <option value="5">{t("sec5")}</option>
                      <option value="8">{t("sec8")}</option>
                      <option value="10">{t("sec10")}</option>
                      {(selectedModel === "kling-v3-std" || selectedModel === "kling-v3-pro") && <option value="15">{t("sec15")}</option>}
                    </select>
                  </div>
                  <div>
                    <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">{t("gen.aspect")}</label>
                    <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm">
                      <option value="16:9">{t("s2v.formatWide")}</option>
                      <option value="9:16">{t("gen.tiktok")}</option>
                      <option value="1:1">{t("gen.feed")}</option>
                    </select>
                  </div>
                </div>
                {currentModel?.hasSound && (
                  <div className="bg-emerald-500/[0.07] border border-emerald-500/25 rounded-xl px-4 py-3">
                    <p className="text-emerald-400 text-xs font-semibold">{t("gen.nativeAudio", { model: currentModel.name })}</p>
                    <p className="text-ink-subtle text-xs">{t("gen.nativeAudioDesc")}</p>
                  </div>
                )}
              </>
            )}
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={handleGenerate} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition">
              {isImageModule ? t(isImageAd ? "gen.generateAdCost" : "gen.generateImageCost", { count: tokenPricing["text_to_image"] ?? 2 }) : t("gen.generateCost", { count: tokenCost })}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-surface border border-line rounded-2xl p-6 space-y-5">
          <div className="text-center">
            <h3 className="font-semibold mb-1">{isImageModule ? t("gen.generatingImage") : t("gen.generatingVideo")}</h3>
            <p className="text-ink-muted text-sm">{getStatusMsg(elapsedTime)}</p>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-ink-subtle mb-2">
              <span>{t("percentComplete", { percent: Math.round(progress) })}</span>
              <span>{t("elapsed", { time: formatTime(elapsedTime) })}</span>
            </div>
            <div className="w-full h-2 bg-white/[0.07] rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all duration-1000" style={{ width: progress + "%" }} />
            </div>
          </div>
          <div className="space-y-2">
            {[
              { label: t("steps.initialized"), done: elapsedTime >= 10 },
              { label: t("steps.analyzed"), done: elapsedTime >= 30 },
              { label: isImageModule ? t("steps.imageFrames") : t("steps.videoFrames"), done: elapsedTime >= 60 },
              { label: t("steps.details"), done: elapsedTime >= 120 },
              { label: isImageModule ? t("steps.imageFinal") : t("steps.videoFinal"), done: !!videoUrl },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={step.done ? "text-emerald-400" : "text-ink-subtle"}>{step.done ? <CheckCircle2 size={15} aria-hidden /> : <Circle size={15} aria-hidden />}</span>
                <span className={step.done ? "text-ink" : "text-ink-subtle"}>{step.label}</span>
              </div>
            ))}
          </div>
          <p className="text-ink-subtle text-xs text-center">
            {isImageModule ? t("gen.keepOpenImage") : t("gen.keepOpenVideo")}
          </p>
        </div>
      )}

      {videoUrl && (
        <div className="bg-surface border border-line rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-semibold">{t("done")}</span>
            <h3 className="font-semibold">{isImageModule ? t("result.imageReady") : t("result.videoReady")}</h3>
          </div>
          {isImageModule ? <img src={videoUrl} alt={t("result.generatedImage")} className="w-full rounded-xl" /> : <video src={videoUrl} controls playsInline className="w-full rounded-xl" />}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => handleDownload(videoUrl, isImageModule)} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl transition text-sm">{isImageModule ? t("result.saveImage") : t("saveVideo")}</button>
            <button onClick={goBackToModules} className="bg-raised hover:bg-raised-hover border border-line text-white font-semibold py-3 rounded-xl transition text-sm">{t("result.another")}</button>
          </div>
          <div className="bg-raised border border-line rounded-xl p-3.5">
            <p className="text-ink text-xs font-semibold mb-1">{t("result.iphone")}</p>
            <p className="text-ink-muted text-xs">{isImageModule ? t("result.iphoneImage") : t("result.iphoneVideo")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={null}>
      <Studio />
    </Suspense>
  );
}
