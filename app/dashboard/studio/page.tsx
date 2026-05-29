"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";

interface Model {
  id: string;
  name: string;
  desc: string;
  tokens: number;
  badge: string;
  badges?: string[];
  available: boolean;
  provider: string;
  hasSound: boolean;
  enabledKey: string;
}

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

export default function Studio() {
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const tokenCostRef = useRef(10);
  const selectedModelRef = useRef("kling-v1-6-pro");
  const activeModuleRef = useRef<string | null>(null);
  const providerRef = useRef("kie");

  useEffect(() => { selectedModelRef.current = selectedModel; }, [selectedModel]);
  useEffect(() => { activeModuleRef.current = activeModule; }, [activeModule]);

  const ALL_MODELS: Model[] = [
    { id: "kling-v1-6-std",  name: "Kling 1.6 Standard", desc: "Fast, great for drafts",               tokens: 8,   badge: "",                available: true,  provider: "kie", hasSound: false, enabledKey: "kling_v1_6_enabled" },
    { id: "kling-v1-6-pro",  name: "Kling 1.6 Pro",      desc: "High quality, smooth motion",           tokens: 10,  badge: "Recommended",     available: true,  provider: "kie", hasSound: false, enabledKey: "kling_v1_6_enabled" },
    { id: "kling-v2-master", name: "Kling 2.1 Master",   desc: "Best realism and motion",               tokens: 20,  badge: "Best Quality",    available: true,  provider: "kie", hasSound: false, enabledKey: "kling_v2_master_enabled" },
    { id: "kling-v3-std",    name: "Kling 3.0 Standard", desc: "Cinematic quality, audio, up to 15s",   tokens: 15,  badge: "Best Quality",    badges: ["Best Quality", "With Audio"], available: true, provider: "kie", hasSound: true, enabledKey: "kling_v3_enabled" },
    { id: "kling-v3-pro",    name: "Kling 3.0 Pro",      desc: "1080p cinematic, audio, multi-shot",    tokens: 20,  badge: "Ultra Quality",   badges: ["Ultra Quality", "With Audio"], available: true, provider: "kie", hasSound: true, enabledKey: "kling_v3_enabled" },
    { id: "veo3-fast",       name: "Veo 3.1 Fast",       desc: "Google AI, native audio, 720p",         tokens: 15,  badge: "With Audio",      available: true,  provider: "kie", hasSound: true,  enabledKey: "veo3_fast_enabled" },
    { id: "veo3-quality",    name: "Veo 3.1 Quality",    desc: "Google AI, cinematic, 1080p",            tokens: 60,  badge: "Premium",         badges: ["Premium", "With Audio"], available: true, provider: "kie", hasSound: true, enabledKey: "veo3_quality_enabled" },
    { id: "seedance-2",      name: "Seedance 2.0",       desc: "ByteDance, best quality + audio",        tokens: 30,  badge: "Best Quality",    badges: ["Best Quality", "With Audio"], available: true, provider: "kie", hasSound: true, enabledKey: "seedance2_enabled" },
    { id: "seedance-2-fast", name: "Seedance 2.0 Fast",  desc: "ByteDance, fast + audio",                tokens: 15,  badge: "With Audio",      available: true,  provider: "kie", hasSound: true,  enabledKey: "seedance2_fast_enabled" },
    { id: "hailuo-pro",      name: "Hailuo 2.3",         desc: "MiniMax, fast generation",               tokens: 8,   badge: "",                available: true,  provider: "kie", hasSound: false, enabledKey: "hailuo_enabled" },
    { id: "sora-2",          name: "Sora 2",             desc: "OpenAI, premium realism",                tokens: 10,  badge: "Premium",         available: true,  provider: "kie", hasSound: false, enabledKey: "sora2_enabled" },
    { id: "wan-2-6",         name: "Wan 2.6",            desc: "Alibaba, fast and affordable",           tokens: 10,  badge: "Cheapest",        available: true,  provider: "kie", hasSound: false, enabledKey: "wan26_enabled" },
    { id: "grok-imagine",    name: "Grok Imagine",       desc: "xAI, fast and cheap",                    tokens: 5,   badge: "Most Affordable", available: true,  provider: "kie", hasSound: false, enabledKey: "grok_enabled" },
    { id: "luma-ray-3",      name: "Luma Ray 3",         desc: "Cinematic quality",                      tokens: 15,  badge: "",                available: true,  provider: "kie", hasSound: false, enabledKey: "luma_enabled" },
    { id: "higgsfield-ugc",  name: "Higgsfield UGC",     desc: "Realistic UGC ad videos",                tokens: 10,  badge: "Best for Ads",    available: true,  provider: "higgsfield", hasSound: false, enabledKey: "higgsfield_enabled" },
    { id: "runway-gen4",     name: "Runway Gen-4",       desc: "Professional cinematic quality",         tokens: 40,  badge: "Coming Soon",     available: false, provider: "runway", hasSound: false, enabledKey: "" },
  ];

  // Only confirmed audio models for Script to Video
  const AUDIO_MODELS = [
    { id: "kling-v3-std", name: "Kling 3.0 Standard", tokens: 15, desc: "Cinematic + native audio" },
    { id: "kling-v3-pro", name: "Kling 3.0 Pro",      tokens: 20, desc: "1080p cinematic + native audio" },
    { id: "veo3-fast",    name: "Veo 3.1 Fast",        tokens: 15, desc: "Google AI + native audio" },
  ];

  const modules: Module[] = [
    { id: "text_to_video",   title: "Text to Video",    desc: "Generate cinematic videos from text descriptions", badge: "Most Popular" },
    { id: "image_to_video",  title: "Image to Video",   desc: "Animate any still image into a stunning video",    badge: "" },
    { id: "ugc_ad",          title: "UGC Ad Creator",   desc: "AI avatar testimonial and product review videos",  badge: "Best for Ads" },
    { id: "ai_actor",        title: "AI Actor",         desc: "Create photorealistic AI human avatars",           badge: "" },
    { id: "voice",           title: "Voice Generation", desc: "Natural AI voiceovers for videos",                 badge: "" },
    { id: "text_to_image",   title: "Text to Image",    desc: "Generate images from text or reference photo",     badge: "2 Tokens" },
    { id: "script_to_video", title: "Script to Video",  desc: "Turn a script into multiple video scenes with audio", badge: "New" },
    { id: "image_ad",        title: "Image Ad",         desc: "Scroll-stopping image advertisements",             badge: "Cheapest" },
    { id: "prompt",          title: "Prompt Expander",  desc: "Transform simple ideas into cinematic prompts",    badge: "Free" },
    { id: "script",          title: "Script Writer",    desc: "Generate viral video scripts with AI",             badge: "Free" },
  ];

  const visibleModels = ALL_MODELS.filter((m) => {
    if (!m.available) return false;
    if (!m.enabledKey) return false;
    const coreModels = ["kling_v1_6_enabled", "kling_v2_master_enabled", "kling_v3_enabled", "higgsfield_enabled"];
    if (enabledKeys[m.enabledKey] === false) return false;
    if (enabledKeys[m.enabledKey] === true) return true;
    return coreModels.includes(m.enabledKey);
  });

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
        body: JSON.stringify({ script: s2vScript, aspect_ratio: s2vAspectRatio }),
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
        // Deduct tokens
        const tokenRes = await fetch("/api/tokens", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
          body: JSON.stringify({ amount: tokenCostPerScene }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) { setError(tokenData.error ?? "Insufficient tokens."); break; }
        setTokenBalance(tokenData.balance);

        // Generate video
        const genRes = await fetch("/api/generate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: updatedScenes[i].visual_prompt,
            mode: "text_to_video",
            duration: "5",
            aspect_ratio: s2vAspectRatio,
            model: s2vModel,
            with_audio: true,
            user_id: session.user.id,
            tokens_used: tokenCostPerScene,
          }),
        });
        const genData = await genRes.json();

        if (!genRes.ok || !genData.task_id) {
          updatedScenes[i] = { ...updatedScenes[i], status: "failed" };
          setS2vScenes([...updatedScenes]);
          // Refund
          await fetch("/api/tokens/refund", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ amount: tokenCostPerScene }) });
          setTokenBalance(p => p + tokenCostPerScene);
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
              }),
            });
          } catch { /* non-critical */ }
        } else {
          updatedScenes[i] = { ...updatedScenes[i], status: "failed" };
          setS2vScenes([...updatedScenes]);
          await fetch("/api/tokens/refund", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ amount: tokenCostPerScene }) });
          setTokenBalance(p => p + tokenCostPerScene);
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

  // ---- IMAGE GENERATION ----
  const handleGenerateImage = async () => {
    setLoading(true); setError(""); setVideoUrl(null); setProgress(0);
    const tokenCostImg = tokenPricing["text_to_image"] ?? 2;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Please sign in."); setLoading(false); return; }
      const tokenRes = await fetch("/api/tokens", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ amount: tokenCostImg }) });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) { setError(tokenData.error ?? "Insufficient tokens."); setLoading(false); return; }
      setTokenBalance(tokenData.balance);
      let refImageUrl = imageUrlInput;
      if (imageFile && !useUrl) { const uploaded = await uploadImage(imageFile); if (uploaded) refImageUrl = uploaded; }
      const imgAspectRatio = aspectRatio === "9:16" ? "2:3" : aspectRatio === "1:1" ? "1:1" : "3:2";
      const res = await fetch("/api/generate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, image_url: refImageUrl || undefined, aspect_ratio: imgAspectRatio, user_id: session.user.id, tokens_used: tokenCostImg }) });
      const data = await res.json() as { task_id?: string; error?: string; refunded?: boolean };
      if (!res.ok) { setError((data.error ?? "Generation failed.") + (data.refunded ? " Tokens refunded." : "")); setLoading(false); if (data.refunded) setTokenBalance((p) => p + tokenCostImg); return; }
      if (!data.task_id) { setError("Failed to start generation."); setLoading(false); return; }
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
              if (fs) { await fetch("/api/generations", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + fs.access_token }, body: JSON.stringify({ type: "text_to_image", prompt, image_url: sd.video_url, output_type: "image", status: "completed", tokens_used: tokenCostImg }) }); }
            } catch (e) { console.error("Save error:", e); }
          } else if (sd.failed) {
            setError("Generation failed. Tokens refunded."); setLoading(false); clearInterval(poll);
            await fetch("/api/tokens/refund", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ amount: tokenCostImg }) });
            setTokenBalance((p) => p + tokenCostImg);
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
      const tokenRes = await fetch("/api/tokens", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ amount: tokenCost }) });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) { setError(tokenData.error ?? "Insufficient tokens."); setLoading(false); return; }
      setTokenBalance(tokenData.balance);
      let imageUrl = imageUrlInput;
      if (needsImage && imageFile && !useUrl) {
        const uploaded = await uploadImage(imageFile);
        if (!uploaded) { setError("Image upload failed. Try URL instead."); setLoading(false); const { data: { session: rs } } = await supabase.auth.getSession(); if (rs) { await fetch("/api/tokens/refund", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + rs.access_token }, body: JSON.stringify({ amount: tokenCost }) }); setTokenBalance((p) => p + tokenCost); } return; }
        imageUrl = uploaded;
      }
      const capturedModule = activeModuleRef.current;
      const capturedModel = selectedModelRef.current;
      const capturedCost = tokenCostRef.current;
      const capturedProvider = providerRef.current;
      const capturedMode = needsImage ? "image_to_video" : "text_to_video";
      const useAudio = modelData?.hasSound === true;
      const res = await fetch("/api/generate-video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, mode: capturedMode, image_url: imageUrl || undefined, duration: String(duration), aspect_ratio: aspectRatio, model: selectedModel, with_audio: useAudio, user_id: session.user.id, tokens_used: tokenCost }) });
      const data = await res.json() as { task_id?: string; error?: string; refunded?: boolean; provider?: string };
      if (!res.ok) { setError((data.error ?? "Generation failed.") + (data.refunded ? " Tokens refunded." : "")); setLoading(false); if (data.refunded) setTokenBalance((p) => p + tokenCost); return; }
      const genProvider = data.provider ?? capturedProvider;
      if (!data.task_id) { setError("Failed to start generation."); setLoading(false); if (data.refunded) setTokenBalance((p) => p + tokenCost); return; }
      let timedOut = false; let generationComplete = false; let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const poll = setInterval(async () => {
        try {
          const sr = await fetch("/api/video-status?task_id=" + data.task_id + "&mode=" + capturedMode + "&provider=" + genProvider);
          const sd = await sr.json() as { completed?: boolean; failed?: boolean; video_url?: string };
          if (sd.completed && sd.video_url) {
            if (timedOut) return; generationComplete = true; clearTimeout(timeoutHandle);
            setVideoUrl(sd.video_url); setProgress(100); setLoading(false); clearInterval(poll);
            try { const { data: { session: fs } } = await supabase.auth.getSession(); if (fs) { await fetch("/api/generations", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + fs.access_token }, body: JSON.stringify({ type: capturedModule, prompt, video_url: sd.video_url, status: "completed", tokens_used: capturedCost, duration, aspect_ratio: aspectRatio, model: capturedModel }) }); } } catch (e) { console.error("Save error:", e); }
          } else if (sd.failed) {
            setError("Generation failed. Tokens refunded."); setLoading(false); clearInterval(poll);
            try { const { data: { session: rs } } = await supabase.auth.getSession(); if (rs) { const rr = await fetch("/api/tokens/refund", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + rs.access_token }, body: JSON.stringify({ amount: capturedCost }) }); const rd = await rr.json(); if (rd.balance !== undefined) setTokenBalance(rd.balance); } } catch (e) { console.error("Refund error:", e); }
          }
        } catch (e) { console.error("Poll error:", e); }
      }, 5000);
      const timeoutMs = ["veo3-fast", "veo3-quality", "sora-2", "seedance-2", "seedance-2-fast"].includes(selectedModel) ? 600000 : 300000;
      timeoutHandle = setTimeout(async () => {
        if (generationComplete) return; timedOut = true; clearInterval(poll); setLoading(false); setError("Generation timed out. Tokens refunded.");
        const { data: { session: ts } } = await supabase.auth.getSession();
        if (ts) { const rr = await fetch("/api/tokens/refund", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + ts.access_token }, body: JSON.stringify({ amount: capturedCost }) }); const rd = await rr.json(); if (rd.balance !== undefined) setTokenBalance(rd.balance); }
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
  };

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

  const s2vModelData = AUDIO_MODELS.find(m => m.id === s2vModel);
  const s2vTokensPerScene = tokenPricing[s2vModel] ?? s2vModelData?.tokens ?? 15;
  const s2vTotalTokens = s2vScenes.length * s2vTokensPerScene;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-extrabold mb-0.5">Video Studio</h1>
        <p className="text-gray-400 text-xs">10 AI modules — all plans include all features</p>
      </div>

      <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-3 flex items-center justify-between">
        <div>
          <p className="text-purple-300 font-semibold text-sm">{tokenBalance} tokens remaining</p>
          <p className="text-gray-500 text-xs">{currentModel?.name ?? "Select a module"} — {tokenCost} tokens</p>
        </div>
        <a href="/dashboard/billing" className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-1.5 px-3 rounded-full transition">Top Up</a>
      </div>

      {!activeModule && (
        <div className="grid grid-cols-2 gap-3">
          {modules.map((mod) => (
            <div key={mod.id} onClick={() => setActiveModule(mod.id)} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-purple-500/50 transition cursor-pointer">
              {mod.badge && <div className="inline-block bg-purple-900/40 text-purple-300 text-xs font-bold px-2 py-0.5 rounded-full mb-2">{mod.badge}</div>}
              <h3 className="font-bold text-sm mb-1">{mod.title}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{mod.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* ---- PROMPT EXPANDER ---- */}
      {isPromptModule && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={resetForm} className="text-gray-400 hover:text-white text-sm transition">Back</button>
            <h2 className="font-bold text-sm">Prompt Expander</h2>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-3">
              <p className="text-purple-300 text-xs font-semibold mb-1">Free — no tokens required</p>
              <p className="text-gray-400 text-xs">Type a simple idea and AI transforms it into a detailed cinematic prompt.</p>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Your simple idea</label>
              <textarea placeholder="e.g. cat playing piano, sunset over mountains, product showcase..." value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm resize-none" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Target Format</label>
              <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm">
                <option value="16:9">16:9 YouTube / Widescreen</option>
                <option value="9:16">9:16 TikTok / Reels / Shorts</option>
                <option value="1:1">1:1 Square Feed</option>
              </select>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={handleExpandPrompt} disabled={expandLoading} className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition">
              {expandLoading ? "Expanding..." : "Expand Prompt — Free"}
            </button>
            {expandedPrompt && (
              <div className="space-y-3">
                <div className="bg-black/30 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-green-400 text-xs font-bold">Expanded Prompt</p>
                    <button onClick={() => navigator.clipboard.writeText(expandedPrompt)} className="text-gray-400 hover:text-white text-xs transition">Copy</button>
                  </div>
                  <p className="text-gray-200 text-sm leading-relaxed">{expandedPrompt}</p>
                </div>
                <button onClick={() => { setPrompt(expandedPrompt); setActiveModule("text_to_video"); setExpandedPrompt(""); }} className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 rounded-xl transition text-sm">
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
            <button onClick={resetForm} className="text-gray-400 hover:text-white text-sm transition">Back</button>
            <h2 className="font-bold text-sm">Script Writer</h2>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-3">
              <p className="text-purple-300 text-xs font-semibold mb-1">Free — no tokens required</p>
              <p className="text-gray-400 text-xs">AI writes a complete viral script with hook, body, and call to action.</p>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Video Topic</label>
              <textarea placeholder="e.g. 5 signs your gut health is ruined, how I made $10k with AI..." value={scriptTopic} onChange={(e) => setScriptTopic(e.target.value)} rows={3} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Platform</label>
                <select value={scriptPlatform} onChange={(e) => setScriptPlatform(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm">
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram Reels</option>
                  <option value="youtube">YouTube Shorts</option>
                  <option value="facebook">Facebook</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Video Length</label>
                <select value={scriptDuration} onChange={(e) => setScriptDuration(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm">
                  <option value="15">15 seconds</option>
                  <option value="30">30 seconds</option>
                  <option value="60">60 seconds</option>
                  <option value="90">90 seconds</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Script Style</label>
              <select value={scriptFormat} onChange={(e) => setScriptFormat(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm">
                <option value="storytelling">Storytelling</option>
                <option value="educational">Educational / How-to</option>
                <option value="listicle">Listicle (Top 5...)</option>
                <option value="what-if">What If / Hypothetical</option>
                <option value="ugc">UGC / Testimonial</option>
                <option value="motivation">Motivational</option>
              </select>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={handleWriteScript} disabled={scriptLoading} className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition">
              {scriptLoading ? "Writing Script..." : "Write Script — Free"}
            </button>
            {generatedScript && (
              <div className="space-y-3">
                <div className="bg-black/30 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-green-400 text-xs font-bold">Your Script</p>
                    <button onClick={() => navigator.clipboard.writeText(generatedScript)} className="text-gray-400 hover:text-white text-xs transition">Copy</button>
                  </div>
                  <pre className="text-gray-200 text-xs leading-relaxed whitespace-pre-wrap">{generatedScript}</pre>
                </div>
                <button
                  onClick={() => { setS2vScript(generatedScript); setActiveModule("script_to_video"); setGeneratedScript(""); }}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl transition text-sm"
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
            <button onClick={resetForm} className="text-gray-400 hover:text-white text-sm transition">Back</button>
            <h2 className="font-bold text-sm">Script to Video</h2>
            {s2vStep !== "input" && (
              <div className="ml-auto flex gap-2">
                {["input", "review", "generating", "done"].map((step, i) => (
                  <div key={step} className={"w-2 h-2 rounded-full " + (["input", "review", "generating", "done"].indexOf(s2vStep) >= i ? "bg-purple-500" : "bg-white/20")} />
                ))}
              </div>
            )}
          </div>

          {/* STEP 1 — Input */}
          {s2vStep === "input" && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-3">
                <p className="text-purple-300 text-xs font-semibold mb-1">How it works</p>
                <p className="text-gray-400 text-xs">Paste your script → AI splits it into 3-5 scenes → Review visual prompts → Generate all videos with native audio</p>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Your Script</label>
                <textarea
                  placeholder="Paste your script here, or write it directly. AI will split it into scenes automatically..."
                  value={s2vScript} onChange={(e) => setS2vScript(e.target.value)} rows={8}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm resize-none"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Video Format</label>
                <select value={s2vAspectRatio} onChange={(e) => setS2vAspectRatio(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm">
                  <option value="9:16">9:16 TikTok / Reels (Recommended)</option>
                  <option value="16:9">16:9 YouTube</option>
                  <option value="1:1">1:1 Square Feed</option>
                </select>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button onClick={handleSplitScenes} disabled={s2vSplitting} className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition">
                {s2vSplitting ? "AI is analyzing your script..." : "Split into Scenes →"}
              </button>
            </div>
          )}

          {/* STEP 2 — Review scenes */}
          {s2vStep === "review" && (
            <div className="space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
                <div>
                  <p className="text-white font-bold text-sm mb-1">AI found {s2vScenes.length} scenes</p>
                  <p className="text-gray-400 text-xs">Review and edit the visual prompts before generating. Each scene is 5 seconds.</p>
                </div>
                <div className="space-y-3">
                  {s2vScenes.map((scene, i) => (
                    <div key={i} className="bg-black/20 border border-white/10 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-purple-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">{scene.scene_number}</span>
                        <span className="text-gray-400 text-xs font-semibold">Scene {scene.scene_number}</span>
                      </div>
                      <p className="text-gray-400 text-xs mb-2 italic">"{scene.narration}"</p>
                      <label className="text-gray-500 text-xs mb-1 block">Visual Prompt (editable)</label>
                      <textarea
                        value={scene.visual_prompt}
                        onChange={(e) => {
                          const updated = [...s2vScenes];
                          updated[i] = { ...updated[i], visual_prompt: e.target.value };
                          setS2vScenes(updated);
                        }}
                        rows={3}
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500 transition resize-none"
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="text-gray-400 text-xs mb-2 block">AI Model (audio models only)</label>
                  <div className="grid grid-cols-1 gap-2">
                    {AUDIO_MODELS.map((model) => (
                      <button key={model.id} onClick={() => setS2vModel(model.id)}
                        className={"p-3 rounded-xl border text-left transition " + (s2vModel === model.id ? "border-purple-500 bg-purple-900/30" : "border-white/10 bg-white/5 hover:border-purple-500/50")}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-bold text-xs">{model.name}</div>
                            <div className="text-gray-500 text-xs">{model.desc}</div>
                          </div>
                          <div className="text-purple-300 text-xs font-bold">{tokenPricing[model.id] ?? model.tokens} tokens/scene</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-3">
                  <p className="text-yellow-400 text-xs font-bold">Total cost: {s2vTotalTokens} tokens</p>
                  <p className="text-gray-500 text-xs">{s2vScenes.length} scenes × {s2vTokensPerScene} tokens each • You have {tokenBalance} tokens</p>
                </div>

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setS2vStep("input")} className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition text-sm">← Edit Script</button>
                  <button onClick={handleGenerateScenes} disabled={tokenBalance < s2vTotalTokens} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition text-sm">
                    Generate {s2vScenes.length} Videos →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — Generating */}
          {s2vStep === "generating" && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
              <div className="text-center">
                <h3 className="font-bold mb-1">Generating Your Videos</h3>
                <p className="text-gray-400 text-sm">Scene {s2vCurrentScene + 1} of {s2vScenes.length} — please keep this page open</p>
              </div>
              <div className="space-y-3">
                {s2vScenes.map((scene, i) => (
                  <div key={i} className="flex items-center gap-3 bg-black/20 rounded-xl px-4 py-3">
                    <div className={"w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 " +
                      (scene.status === "done" ? "bg-green-600 text-white" :
                       scene.status === "generating" ? "bg-purple-600 text-white animate-pulse" :
                       scene.status === "failed" ? "bg-red-600 text-white" :
                       "bg-white/20 text-gray-400")}>
                      {scene.status === "done" ? "✓" : scene.status === "failed" ? "✗" : scene.scene_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-300 truncate">{scene.narration}</p>
                    </div>
                    <span className={"text-xs font-bold " +
                      (scene.status === "done" ? "text-green-400" :
                       scene.status === "generating" ? "text-purple-400" :
                       scene.status === "failed" ? "text-red-400" : "text-gray-600")}>
                      {scene.status === "done" ? "Done" : scene.status === "generating" ? "Generating..." : scene.status === "failed" ? "Failed" : "Waiting"}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-gray-500 text-xs text-center">Each scene takes 1-3 minutes. Do not close this page.</p>
            </div>
          )}

          {/* STEP 4 — Done */}
          {s2vStep === "done" && (
            <div className="space-y-4">
              <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4">
                <p className="text-green-400 font-bold mb-1">✓ All scenes generated!</p>
                <p className="text-gray-400 text-xs">Your videos have been saved to the Gallery. Download each scene below.</p>
              </div>
              <div className="space-y-4">
                {s2vScenes.map((scene, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                    <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-300">Scene {scene.scene_number}</span>
                      {scene.status === "done" && scene.video_url && (
                        <button onClick={() => handleDownload(scene.video_url!)} className="text-purple-400 hover:text-white text-xs transition font-semibold">Download</button>
                      )}
                      {scene.status === "failed" && <span className="text-red-400 text-xs">Failed</span>}
                    </div>
                    {scene.status === "done" && scene.video_url ? (
                      <video src={scene.video_url} controls playsInline className="w-full" />
                    ) : (
                      <div className="p-4 text-center text-gray-500 text-sm">Generation failed for this scene</div>
                    )}
                    <div className="px-4 py-2">
                      <p className="text-gray-500 text-xs italic">"{scene.narration}"</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setS2vStep("input"); setS2vScenes([]); setS2vScript(""); }} className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition text-sm">New Script</button>
                <button onClick={resetForm} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition text-sm">Back to Studio</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- VIDEO / IMAGE MODULES ---- */}
      {activeModule && !isPromptModule && !isScriptModule && !isS2VModule && !loading && !videoUrl && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={resetForm} className="text-gray-400 hover:text-white text-sm transition">Back</button>
            <h2 className="font-bold text-sm">{modules.find((m) => m.id === activeModule)?.title}</h2>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
            {needsImage && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => setUseUrl(false)} className={"px-3 py-1.5 rounded-full text-xs font-bold transition " + (!useUrl ? "bg-purple-600 text-white" : "bg-white/10 text-gray-400")}>Upload Image</button>
                  <button onClick={() => setUseUrl(true)} className={"px-3 py-1.5 rounded-full text-xs font-bold transition " + (useUrl ? "bg-purple-600 text-white" : "bg-white/10 text-gray-400")}>Use URL</button>
                </div>
                {!useUrl ? (
                  <div>
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageFile} className="hidden" />
                    <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-white/20 hover:border-purple-500/50 rounded-xl p-6 text-center cursor-pointer transition">
                      {imagePreview ? <img src={imagePreview} alt="Preview" className="max-h-40 mx-auto rounded-lg object-contain" /> : <div><p className="text-gray-400 text-sm font-semibold mb-1">Click to upload image</p><p className="text-gray-600 text-xs">JPG, PNG, WebP up to 10MB</p></div>}
                    </div>
                    {imageFile && <p className="text-green-400 text-xs">{imageFile.name} ready</p>}
                  </div>
                ) : (
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Image URL</label>
                    <input type="url" placeholder="https://example.com/image.jpg" value={imageUrlInput} onChange={(e) => setImageUrlInput(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm" />
                  </div>
                )}
              </div>
            )}
            {activeModule === "ugc_ad" && (
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-3">
                <p className="text-purple-300 text-xs font-semibold mb-1">UGC Ad Mode</p>
                <p className="text-gray-400 text-xs">Upload a photo of your avatar for the most realistic AI UGC ads.</p>
              </div>
            )}
            {isImageModule && (
              <>
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-3">
                  <p className="text-purple-300 text-xs font-semibold mb-1">Reference Image (Optional)</p>
                  <p className="text-gray-400 text-xs">Upload a reference image to generate variations or repurpose existing visuals.</p>
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Aspect Ratio</label>
                  <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm">
                    <option value="16:9">16:9 Landscape</option>
                    <option value="9:16">9:16 Portrait / Reels</option>
                    <option value="1:1">1:1 Square</option>
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="text-gray-400 text-xs mb-1 block">
                {activeModule === "ugc_ad" ? "Describe the UGC ad scenario" : activeModule === "text_to_image" ? "Describe the image you want" : "Describe your video"}
              </label>
              <textarea
                placeholder={activeModule === "ugc_ad" ? "Woman in kitchen holding product, smiling, authentic testimonial style..." : activeModule === "text_to_image" ? "A photorealistic portrait of a woman in golden hour light, cinematic, sharp details..." : "A luxury watch rotating slowly on a marble surface, golden hour lighting, cinematic 4K..."}
                value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm resize-none"
              />
            </div>
            {showModels && (
              <>
                <div>
                  <label className="text-gray-400 text-xs mb-2 block">AI Model</label>
                  <div className="grid grid-cols-2 gap-2">
                    {visibleModels.map((model) => (
                      <button key={model.id} onClick={() => model.available && setSelectedModel(model.id)} disabled={!model.available}
                        className={"p-3 rounded-xl border text-left transition " + (selectedModel === model.id ? "border-purple-500 bg-purple-900/30" : model.available ? "border-white/10 bg-white/5 hover:border-purple-500/50" : "border-white/5 opacity-40 cursor-not-allowed")}
                      >
                        <div className="flex flex-wrap gap-1 mb-1">
                          {(modelBadges[model.id] ? modelBadges[model.id].split(",").map(b => b.trim()).filter(Boolean) : model.badges ?? (model.badge ? [model.badge] : [])).map((b, bi) => (
                            <div key={bi} className={"text-xs font-bold px-1.5 py-0.5 rounded-full inline-block " + (model.available ? "bg-purple-900/40 text-purple-300" : "bg-gray-900/40 text-gray-500")}>{b}</div>
                          ))}
                        </div>
                        <div className="font-bold text-xs mb-0.5">{modelLabels[model.id] || model.name}</div>
                        <div className="text-gray-500 text-xs">{tokenPricing[model.id] ?? model.tokens} tokens — {modelDescs[model.id] || model.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Duration</label>
                    <select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm">
                      <option value="5">5 seconds</option>
                      <option value="8">8 seconds</option>
                      <option value="10">10 seconds</option>
                      {(selectedModel === "kling-v3-std" || selectedModel === "kling-v3-pro") && <option value="15">15 seconds</option>}
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Aspect Ratio</label>
                    <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm">
                      <option value="16:9">16:9 YouTube</option>
                      <option value="9:16">9:16 TikTok / Reels</option>
                      <option value="1:1">1:1 Feed</option>
                    </select>
                  </div>
                </div>
                {currentModel?.hasSound && (
                  <div className="bg-green-900/20 border border-green-500/20 rounded-xl px-4 py-3">
                    <p className="text-green-400 text-xs font-semibold">Native audio included with {currentModel.name}</p>
                    <p className="text-gray-500 text-xs">Sound, dialogue and ambient audio generated automatically</p>
                  </div>
                )}
              </>
            )}
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={handleGenerate} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition">
              {isImageModule ? `Generate Image — ${tokenPricing["text_to_image"] ?? 2} tokens` : `Generate — ${tokenCost} tokens`}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
          <div className="text-center">
            <h3 className="font-bold mb-1">{isImageModule ? "Generating Your Image" : "Generating Your Video"}</h3>
            <p className="text-gray-400 text-sm">{getStatusMsg(elapsedTime)}</p>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span>{Math.round(progress)}% complete</span>
              <span>{formatTime(elapsedTime)} elapsed</span>
            </div>
            <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-600 to-pink-500 rounded-full transition-all duration-1000" style={{ width: progress + "%" }} />
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
                <span className={step.done ? "text-green-400" : "text-gray-600"}>{step.done ? "✓" : "○"}</span>
                <span className={step.done ? "text-gray-300" : "text-gray-600"}>{step.label}</span>
              </div>
            ))}
          </div>
          <p className="text-gray-500 text-xs text-center">
            {isImageModule ? "Keep this page open. Image generation may take several minutes." : "Keep this page open. Average: 1-3 minutes."}
          </p>
        </div>
      )}

      {videoUrl && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-green-400 font-bold">Done!</span>
            <h3 className="font-bold">{isImageModule ? "Your Image is Ready" : "Your Video is Ready"}</h3>
          </div>
          {isImageModule ? <img src={videoUrl} alt="Generated image" className="w-full rounded-xl" /> : <video src={videoUrl} controls playsInline className="w-full rounded-xl" />}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => handleDownload(videoUrl, isImageModule)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition text-sm">{isImageModule ? "Save Image" : "Save Video"}</button>
            <button onClick={resetForm} className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition text-sm">Generate Another</button>
          </div>
          <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-3">
            <p className="text-blue-300 text-xs font-semibold mb-1">iPhone users</p>
            <p className="text-gray-400 text-xs">Tap and hold the {isImageModule ? "image" : "video"}, then select Save to Photos.</p>
          </div>
        </div>
      )}
    </div>
  );
}
