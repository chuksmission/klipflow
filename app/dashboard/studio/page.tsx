"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";

interface Model {
  id: string;
  name: string;
  desc: string;
  tokens: number;
  badge: string;
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const tokenCostRef = useRef(15);
  const selectedModelRef = useRef("kling-v1-6-pro");
  const activeModuleRef = useRef<string | null>(null);
  const providerRef = useRef("kie");

  useEffect(() => { selectedModelRef.current = selectedModel; }, [selectedModel]);
  useEffect(() => { activeModuleRef.current = activeModule; }, [activeModule]);

  const ALL_MODELS: Model[] = [
    // Kling via Kie.ai
    { id: "kling-v1-6-std",  name: "Kling 1.6 Standard", desc: "Fast, great for drafts",          tokens: 10,  badge: "",              available: true,  provider: "kie",        hasSound: false, enabledKey: "kling_v1_6_enabled" },
    { id: "kling-v1-6-pro",  name: "Kling 1.6 Pro",      desc: "High quality, smooth motion",      tokens: 15,  badge: "Recommended",   available: true,  provider: "kie",        hasSound: false, enabledKey: "kling_v1_6_enabled" },
    { id: "kling-v2-master", name: "Kling 2.1 Master",    desc: "Best realism and motion",          tokens: 20,  badge: "Best Quality",  available: true,  provider: "kie",        hasSound: false, enabledKey: "kling_v2_master_enabled" },
    { id: "kling-v3-std",    name: "Kling 3.0 Standard",  desc: "Cinematic quality, up to 15s",    tokens: 25,  badge: "Best Quality",  available: true,  provider: "kie",        hasSound: true,  enabledKey: "kling_v3_enabled" },
    { id: "kling-v3-pro",    name: "Kling 3.0 Pro",       desc: "1080p cinematic, multi-shot",     tokens: 35,  badge: "Ultra Quality", available: true,  provider: "kie",        hasSound: true,  enabledKey: "kling_v3_enabled" },
    // Google Veo 3
    { id: "veo3-fast",       name: "Veo 3 Fast",          desc: "Google AI, native audio, 8s",     tokens: 30,  badge: "With Audio",    available: true,  provider: "kie",        hasSound: true,  enabledKey: "veo3_fast_enabled" },
    { id: "veo3-quality",    name: "Veo 3 Quality",       desc: "Google AI, cinematic, 8s",         tokens: 80,  badge: "Premium",       available: true,  provider: "kie",        hasSound: true,  enabledKey: "veo3_quality_enabled" },
    // ByteDance Seedance
    { id: "seedance-2",      name: "Seedance 2.0",        desc: "ByteDance, best quality + audio",  tokens: 50,  badge: "Best Quality",  available: true,  provider: "kie",        hasSound: true,  enabledKey: "seedance2_enabled" },
    { id: "seedance-2-fast", name: "Seedance 2.0 Fast",   desc: "ByteDance, fast and affordable",   tokens: 20,  badge: "",              available: true,  provider: "kie",        hasSound: true,  enabledKey: "seedance2_fast_enabled" },
    // Hailuo
    { id: "hailuo-pro",      name: "Hailuo 2.3 Pro",      desc: "MiniMax, fast generation",         tokens: 20,  badge: "",              available: true,  provider: "kie",        hasSound: false, enabledKey: "hailuo_enabled" },
    // Sora 2
    { id: "sora-2",          name: "Sora 2",              desc: "OpenAI, premium realism",           tokens: 60,  badge: "Premium",       available: true,  provider: "kie",        hasSound: false, enabledKey: "sora2_enabled" },
    // Wan
    { id: "wan-2-6",         name: "Wan 2.6",             desc: "Alibaba, fast and cheap",           tokens: 8,   badge: "Cheapest",      available: true,  provider: "kie",        hasSound: false, enabledKey: "wan26_enabled" },
    // Luma
    { id: "luma-ray-3",      name: "Luma Ray 3",          desc: "Cinematic quality",                 tokens: 35,  badge: "",              available: true,  provider: "kie",        hasSound: false, enabledKey: "luma_enabled" },
    // Higgsfield
    { id: "higgsfield-ugc",  name: "Higgsfield UGC",      desc: "Most realistic UGC ad videos",     tokens: 20,  badge: "Best for Ads",  available: true,  provider: "higgsfield", hasSound: false, enabledKey: "higgsfield_enabled" },
    // Coming soon
    { id: "runway-gen4",     name: "Runway Gen-4",        desc: "Professional cinematic quality",    tokens: 40,  badge: "Coming Soon",   available: false, provider: "runway",     hasSound: false, enabledKey: "" },
  ];

