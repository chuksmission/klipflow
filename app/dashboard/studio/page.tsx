"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, CheckCircle2, ChevronLeft, Circle, Coins, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { chargeTokens, refundCharge, refundNote } from "../../lib/token-client";
import VideoRemix from "./VideoRemix";
import ActorSwap from "./ActorSwap";
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
    { id: "kling-v3-std", name: "Kling 3.0 Standard", tokens: 15, desc: "Cinematic + native audio" },
    { id: "kling-v3-pro", name: "Kling 3.0 Pro",      tokens: 20, desc: "1080p cinematic + native audio" },
    { id: "veo3-fast",    name: "Veo 3.1 Fast",        tokens: 15, desc: "Google AI + native audio" },
  ];

  const VT_LANGUAGES = [
    "English", "Arabic", "Bulgarian", "Chinese", "Dutch", "French", "German", "Hindi",
    "Italian", "Japanese", "Korean", "Polish", "Portuguese", "Russian", "Spanish", "Turkish",
  ];
  const VT_MAX_BYTES = 500 * 1024 * 1024;
  const VT_MAX_SECONDS = 600; // 10 minute processing timeout

  const modules: Module[] = [
    { id: "text_to_video",   title: "Text to Video",    desc: "Generate cinematic videos from text descriptions", badge: "Most Popular" },
    { id: "image_to_video",  title: "Image to Video",   desc: "Animate any still image into a stunning video",    badge: "" },
    { id: "ugc_ad",          title: "UGC Ad Creator",   desc: "AI avatar testimonial and product review videos",  badge: "Best for Ads" },
    { id: "ai_actor",        title: "AI Actor",         desc: "Create photorealistic AI human avatars",           badge: "" },
    { id: "voice",           title: "Voice Generation", desc: "Natural AI voiceovers for videos",                 badge: "" },
    { id: "text_to_image",   title: "Text to Image",    desc: "Generate images from text or reference photo",     badge: "2 Tokens" },
    { id: "script_to_video", title: "Script to Video",  desc: "Turn a script into multiple video scenes with audio", badge: "New" },
    { id: "video_remix",     title: "Video Remix",      desc: "Restyle, recreate or recast any video",           badge: "New" },
    { id: "ai_actor_swap",   title: "AI Actor Swap",    desc: "Give any video a new face, language and voice",   badge: "New" },
    { id: "video_translator", title: "AI Video Translator", desc: "Translate any video into another language with lip-sync", badge: "New" },
    { id: "image_ad",        title: "Image Ad",         desc: "Scroll-stopping image advertisements",             badge: "Cheapest" },
    { id: "prompt",          title: "Prompt Expander",  desc: "Transform simple ideas into cinematic prompts",    badge: "Free" },
    { id: "script",          title: "Script Writer",    desc: "Generate viral video scripts with AI",             badge: "Free" },
  ];

  // AI Video Translator only shows once HeyGen is enabled in Admin > AI Providers
  const visibleModules = modules.filter((mod) =>
    (mod.id !== "video_translator" || enabledKeys["heygen_enabled"] === true) &&
    (mod.id !== "video_remix" || enabledKeys["video_remix_enabled"] === true) &&
    (mod.id !== "ai_actor_swap" || enabledKeys["ai_actor_swap_enabled"] === true));

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
    if (e < 10) return "Initializing AI models...";
    if (e < 30) return "Analyzing your prompt...";
    if (e < 60) return "Generating video frames...";
    if (e < 120) return "Rendering cinematic details...";
    return "Almost ready, finalizing...";
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
    if (!prompt) { setError("Please enter a simple idea to expand."); return; }
    setExpandLoading(true); setError(""); setExpandedPrompt("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Please sign in."); setExpandLoading(false); return; }
      const res = await fetch("/api/expand-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ idea: prompt, aspect_ratio: aspectRatio }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to expand prompt."); setExpandLoading(false); return; }
      setExpandedPrompt(data.prompt);
    } catch { setError("Something went wrong."); }
    setExpandLoading(false);
  };

  // ---- SCRIPT WRITER ----
  const handleWriteScript = async () => {
    if (!scriptTopic) { setError("Please enter a topic."); return; }
    setScriptLoading(true); setError(""); setGeneratedScript("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Please sign in."); setScriptLoading(false); return; }
      const res = await fetch("/api/write-script", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ topic: scriptTopic, format: scriptFormat, platform: scriptPlatform, duration: scriptDuration }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to write script."); setScriptLoading(false); return; }
      setGeneratedScript(data.script);
    } catch { setError("Something went wrong."); }
    setScriptLoading(false);
  };

  // ---- SCRIPT TO VIDEO: Split into scenes ----
  const handleSplitScenes = async () => {
    if (!s2vScript.trim()) { setError("Please enter or paste your script."); return; }
    setS2vSplitting(true); setError(""); setS2vScenes([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Please sign in."); setS2vSplitting(false); return; }
      const res = await fetch("/api/script-to-scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ script: s2vScript, aspect_ratio: s2vAspectRatio, model_description: s2vModelDesc || undefined, scene_styles: s2vSceneStyles }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to split script."); setS2vSplitting(false); return; }
      setS2vScenes(data.scenes.map((s: Scene) => ({ ...s, status: "pending" })));
      setS2vStep("review");
    } catch { setError("Something went wrong."); }
    setS2vSplitting(false);
  };

  // ---- SCRIPT TO VIDEO: Generate all scenes ----
  const handleGenerateScenes = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Please sign in."); return; }

    const modelData = AUDIO_MODELS.find(m => m.id === s2vModel);
    const tokenCostPerScene = tokenPricing[s2vModel] ?? modelData?.tokens ?? 15;
    const totalCost = tokenCostPerScene * s2vScenes.length;

    if (tokenBalance < totalCost) {
      setError(`Insufficient tokens. Need ${totalCost} tokens for ${s2vScenes.length} scenes. You have ${tokenBalance}.`);
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
    if (!["mp4", "mov", "webm"].includes(ext)) { setError("Please upload an MP4, MOV or WebM video."); return; }
    if (file.size > VT_MAX_BYTES) { setError("Video is too large. Maximum size is 500MB."); return; }
    const seconds = await readVideoDuration(file);
    if (!seconds) { setError("Couldn't read this video's length. Try converting it to MP4."); return; }
    setVtFile(file); setVtDuration(seconds);
  };

  // HeyGen translations are slower than generations, so poll every 10s for up to 10 minutes
  const pollForTranslation = (taskId: string): Promise<{ videoUrl: string | null; reason: string }> => {
    return new Promise((resolve) => {
      const maxAttempts = VT_MAX_SECONDS / 10;
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) { clearInterval(poll); resolve({ videoUrl: null, reason: "Translation timed out." }); return; }
        try {
          const sr = await fetch(`/api/video-status?task_id=${encodeURIComponent(taskId)}&provider=heygen`);
          const sd = await sr.json();
          if (sd.completed && sd.video_url) { clearInterval(poll); resolve({ videoUrl: sd.video_url, reason: "" }); }
          else if (sd.failed) { clearInterval(poll); resolve({ videoUrl: null, reason: sd.fail_reason ?? "Translation failed." }); }
        } catch { /* continue polling */ }
      }, 10000);
    });
  };

  const handleTranslateVideo = async () => {
    if (!vtFile || !vtDuration) { setError("Please upload a video."); return; }
    if (vtSourceLang === vtTargetLang) { setError("Target language must be different from the source language."); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Please sign in."); return; }
    const cost = vtTokenCost;
    if (tokenBalance < cost) { setError(`Insufficient tokens. Need ${cost} tokens. You have ${tokenBalance}.`); return; }

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
      if (!uploadedUrl) { await refund("Video upload failed."); return; }

      setVtStep("translating");
      const res = await fetch("/api/translate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ video_url: uploadedUrl, source_language: vtSourceLang, target_language: vtTargetLang, charge_id: chargeId }),
      });
      const data = await res.json() as { task_id?: string; error?: string };
      if (!res.ok || !data.task_id) { await refund(data.error ?? "Failed to start translation."); return; }

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
              charge_id: chargeId,
            }),
          });
        }
      } catch (e) { console.error("Save error:", e); }
    } catch (e) {
      console.error("Video translation error:", e);
      if (charged) await refund("Something went wrong.");
      else { setError("Something went wrong."); setVtStep("input"); }
    }
  };

  // ---- IMAGE GENERATION ----
  const handleGenerateImage = async () => {
    setLoading(true); setError(""); setVideoUrl(null); setProgress(0);
    const tokenCostImg = tokenPricing["text_to_image"] ?? 2;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Please sign in."); setLoading(false); return; }
      const charge = await chargeTokens(tokenCostImg, "text_to_image");
      if (!charge.ok) { setError(charge.error); setLoading(false); return; }
      setTokenBalance(charge.balance);
      const chargeId = charge.chargeId;
      const imgRefund = async (message: string) => { const r = await refundCharge(chargeId); if (r.balance !== undefined) setTokenBalance(r.balance); setError(message + refundNote(r)); };
      let refImageUrl = imageUrlInput;
      if (imageFile && !useUrl) { const uploaded = await uploadImage(imageFile); if (uploaded) refImageUrl = uploaded; }
      const imgAspectRatio = aspectRatio === "9:16" ? "2:3" : aspectRatio === "1:1" ? "1:1" : "3:2";
      const res = await fetch("/api/generate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, image_url: refImageUrl || undefined, aspect_ratio: imgAspectRatio, charge_id: chargeId }) });
      const data = await res.json() as { task_id?: string; error?: string };
      if (!res.ok || !data.task_id) { setLoading(false); await imgRefund(data.error ?? "Failed to start generation."); return; }
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
              if (fs) { await fetch("/api/generations", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + fs.access_token }, body: JSON.stringify({ type: "text_to_image", prompt, image_url: sd.video_url, output_type: "image", status: "completed", tokens_used: tokenCostImg, charge_id: chargeId }) }); }
            } catch (e) { console.error("Save error:", e); }
          } else if (sd.failed) {
            setLoading(false); clearInterval(poll);
            await imgRefund("Generation failed.");
          }
        } catch (e) { console.error("Poll error:", e); }
      }, 5000);
      void generationComplete;
    } catch (e) { setError("Something went wrong."); setLoading(false); }
  };

  // ---- VIDEO GENERATION ----
  const handleGenerate = async () => {
    if (!prompt) { setError("Please enter a prompt."); return; }
    if (activeModule === "text_to_image") { await handleGenerateImage(); return; }
    const needsImage = activeModule === "image_to_video" || activeModule === "ugc_ad";
    if (needsImage && !imageFile && !imageUrlInput) { setError("Please upload an image or enter an image URL."); return; }
    setLoading(true); setError(""); setVideoUrl(null); setProgress(0);
    const modelData = ALL_MODELS.find((m) => m.id === selectedModel);
    const tokenCost = tokenPricing[selectedModel] ?? modelData?.tokens ?? 10;
    const provider = modelData?.provider ?? "kie";
    tokenCostRef.current = tokenCost; providerRef.current = provider;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Please sign in."); setLoading(false); return; }
      const charge = await chargeTokens(tokenCost, activeModule ?? "text_to_video");
      if (!charge.ok) { setError(charge.error); setLoading(false); return; }
      setTokenBalance(charge.balance);
      const chargeId = charge.chargeId;
      const videoRefund = async (message: string) => { const r = await refundCharge(chargeId); if (r.balance !== undefined) setTokenBalance(r.balance); setError(message + refundNote(r)); };
      let imageUrl = imageUrlInput;
      if (needsImage && imageFile && !useUrl) {
        const uploaded = await uploadImage(imageFile);
        if (!uploaded) { setLoading(false); await videoRefund("Image upload failed. Try URL instead."); return; }
        imageUrl = uploaded;
      }
      const capturedModule = activeModuleRef.current;
      const capturedModel = selectedModelRef.current;
      const capturedCost = tokenCostRef.current;
      const capturedProvider = providerRef.current;
      const capturedMode = needsImage ? "image_to_video" : "text_to_video";
      const useAudio = modelData?.hasSound === true;
      const res = await fetch("/api/generate-video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, mode: capturedMode, image_url: imageUrl || undefined, duration: String(duration), aspect_ratio: aspectRatio, model: selectedModel, with_audio: useAudio, charge_id: chargeId }) });
      const data = await res.json() as { task_id?: string; error?: string; provider?: string };
      if (!res.ok || !data.task_id) { setLoading(false); await videoRefund(data.error ?? "Failed to start generation."); return; }
      const genProvider = data.provider ?? capturedProvider;
      let timedOut = false; let generationComplete = false; let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const poll = setInterval(async () => {
        try {
          const sr = await fetch("/api/video-status?task_id=" + data.task_id + "&mode=" + capturedMode + "&provider=" + genProvider);
          const sd = await sr.json() as { completed?: boolean; failed?: boolean; video_url?: string };
          if (sd.completed && sd.video_url) {
            if (timedOut) return; generationComplete = true; clearTimeout(timeoutHandle);
            setVideoUrl(sd.video_url); setProgress(100); setLoading(false); clearInterval(poll);
            try { const { data: { session: fs } } = await supabase.auth.getSession(); if (fs) { await fetch("/api/generations", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + fs.access_token }, body: JSON.stringify({ type: capturedModule, prompt, video_url: sd.video_url, status: "completed", tokens_used: capturedCost, duration, aspect_ratio: aspectRatio, model: capturedModel, charge_id: chargeId }) }); } } catch (e) { console.error("Save error:", e); }
          } else if (sd.failed) {
            setLoading(false); clearInterval(poll);
            await videoRefund("Generation failed.");
          }
        } catch (e) { console.error("Poll error:", e); }
      }, 5000);
      const timeoutMs = ["veo3-fast", "veo3-quality", "sora-2", "seedance-2", "seedance-2-fast"].includes(selectedModel) ? 600000 : 300000;
      timeoutHandle = setTimeout(async () => {
        if (generationComplete) return; timedOut = true; clearInterval(poll); setLoading(false);
        await videoRefund("Generation timed out.");
      }, timeoutMs);
    } catch (e) { setError("Something went wrong."); setLoading(false); }
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
  const isBusy = loading || vtBusy || s2vStep === "generating" || remixBusy || swapBusy;

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
      if (target !== urlModule) router.replace(studioHref(target));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlModule]);

  const currentModel = ALL_MODELS.find((m) => m.id === selectedModel);
  const durationMultiplier = duration === "5" ? 1 : duration === "8" ? 1.6 : duration === "10" ? 2 : duration === "15" ? 3 : 1;
  const baseTokens = tokenPricing[selectedModel] ?? currentModel?.tokens ?? 10;
  const tokenCost = Math.ceil(baseTokens * durationMultiplier);
  const needsImage = activeModule === "image_to_video" || activeModule === "ugc_ad" || activeModule === "text_to_image";
  const showModels = activeModule === "text_to_video" || activeModule === "image_to_video" || activeModule === "ugc_ad" || activeModule === "ai_actor";
  const isImageModule = activeModule === "text_to_image";
  const isPromptModule = activeModule === "prompt";
  const isScriptModule = activeModule === "script";
  const isS2VModule = activeModule === "script_to_video";
  const isVTModule = activeModule === "video_translator";
  const isRemixModule = activeModule === "video_remix";
  const isSwapModule = activeModule === "ai_actor_swap";

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
          <h1 className="text-2xl font-semibold tracking-tight">What do you want to create?</h1>
          <p className="text-ink-muted text-sm mt-1">Every plan includes every tool.</p>
        </div>
      )}

      <div className="bg-surface border border-line rounded-xl p-3 pl-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Coins size={18} className="text-accent-text flex-shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-ink font-medium text-sm">{tokenBalance} tokens</p>
            {activeModule && <p className="text-ink-subtle text-xs truncate">{isVTModule ? `Video Translator · ${vtTokensPerMinute} tokens per minute` : isSwapModule ? "AI Actor Swap · billed per second of video" : `${currentModel?.name ?? ""} · ${tokenCost} tokens`}</p>}
          </div>
        </div>
        <a href="/dashboard/billing" className="inline-flex items-center h-9 px-4 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors flex-shrink-0">Top up</a>
      </div>

      {!activeModule && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {visibleModules.map((mod) => {
            const Icon = getStudioModule(mod.id)?.icon;
            return (
              <button key={mod.id} onClick={() => router.push(studioHref(mod.id as StudioModuleId))} className="text-left bg-surface border border-line rounded-2xl p-4 hover:border-line-strong hover:bg-raised transition-colors">
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
            <button onClick={goBackToModules} className="inline-flex items-center gap-1 h-9 pl-2 pr-3 rounded-lg border border-line bg-raised text-ink text-sm hover:border-line-strong transition-colors"><ChevronLeft size={16} aria-hidden /> All tools</button>
            <h2 className="font-semibold text-base">Prompt Expander</h2>
          </div>
          <div className="bg-surface border border-line rounded-2xl p-5 space-y-5">
            <div className="bg-accent/[0.07] border border-accent/25 rounded-xl p-3.5">
              <p className="text-accent-text text-xs font-semibold mb-1">Free — no tokens required</p>
              <p className="text-ink-muted text-xs">Type a simple idea and AI transforms it into a detailed cinematic prompt.</p>
            </div>
            <div>
              <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">Your simple idea</label>
              <textarea placeholder="e.g. cat playing piano, sunset over mountains, product showcase..." value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-4 py-3 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm resize-none" />
            </div>
            <div>
              <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">Target Format</label>
              <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm">
                <option value="16:9">16:9 YouTube / Widescreen</option>
                <option value="9:16">9:16 TikTok / Reels / Shorts</option>
                <option value="1:1">1:1 Square Feed</option>
              </select>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={handleExpandPrompt} disabled={expandLoading} className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition">
              {expandLoading ? "Expanding..." : "Expand Prompt — Free"}
            </button>
            {expandedPrompt && (
              <div className="space-y-3">
                <div className="bg-canvas border border-line rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-emerald-400 text-xs font-semibold">Expanded Prompt</p>
                    <button onClick={() => navigator.clipboard.writeText(expandedPrompt)} className="text-ink-muted hover:text-white text-xs transition">Copy</button>
                  </div>
                  <p className="text-ink text-sm leading-relaxed">{expandedPrompt}</p>
                </div>
                <button onClick={() => { setPrompt(expandedPrompt); setActiveModule("text_to_video"); setExpandedPrompt(""); router.replace(studioHref("text_to_video")); }} className="w-full bg-raised hover:bg-raised-hover border border-line text-white font-semibold py-2.5 rounded-xl transition text-sm">
                  Use this prompt to generate a video →
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
            <button onClick={goBackToModules} className="inline-flex items-center gap-1 h-9 pl-2 pr-3 rounded-lg border border-line bg-raised text-ink text-sm hover:border-line-strong transition-colors"><ChevronLeft size={16} aria-hidden /> All tools</button>
            <h2 className="font-semibold text-base">Script Writer</h2>
          </div>
          <div className="bg-surface border border-line rounded-2xl p-5 space-y-5">
            <div className="bg-accent/[0.07] border border-accent/25 rounded-xl p-3.5">
              <p className="text-accent-text text-xs font-semibold mb-1">Free — no tokens required</p>
              <p className="text-ink-muted text-xs">AI writes a complete viral script with hook, body, and call to action.</p>
            </div>
            <div>
              <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">Video Topic</label>
              <textarea placeholder="e.g. 5 signs your gut health is ruined, how I made $10k with AI..." value={scriptTopic} onChange={(e) => setScriptTopic(e.target.value)} rows={3} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-4 py-3 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">Platform</label>
                <select value={scriptPlatform} onChange={(e) => setScriptPlatform(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm">
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram Reels</option>
                  <option value="youtube">YouTube Shorts</option>
                  <option value="facebook">Facebook</option>
                </select>
              </div>
              <div>
                <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">Video Length</label>
                <select value={scriptDuration} onChange={(e) => setScriptDuration(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm">
                  <option value="15">15 seconds</option>
                  <option value="30">30 seconds</option>
                  <option value="60">60 seconds</option>
                  <option value="90">90 seconds</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">Script Style</label>
              <select value={scriptFormat} onChange={(e) => setScriptFormat(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm">
                <option value="storytelling">Storytelling</option>
                <option value="educational">Educational / How-to</option>
                <option value="listicle">Listicle (Top 5...)</option>
                <option value="what-if">What If / Hypothetical</option>
                <option value="ugc">UGC / Testimonial</option>
                <option value="motivation">Motivational</option>
              </select>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={handleWriteScript} disabled={scriptLoading} className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition">
              {scriptLoading ? "Writing Script..." : "Write Script — Free"}
            </button>
            {generatedScript && (
              <div className="space-y-3">
                <div className="bg-canvas border border-line rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-emerald-400 text-xs font-semibold">Your Script</p>
                    <button onClick={() => navigator.clipboard.writeText(generatedScript)} className="text-ink-muted hover:text-white text-xs transition">Copy</button>
                  </div>
                  <pre className="text-ink text-xs leading-relaxed whitespace-pre-wrap">{generatedScript}</pre>
                </div>
                <button
                  onClick={() => { setS2vScript(generatedScript); setActiveModule("script_to_video"); setGeneratedScript(""); router.replace(studioHref("script_to_video")); }}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 rounded-xl transition text-sm"
                >
                  Turn this script into a video →
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
            <button onClick={goBackToModules} className="inline-flex items-center gap-1 h-9 pl-2 pr-3 rounded-lg border border-line bg-raised text-ink text-sm hover:border-line-strong transition-colors"><ChevronLeft size={16} aria-hidden /> All tools</button>
            <h2 className="font-semibold text-base">Script to Video</h2>
            {s2vStep !== "input" && (
              <div className="ml-auto flex gap-2">
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
                <p className="text-accent-text text-xs font-semibold mb-1">How it works</p>
                <p className="text-ink-muted text-xs">Paste your script → AI splits it into 3-5 scenes → Review visual prompts → Generate all videos with native audio</p>
              </div>
              <div>
                <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">Your Script</label>
                <textarea
                  placeholder="Paste your script here, or write it directly. AI will split it into scenes automatically..."
                  value={s2vScript} onChange={(e) => setS2vScript(e.target.value)} rows={8}
                  className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-4 py-3 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm resize-none"
                />
              </div>
              <div>
                <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">Video Format</label>
                <select value={s2vAspectRatio} onChange={(e) => setS2vAspectRatio(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm">
                  <option value="9:16">9:16 TikTok / Reels (Recommended)</option>
                  <option value="16:9">16:9 YouTube</option>
                  <option value="1:1">1:1 Square Feed</option>
                </select>
              </div>
              <div className="border border-line rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-xs font-semibold">Model / Creator Photo</p>
                    <p className="text-ink-subtle text-xs">Optional — upload a photo to use the same person in all scenes</p>
                  </div>
                  <span className="text-ink-subtle text-xs">Optional</span>
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
                    setError("Photo upload failed. Please try again.");
                  }
                }} className="hidden" />
                {s2vModelPhoto === "uploading" ? (
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-xl bg-raised animate-pulse" />
                    <p className="text-ink-muted text-xs">Uploading photo...</p>
                  </div>
                ) : s2vModelPhoto ? (
                  <div className="flex items-center gap-3">
                    <img src={s2vModelPhoto} alt="Model" className="w-16 h-16 rounded-xl object-cover" />
                    <div>
                      <p className="text-emerald-400 text-xs font-semibold mb-1">Photo uploaded</p>
                      <button onClick={() => { setS2vModelPhoto(""); setS2vModelPhotoFile(null); }} className="text-ink-subtle hover:text-white text-xs transition">Remove</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => s2vPhotoRef.current?.click()} className="w-full border border-dashed border-line-strong hover:border-accent/60 bg-canvas rounded-xl p-4 text-center transition">
                    <p className="text-ink-muted text-xs font-semibold">Click to upload model photo</p>
                    <p className="text-ink-subtle text-xs mt-1">JPG, PNG — face clearly visible</p>
                  </button>
                )}
                <div>
                  <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">Describe your model (helps AI stay consistent)</label>
                  <input type="text" placeholder="e.g. Young African woman, natural hair, warm smile, casual style" value={s2vModelDesc} onChange={(e) => setS2vModelDesc(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-xs" />
                </div>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button onClick={handleSplitScenes} disabled={s2vSplitting} className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition">
                {s2vSplitting ? "AI is analyzing your script..." : "Split into Scenes →"}
              </button>
            </div>
          )}

          {/* STEP 2 — Review scenes */}
          {s2vStep === "review" && (
            <div className="space-y-4">
              <div className="bg-surface border border-line rounded-2xl p-5 space-y-5">
                <div>
                  <p className="text-white font-semibold text-sm mb-1">AI found {s2vScenes.length} scenes</p>
                  <p className="text-ink-muted text-xs">Review and edit the visual prompts before generating. Each scene is 5 seconds.</p>
                </div>
                <div className="space-y-3">
                  {s2vScenes.map((scene, i) => (
                    <div key={i} className="bg-canvas border border-line rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-purple-600 text-white text-xs font-semibold w-6 h-6 rounded-full flex items-center justify-center">{scene.scene_number}</span>
                        <span className="text-ink-muted text-xs font-semibold">Scene {scene.scene_number}</span>
                      </div>
                      <p className="text-ink-muted text-xs mb-2 italic">"{scene.narration}"</p>
                      <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">Visual Prompt (editable)</label>
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
                        <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">Scene Style Override (optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. red dress, braided hair, outdoor garden"
                          value={s2vSceneStyles[scene.scene_number] || ""}
                          onChange={(e) => setS2vSceneStyles({ ...s2vSceneStyles, [scene.scene_number]: e.target.value })}
                          className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="text-ink-muted text-[13px] font-medium mb-2 block">AI Model (audio models only)</label>
                  <div className="grid grid-cols-1 gap-2">
                    {AUDIO_MODELS.map((model) => (
                      <button key={model.id} onClick={() => setS2vModel(model.id)}
                        className={"p-3 rounded-xl border text-left transition " + (s2vModel === model.id ? "border-accent bg-accent/10" : "border-line bg-surface hover:border-line-strong")}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-xs">{model.name}</div>
                            <div className="text-ink-subtle text-xs">{model.desc}</div>
                          </div>
                          <div className="text-accent-text text-xs font-semibold">{tokenPricing[model.id] ?? model.tokens} tokens/scene</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {s2vModelPhoto && (
                  <div className="bg-emerald-500/[0.07] border border-emerald-500/25 rounded-xl p-3 flex items-center gap-3">
                    <img src={s2vModelPhoto} alt="Model" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    <div>
                      <p className="text-emerald-400 text-xs font-semibold">Model photo active</p>
                      <p className="text-ink-subtle text-xs">Your model will appear in all scenes</p>
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-ink-muted text-[13px] font-medium mb-2 block">Scene Duration</label>
                  <select value={s2vSceneDuration} onChange={(e) => setS2vSceneDuration(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm">
                    <option value="5">5 seconds — short hook</option>
                    <option value="8">8 seconds — standard</option>
                    <option value="10">10 seconds — recommended for dialogue</option>
                    <option value="15">15 seconds — long dialogue (Kling 3.0 only)</option>
                  </select>
                </div>
                <div className="bg-amber-500/[0.07] border border-amber-500/25 rounded-xl p-3">
                  <p className="text-amber-300 text-xs font-semibold">Total cost: {s2vTotalTokens} tokens</p>
                  <p className="text-ink-subtle text-xs">{s2vScenes.length} scenes × {s2vTokensPerScene} tokens each • You have {tokenBalance} tokens</p>
                </div>

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setS2vStep("input")} className="bg-raised hover:bg-raised-hover border border-line text-white font-semibold py-3 rounded-xl transition text-sm">← Edit Script</button>
                  <button onClick={handleGenerateScenes} disabled={tokenBalance < s2vTotalTokens} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition text-sm">
                    Generate {s2vScenes.length} Videos →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — Generating */}
          {s2vStep === "generating" && (
            <div className="bg-surface border border-line rounded-2xl p-6 space-y-5">
              <div className="text-center">
                <h3 className="font-semibold mb-1">Generating Your Videos</h3>
                <p className="text-ink-muted text-sm">Scene {s2vCurrentScene + 1} of {s2vScenes.length} — please keep this page open</p>
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
                      {scene.status === "done" ? "Done" : scene.status === "generating" ? "Generating..." : scene.status === "failed" ? "Failed" : "Waiting"}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-ink-subtle text-xs text-center">Each scene takes 1-3 minutes. Do not close this page.</p>
            </div>
          )}

          {/* STEP 4 — Done */}
          {s2vStep === "done" && (
            <div className="space-y-4">
              <div className="bg-emerald-500/[0.07] border border-emerald-500/25 rounded-xl p-4">
                <p className="text-emerald-400 font-semibold mb-1">All scenes generated</p>
                <p className="text-ink-muted text-xs">Your videos have been saved to the Gallery. Download each scene below.</p>
              </div>
              <div className="space-y-4">
                {s2vScenes.map((scene, i) => (
                  <div key={i} className="bg-surface border border-line rounded-xl overflow-hidden">
                    <div className="px-4 py-2 border-b border-line flex items-center justify-between">
                      <span className="text-xs font-semibold text-accent-text">Scene {scene.scene_number}</span>
                      {scene.status === "done" && scene.video_url && (
                        <button onClick={() => handleDownload(scene.video_url!)} className="text-purple-400 hover:text-white text-xs transition font-semibold">Download</button>
                      )}
                      {scene.status === "failed" && <span className="text-red-400 text-xs">Failed</span>}
                    </div>
                    {scene.status === "done" && scene.video_url ? (
                      <video src={scene.video_url} controls playsInline className="w-full" />
                    ) : (
                      <div className="p-4 text-center text-ink-subtle text-sm">Generation failed for this scene</div>
                    )}
                    <div className="px-4 py-2">
                      <p className="text-ink-subtle text-xs italic">"{scene.narration}"</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setS2vStep("input"); setS2vScenes([]); setS2vScript(""); }} className="bg-raised hover:bg-raised-hover border border-line text-white font-semibold py-3 rounded-xl transition text-sm">New Script</button>
                <button onClick={goBackToModules} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl transition text-sm">Back to Studio</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- AI VIDEO TRANSLATOR ---- */}
      {isVTModule && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {!vtBusy && <button onClick={goBackToModules} className="inline-flex items-center gap-1 h-9 pl-2 pr-3 rounded-lg border border-line bg-raised text-ink text-sm hover:border-line-strong transition-colors"><ChevronLeft size={16} aria-hidden /> All tools</button>}
            <h2 className="font-semibold text-base">AI Video Translator</h2>
          </div>

          {settingsLoaded && enabledKeys["heygen_enabled"] !== true && vtStep === "input" && (
            <div className="bg-surface border border-line rounded-xl p-6 text-center">
              <p className="text-ink font-medium mb-1">Video Translator isn&apos;t available yet</p>
              <p className="text-ink-muted text-sm">It&apos;s coming soon. In the meantime, try another tool.</p>
            </div>
          )}

          {settingsLoaded && enabledKeys["heygen_enabled"] === true && vtStep === "input" && (
            <div className="bg-surface border border-line rounded-2xl p-5 space-y-5">
              <div className="bg-accent/[0.07] border border-accent/25 rounded-xl p-3.5">
                <p className="text-accent-text text-xs font-semibold mb-1">How it works</p>
                <p className="text-ink-muted text-xs">Upload a video → pick a language → AI translates the speech, clones the voice and lip-syncs the speaker. {vtTokensPerMinute} tokens per minute of video.</p>
              </div>
              <div>
                <input type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" ref={vtFileRef} onChange={handleVtFile} className="hidden" />
                <div onClick={() => vtFileRef.current?.click()} className="border border-dashed border-line-strong hover:border-accent/60 bg-canvas rounded-xl p-6 text-center cursor-pointer transition">
                  {vtFile ? (
                    <div>
                      <p className="text-emerald-400 text-sm font-semibold mb-1 truncate">{vtFile.name}</p>
                      <p className="text-ink-subtle text-xs">{formatTime(Math.round(vtDuration))} • {(vtFile.size / (1024 * 1024)).toFixed(1)}MB • Click to change</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-ink-muted text-sm font-semibold mb-1">Click to upload video</p>
                      <p className="text-ink-subtle text-xs">MP4, MOV, WebM up to 500MB</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">Source Language</label>
                  <select value={vtSourceLang} onChange={(e) => { const lang = e.target.value; setVtSourceLang(lang); if (lang === vtTargetLang) setVtTargetLang(VT_LANGUAGES.find((l) => l !== lang) ?? ""); }} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm">
                    {VT_LANGUAGES.map((lang) => <option key={lang} value={lang}>{lang}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">Target Language</label>
                  <select value={vtTargetLang} onChange={(e) => setVtTargetLang(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm">
                    {VT_LANGUAGES.filter((lang) => lang !== vtSourceLang).map((lang) => <option key={lang} value={lang}>{lang}</option>)}
                  </select>
                </div>
              </div>
              {vtFile && (
                <div className="bg-amber-500/[0.07] border border-amber-500/25 rounded-xl p-3">
                  <p className="text-amber-300 text-xs font-semibold">Total cost: {vtTokenCost} tokens</p>
                  <p className="text-ink-subtle text-xs">{(vtDuration / 60).toFixed(1)} min × {vtTokensPerMinute} tokens/min (minimum {vtTokensPerMinute}) • You have {tokenBalance} tokens</p>
                </div>
              )}
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button onClick={handleTranslateVideo} disabled={!vtFile || vtSourceLang === vtTargetLang || tokenBalance < vtTokenCost} className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition">
                {vtFile ? `Translate Video — ${vtTokenCost} tokens` : "Translate Video"}
              </button>
            </div>
          )}

          {vtBusy && (
            <div className="bg-surface border border-line rounded-2xl p-6 space-y-5">
              <div className="text-center">
                <h3 className="font-semibold mb-1">Translating Your Video</h3>
                <p className="text-ink-muted text-sm">{vtStep === "uploading" ? "Uploading your video..." : `Translating ${vtSourceLang} → ${vtTargetLang} with lip-sync...`}</p>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-ink-subtle mb-2">
                  <span>{Math.round(vtProgress)}% complete</span>
                  <span>{formatTime(vtElapsed)} elapsed</span>
                </div>
                <div className="w-full h-2 bg-white/[0.07] rounded-full overflow-hidden">
                  <div className={"h-full bg-accent rounded-full transition-all duration-1000" + (vtStep === "uploading" ? " animate-pulse" : "")} style={{ width: vtProgress + "%" }} />
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { label: "Tokens reserved", done: true },
                  { label: "Video uploaded", done: vtStep === "translating" },
                  { label: "Translating speech and cloning voice", done: false },
                  { label: "Lip-syncing and rendering", done: false },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={step.done ? "text-emerald-400" : "text-ink-subtle"}>{step.done ? <CheckCircle2 size={15} aria-hidden /> : <Circle size={15} aria-hidden />}</span>
                    <span className={step.done ? "text-ink" : "text-ink-subtle"}>{step.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-ink-subtle text-xs text-center">Keep this page open. Translation can take several minutes (up to 10). Tokens are refunded automatically if it fails.</p>
            </div>
          )}

          {vtStep === "done" && vtVideoUrl && (
            <div className="bg-surface border border-line rounded-2xl p-5 space-y-5">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-semibold">Done!</span>
                <h3 className="font-semibold">Your {vtTargetLang} Video is Ready</h3>
              </div>
              <video src={vtVideoUrl} controls playsInline className="w-full rounded-xl" />
              <p className="text-ink-subtle text-xs">Saved to your Gallery.</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleDownload(vtVideoUrl)} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl transition text-sm">Save Video</button>
                <button onClick={() => { setVtStep("input"); setVtVideoUrl(null); setVtElapsed(0); }} className="bg-raised hover:bg-raised-hover border border-line text-white font-semibold py-3 rounded-xl transition text-sm">Translate Another</button>
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

      {activeModule && !isPromptModule && !isScriptModule && !isS2VModule && !isVTModule && !isRemixModule && !isSwapModule && !loading && !videoUrl && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={goBackToModules} className="inline-flex items-center gap-1 h-9 pl-2 pr-3 rounded-lg border border-line bg-raised text-ink text-sm hover:border-line-strong transition-colors"><ChevronLeft size={16} aria-hidden /> All tools</button>
            <h2 className="font-semibold text-base">{modules.find((m) => m.id === activeModule)?.title}</h2>
          </div>
          <div className="bg-surface border border-line rounded-2xl p-5 space-y-5">
            {needsImage && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => setUseUrl(false)} className={"px-3 py-1.5 rounded-xl text-xs font-semibold transition " + (!useUrl ? "bg-purple-600 text-white" : "bg-raised text-ink-muted")}>Upload Image</button>
                  <button onClick={() => setUseUrl(true)} className={"px-3 py-1.5 rounded-xl text-xs font-semibold transition " + (useUrl ? "bg-purple-600 text-white" : "bg-raised text-ink-muted")}>Use URL</button>
                </div>
                {!useUrl ? (
                  <div>
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageFile} className="hidden" />
                    <div onClick={() => fileInputRef.current?.click()} className="border border-dashed border-line-strong hover:border-accent/60 bg-canvas rounded-xl p-6 text-center cursor-pointer transition">
                      {imagePreview ? <img src={imagePreview} alt="Preview" className="max-h-40 mx-auto rounded-lg object-contain" /> : <div><p className="text-ink-muted text-sm font-semibold mb-1">Click to upload image</p><p className="text-ink-subtle text-xs">JPG, PNG, WebP up to 10MB</p></div>}
                    </div>
                    {imageFile && <p className="text-emerald-400 text-xs">{imageFile.name} ready</p>}
                  </div>
                ) : (
                  <div>
                    <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">Image URL</label>
                    <input type="url" placeholder="https://example.com/image.jpg" value={imageUrlInput} onChange={(e) => setImageUrlInput(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-4 py-3 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm" />
                  </div>
                )}
              </div>
            )}
            {activeModule === "ugc_ad" && (
              <div className="bg-accent/[0.07] border border-accent/25 rounded-xl p-3.5">
                <p className="text-accent-text text-xs font-semibold mb-1">UGC Ad Mode</p>
                <p className="text-ink-muted text-xs">Upload a photo of your avatar for the most realistic AI UGC ads.</p>
              </div>
            )}
            {isImageModule && (
              <>
                <div className="bg-accent/[0.07] border border-accent/25 rounded-xl p-3.5">
                  <p className="text-accent-text text-xs font-semibold mb-1">Reference Image (Optional)</p>
                  <p className="text-ink-muted text-xs">Upload a reference image to generate variations or repurpose existing visuals.</p>
                </div>
                <div>
                  <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">Aspect Ratio</label>
                  <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm">
                    <option value="16:9">16:9 Landscape</option>
                    <option value="9:16">9:16 Portrait / Reels</option>
                    <option value="1:1">1:1 Square</option>
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">
                {activeModule === "ugc_ad" ? "Describe the UGC ad scenario" : activeModule === "text_to_image" ? "Describe the image you want" : "Describe your video"}
              </label>
              <textarea
                placeholder={activeModule === "ugc_ad" ? "Woman in kitchen holding product, smiling, authentic testimonial style..." : activeModule === "text_to_image" ? "A photorealistic portrait of a woman in golden hour light, cinematic, sharp details..." : "A luxury watch rotating slowly on a marble surface, golden hour lighting, cinematic 4K..."}
                value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4}
                className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-4 py-3 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm resize-none"
              />
            </div>
            {showModels && (
              <>
                <div>
                  <label className="text-ink-muted text-[13px] font-medium mb-2 block">AI Model</label>
                  <div className="grid grid-cols-2 gap-2">
                    {visibleModels.map((model) => (
                      <button key={model.id} onClick={() => model.available && setSelectedModel(model.id)} disabled={!model.available}
                        className={"p-3 rounded-xl border text-left transition " + (selectedModel === model.id ? "border-accent bg-accent/10" : model.available ? "border-line bg-surface hover:border-line-strong" : "border-line/60 opacity-40 cursor-not-allowed")}
                      >
                        <div className="flex flex-wrap gap-1 mb-1">
                          {(modelBadges[model.id] ? modelBadges[model.id].split(",").map(b => b.trim()).filter(Boolean) : model.badges ?? (model.badge ? [model.badge] : [])).map((b, bi) => (
                            <div key={bi} className={"text-xs font-semibold px-1.5 py-0.5 rounded-full inline-block " + (model.available ? "bg-white/[0.06] text-ink-muted" : "bg-white/[0.04] text-ink-subtle")}>{b}</div>
                          ))}
                        </div>
                        <div className="font-semibold text-xs mb-0.5">{modelLabels[model.id] || model.name}</div>
                        <div className="text-ink-subtle text-xs">{tokenPricing[model.id] ?? model.tokens} tokens — {modelDescs[model.id] || model.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">Duration</label>
                    <select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm">
                      <option value="5">5 seconds</option>
                      <option value="8">8 seconds</option>
                      <option value="10">10 seconds</option>
                      {(selectedModel === "kling-v3-std" || selectedModel === "kling-v3-pro") && <option value="15">15 seconds</option>}
                    </select>
                  </div>
                  <div>
                    <label className="text-ink-muted text-[13px] font-medium mb-1.5 block">Aspect Ratio</label>
                    <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm">
                      <option value="16:9">16:9 YouTube</option>
                      <option value="9:16">9:16 TikTok / Reels</option>
                      <option value="1:1">1:1 Feed</option>
                    </select>
                  </div>
                </div>
                {currentModel?.hasSound && (
                  <div className="bg-emerald-500/[0.07] border border-emerald-500/25 rounded-xl px-4 py-3">
                    <p className="text-emerald-400 text-xs font-semibold">Native audio included with {currentModel.name}</p>
                    <p className="text-ink-subtle text-xs">Sound, dialogue and ambient audio generated automatically</p>
                  </div>
                )}
              </>
            )}
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={handleGenerate} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition">
              {isImageModule ? `Generate Image — ${tokenPricing["text_to_image"] ?? 2} tokens` : `Generate — ${tokenCost} tokens`}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-surface border border-line rounded-2xl p-6 space-y-5">
          <div className="text-center">
            <h3 className="font-semibold mb-1">{isImageModule ? "Generating Your Image" : "Generating Your Video"}</h3>
            <p className="text-ink-muted text-sm">{getStatusMsg(elapsedTime)}</p>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-ink-subtle mb-2">
              <span>{Math.round(progress)}% complete</span>
              <span>{formatTime(elapsedTime)} elapsed</span>
            </div>
            <div className="w-full h-2 bg-white/[0.07] rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all duration-1000" style={{ width: progress + "%" }} />
            </div>
          </div>
          <div className="space-y-2">
            {[
              { label: "AI models initialized", done: elapsedTime >= 10 },
              { label: "Prompt analyzed", done: elapsedTime >= 30 },
              { label: isImageModule ? "Image frames generated" : "Video frames generated", done: elapsedTime >= 60 },
              { label: "Details rendered", done: elapsedTime >= 120 },
              { label: isImageModule ? "Image finalized" : "Video finalized", done: !!videoUrl },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={step.done ? "text-emerald-400" : "text-ink-subtle"}>{step.done ? <CheckCircle2 size={15} aria-hidden /> : <Circle size={15} aria-hidden />}</span>
                <span className={step.done ? "text-ink" : "text-ink-subtle"}>{step.label}</span>
              </div>
            ))}
          </div>
          <p className="text-ink-subtle text-xs text-center">
            {isImageModule ? "Keep this page open. Image generation may take several minutes." : "Keep this page open. Average: 1-3 minutes."}
          </p>
        </div>
      )}

      {videoUrl && (
        <div className="bg-surface border border-line rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-semibold">Done!</span>
            <h3 className="font-semibold">{isImageModule ? "Your Image is Ready" : "Your Video is Ready"}</h3>
          </div>
          {isImageModule ? <img src={videoUrl} alt="Generated image" className="w-full rounded-xl" /> : <video src={videoUrl} controls playsInline className="w-full rounded-xl" />}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => handleDownload(videoUrl, isImageModule)} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl transition text-sm">{isImageModule ? "Save Image" : "Save Video"}</button>
            <button onClick={goBackToModules} className="bg-raised hover:bg-raised-hover border border-line text-white font-semibold py-3 rounded-xl transition text-sm">Generate Another</button>
          </div>
          <div className="bg-raised border border-line rounded-xl p-3.5">
            <p className="text-ink text-xs font-semibold mb-1">iPhone users</p>
            <p className="text-ink-muted text-xs">Tap and hold the {isImageModule ? "image" : "video"}, then select Save to Photos.</p>
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