  const modules: Module[] = [
    { id: "text_to_video",  title: "Text to Video",    desc: "Generate cinematic videos from text descriptions", badge: "Most Popular" },
    { id: "image_to_video", title: "Image to Video",   desc: "Animate any still image into a stunning video",    badge: "" },
    { id: "ugc_ad",         title: "UGC Ad Creator",   desc: "AI avatar testimonial and product review videos",  badge: "Best for Ads" },
    { id: "ai_actor",       title: "AI Actor",         desc: "Create photorealistic AI human avatars",           badge: "" },
    { id: "voice",          title: "Voice Generation", desc: "Natural AI voiceovers for videos",                 badge: "" },
    { id: "image_ad",       title: "Image Ad",         desc: "Scroll-stopping image advertisements",             badge: "Cheapest" },
    { id: "prompt",         title: "Prompt Expander",  desc: "Transform ideas into cinematic prompts",           badge: "" },
    { id: "script",         title: "Script Writer",    desc: "Generate viral video scripts",                     badge: "" },
  ];

  const visibleModels = ALL_MODELS.filter((m) => {
    if (!m.available) return false;
    if (!m.enabledKey) return false;
    // If no setting found default to true for core models, false for new ones
    const coreModels = ["kling_v1_6_enabled", "kling_v2_master_enabled", "kling_v3_enabled", "higgsfield_enabled"];
    if (enabledKeys[m.enabledKey] === false) return false;
    if (enabledKeys[m.enabledKey] === true) return true;
    // Default: show core models, hide new ones until admin enables
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

      // Fetch enabled models from admin settings
      const sRes = await fetch("/api/settings/models");
      const sData = await sRes.json();
      setEnabledKeys(sData.models ?? {});
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

  const handleGenerate = async () => {
    if (!prompt) { setError("Please enter a prompt."); return; }
    const needsImage = activeModule === "image_to_video" || activeModule === "ugc_ad";
    if (needsImage && !imageFile && !imageUrlInput) { setError("Please upload an image or enter an image URL."); return; }

    setLoading(true); setError(""); setVideoUrl(null); setProgress(0);

    const modelData = ALL_MODELS.find((m) => m.id === selectedModel);
    const tokenCost = modelData?.tokens ?? 15;
    const provider = modelData?.provider ?? "kie";
    tokenCostRef.current = tokenCost;
    providerRef.current = provider;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Please sign in."); setLoading(false); return; }

      const tokenRes = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ amount: tokenCost }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) { setError(tokenData.error ?? "Insufficient tokens."); setLoading(false); return; }
      setTokenBalance(tokenData.balance);

      let imageUrl = imageUrlInput;
      if (needsImage && imageFile && !useUrl) {
        const uploaded = await uploadImage(imageFile);
        if (!uploaded) {
          setError("Image upload failed. Try URL instead.");
          setLoading(false);
          const { data: { session: rs } } = await supabase.auth.getSession();
          if (rs) {
            await fetch("/api/tokens/refund", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: "Bearer " + rs.access_token },
              body: JSON.stringify({ amount: tokenCost }),
            });
            setTokenBalance((p) => p + tokenCost);
          }
          return;
        }
        imageUrl = uploaded;
      }

      const capturedModule = activeModuleRef.current;
      const capturedModel = selectedModelRef.current;
      const capturedCost = tokenCostRef.current;
      const capturedProvider = providerRef.current;
      const capturedMode = needsImage ? "image_to_video" : "text_to_video";
      const useAudio = modelData?.hasSound === true;

      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt, mode: capturedMode,
          image_url: imageUrl || undefined,
          duration, aspect_ratio: aspectRatio,
          model: selectedModel, with_audio: useAudio,
          user_id: session.user.id, tokens_used: tokenCost,
        }),
      });

      const data = await res.json() as { task_id?: string; error?: string; refunded?: boolean; provider?: string };
      if (!res.ok) {
        setError((data.error ?? "Generation failed.") + (data.refunded ? " Tokens refunded." : ""));
        setLoading(false);
        if (data.refunded) setTokenBalance((p) => p + tokenCost);
        return;
      }

      const genProvider = data.provider ?? capturedProvider;

      if (!data.task_id) {
        setError("Failed to start generation. Please try again.");
        setLoading(false);
        if (data.refunded) setTokenBalance((p) => p + tokenCost);
        return;
      }

      let timedOut = false;
      const poll = setInterval(async () => {
        try {
          const sr = await fetch("/api/video-status?task_id=" + data.task_id + "&mode=" + capturedMode + "&provider=" + genProvider);
          const sd = await sr.json() as { completed?: boolean; failed?: boolean; video_url?: string };

          if (sd.completed && sd.video_url) {
            if (timedOut) return;
            setVideoUrl(sd.video_url); setProgress(100); setLoading(false); clearInterval(poll);
            try {
              const { data: { session: fs } } = await supabase.auth.getSession();
              if (fs) {
                await fetch("/api/generations", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: "Bearer " + fs.access_token },
                  body: JSON.stringify({ type: capturedModule, prompt, video_url: sd.video_url, status: "completed", tokens_used: capturedCost, duration, aspect_ratio: aspectRatio, model: capturedModel }),
                });
              }
            } catch (e) { console.error("Save error:", e); }
          } else if (sd.failed) {
            setError("Generation failed. Tokens refunded."); setLoading(false); clearInterval(poll);
            try {
              const { data: { session: rs } } = await supabase.auth.getSession();
              if (rs) {
                const rr = await fetch("/api/tokens/refund", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: "Bearer " + rs.access_token },
                  body: JSON.stringify({ amount: capturedCost }),
                });
                const rd = await rr.json();
                if (rd.balance !== undefined) setTokenBalance(rd.balance);
              }
            } catch (e) { console.error("Refund error:", e); }
          }
        } catch (e) { console.error("Poll error:", e); }
      }, 5000);

      setTimeout(async () => {
  if (videoUrl) return;
  timedOut = true;
  clearInterval(poll);
  setLoading(false);
  setError("Generation timed out after 5 minutes. Tokens refunded.");
  const { data: { session: ts } } = await supabase.auth.getSession();
  if (ts) {
    const rr = await fetch("/api/tokens/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + ts.access_token },
      body: JSON.stringify({ amount: capturedCost }),
    });
    const rd = await rr.json();
    if (rd.balance !== undefined) setTokenBalance(rd.balance);
  }
}, 300000);

    } catch (e) { setError("Something went wrong."); setLoading(false); }
  };

  const handleDownload = async (url: string) => {
    try {
      const r = await fetch(url);
      const b = await r.blob();
      const bu = window.URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = bu; a.download = "klipflowai-" + Date.now() + ".mp4";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(bu);
    } catch { window.open(url, "_blank"); }
  };

  const resetForm = () => {
    setActiveModule(null); setPrompt(""); setError(""); setVideoUrl(null);
    setImageFile(null); setImagePreview(""); setImageUrlInput(""); setUseUrl(false);
    setProgress(0); setElapsedTime(0); setSelectedModel("kling-v1-6-pro");
  };

  const currentModel = ALL_MODELS.find((m) => m.id === selectedModel);
  const durationMultiplier = duration === "5" ? 1 : duration === "8" ? 1.6 : duration === "10" ? 2 : duration === "15" ? 3 : 1;
  const tokenCost = Math.ceil((currentModel?.tokens ?? 15) * durationMultiplier);
  const needsImage = activeModule === "image_to_video" || activeModule === "ugc_ad";
  const showModels = activeModule === "text_to_video" || activeModule === "image_to_video" || activeModule === "ugc_ad" || activeModule === "ai_actor";

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-extrabold mb-0.5">Video Studio</h1>
        <p className="text-gray-400 text-xs">8 AI modules — all plans include all features</p>
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

      {activeModule && !loading && !videoUrl && (
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
                      {imagePreview
                        ? <img src={imagePreview} alt="Preview" className="max-h-40 mx-auto rounded-lg object-contain" />
                        : <div><p className="text-gray-400 text-sm font-semibold mb-1">Click to upload image</p><p className="text-gray-600 text-xs">JPG, PNG, WebP up to 10MB</p></div>
                      }
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

            <div>
              <label className="text-gray-400 text-xs mb-1 block">
                {activeModule === "ugc_ad" ? "Describe the UGC ad scenario" : activeModule === "script" ? "Describe your video topic" : activeModule === "prompt" ? "Simple idea to expand" : "Describe your video"}
              </label>
              <textarea
                placeholder={activeModule === "ugc_ad" ? "Woman in kitchen holding product, smiling, authentic testimonial style..." : "A luxury watch rotating slowly on a marble surface, golden hour lighting, cinematic 4K..."}
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
                        {model.badge && <div className={"text-xs font-bold px-1.5 py-0.5 rounded-full mb-1 inline-block " + (model.available ? "bg-purple-900/40 text-purple-300" : "bg-gray-900/40 text-gray-500")}>{model.badge}</div>}
                        <div className="font-bold text-xs mb-0.5">{model.name}</div>
                        <div className="text-gray-500 text-xs">{model.tokens} tokens — {model.desc}</div>
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
              Generate — {tokenCost} tokens
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
          <div className="text-center">
            <h3 className="font-bold mb-1">Generating Your Video</h3>
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
              { label: "Video frames generated", done: elapsedTime >= 60 },
              { label: "Cinematic details rendered", done: elapsedTime >= 120 },
              { label: "Video finalized", done: !!videoUrl },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={step.done ? "text-green-400" : "text-gray-600"}>{step.done ? "✓" : "○"}</span>
                <span className={step.done ? "text-gray-300" : "text-gray-600"}>{step.label}</span>
              </div>
            ))}
          </div>
          <p className="text-gray-500 text-xs text-center">Keep this page open. Average: 1-3 minutes.</p>
        </div>
      )}

      {videoUrl && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-green-400 font-bold">Done!</span>
            <h3 className="font-bold">Your Video is Ready</h3>
          </div>
          <video src={videoUrl} controls playsInline className="w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => handleDownload(videoUrl)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition text-sm">Save Video</button>
            <button onClick={resetForm} className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition text-sm">Generate Another</button>
          </div>
          <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-3">
            <p className="text-blue-300 text-xs font-semibold mb-1">iPhone users</p>
            <p className="text-gray-400 text-xs">Tap and hold the video, then select Save to Photos.</p>
          </div>
        </div>
      )}
    </div>
  );
}
