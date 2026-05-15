"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";

export default function Studio() {
  const [activeModule, setActiveModule] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("5");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [withSound, setWithSound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [useUrl, setUseUrl] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [tokenBalance, setTokenBalance] = useState(25);
  const [selectedModel, setSelectedModel] = useState("kling-v1");
  const fileInputRef = useRef(null);

  // token cost stored in ref so polling closure can access it
  const tokenCostRef = useRef(10);
  const selectedModelRef = useRef("kling-v1");
  const activeModuleRef = useRef(null);
  const promptRef = useRef("");

  useEffect(() => { selectedModelRef.current = selectedModel; }, [selectedModel]);
  useEffect(() => { activeModuleRef.current = activeModule; }, [activeModule]);
  useEffect(() => { promptRef.current = prompt; }, [prompt]);

  const models = [
    { id: "kling-v1", name: "Kling v1", desc: "Fast & affordable", tokens: 10, badge: "", available: true },
    { id: "kling-v2", name: "Kling v2", desc: "Better quality + sound", tokens: 15, badge: "With Sound", available: true },
    { id: "kling-v3", name: "Kling v3", desc: "Highest quality", tokens: 20, badge: "Best Quality", available: true },
    { id: "runway-gen4", name: "Runway Gen-4", desc: "Professional cinematic", tokens: 20, badge: "Coming Soon", available: false },
    { id: "veo3", name: "Google Veo 3", desc: "Cinematic + audio", tokens: 25, badge: "Coming Soon", available: false },
    { id: "sora", name: "OpenAI Sora", desc: "Creative & surreal", tokens: 25, badge: "Coming Soon", available: false },
  ];

  const modules = [
    { id: "text_to_video", icon: "VIDEO", title: "Text to Video", desc: "Generate cinematic videos from text descriptions", badge: "Most Popular" },
    { id: "image_to_video", icon: "IMG", title: "Image to Video", desc: "Animate any still image into a stunning video", badge: "" },
    { id: "ai_actor", icon: "ACT", title: "AI Actor", desc: "Create photorealistic AI human avatars", badge: "" },
    { id: "ugc", icon: "UGC", title: "UGC Avatar", desc: "Authentic testimonial-style videos", badge: "" },
    { id: "voice", icon: "MIC", title: "Voice Generation", desc: "Natural AI voiceovers for videos", badge: "" },
    { id: "image_ad", icon: "IMG", title: "Image Ad", desc: "Scroll-stopping image advertisements", badge: "Cheapest" },
    { id: "prompt", icon: "AI", title: "Prompt Expander", desc: "Transform ideas into cinematic prompts", badge: "" },
    { id: "script", icon: "PEN", title: "Script Writer", desc: "Generate viral video scripts", badge: "" },
  ];

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (loading) {
      setElapsedTime(0);
      setProgress(0);
      timer = setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          setProgress(Math.min(90, (newTime / 180) * 100));
          return newTime;
        });
      }, 1000);
    } else if (videoUrl) {
      setProgress(100);
    }
    return () => clearInterval(timer);
  }, [loading, videoUrl]);

  useEffect(() => {
    const fetchBalance = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/tokens", { headers: { Authorization: "Bearer " + session.access_token } });
      const data = await res.json();
      if (data.balance !== undefined) setTokenBalance(data.balance);
    };
    fetchBalance();
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? m + "m " + s + "s" : s + "s";
  };

  const getStatusMessage = (elapsed: number) => {
    if (elapsed < 10) return "Initializing AI models...";
    if (elapsed < 30) return "Analyzing your prompt...";
    if (elapsed < 60) return "Generating video frames...";
    if (elapsed < 120) return "Rendering cinematic details...";
    return "Almost ready, finalizing...";
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const uploadImageToSupabase = async (file) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const ext = file.name.split(".").pop();
    const filename = session.user.id + "-" + Date.now() + "." + ext;
    const { data, error } = await supabase.storage
      .from("generation-inputs")
      .upload(filename, file, { contentType: file.type });
    if (error) {
      console.error("Upload error:", error);
      return null;
    }
    const { data: { publicUrl } } = supabase.storage.from("generation-inputs").getPublicUrl(filename);
    return publicUrl;
  };

  const handleGenerate = async () => {
    if (!prompt) { setError("Please enter a prompt."); return; }
    if (activeModule === "image_to_video" && !imageFile && !imageUrlInput) {
      setError("Please upload an image or enter an image URL.");
      return;
    }

    setLoading(true);
    setError("");
    setVideoUrl(null);
    setProgress(0);

    const modelData = models.find(m => m.id === selectedModel);
    const tokenCost = modelData?.tokens || 10;
    tokenCostRef.current = tokenCost;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Please sign in to generate videos."); setLoading(false); return; }

      // Deduct tokens first
      const tokenRes = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ amount: tokenCost }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) { setError(tokenData.error || "Insufficient tokens."); setLoading(false); return; }
      setTokenBalance(tokenData.balance);

      // Handle image upload for image_to_video
      let imageUrl = imageUrlInput;
      if (activeModule === "image_to_video" && imageFile && !useUrl) {
        setStatus("Uploading image...");
        const uploaded = await uploadImageToSupabase(imageFile);
        if (!uploaded) { setError("Image upload failed. Try using a URL instead."); setLoading(false); return; }
        imageUrl = uploaded;
      }

      const useAudio = withSound || selectedModel === "kling-v2" || selectedModel === "kling-v3";
      const finalPrompt = prompt;

      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          mode: activeModule === "image_to_video" ? "image_to_video" : "text_to_video",
          image_url: imageUrl || undefined,
          duration,
          aspect_ratio: aspectRatio,
          model: selectedModel,
          with_audio: useAudio,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || "Generation failed."); setLoading(false); return; }

      setStatus("Generating...");
      const capturedModule = activeModuleRef.current;
      const capturedPrompt = finalPrompt;
      const capturedCost = tokenCostRef.current;
      const capturedModel = selectedModelRef.current;

      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch("/api/video-status?task_id=" + data.task_id);
          const statusData = await statusRes.json();

          if (statusData.completed && statusData.video_url) {
            setVideoUrl(statusData.video_url);
            setStatus("Video ready!");
            setProgress(100);
            setLoading(false);
            clearInterval(pollInterval);

            // Save to DB with fresh session
            try {
              const { data: { session: freshSession } } = await supabase.auth.getSession();
              if (freshSession) {
                await fetch("/api/generations", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + freshSession.access_token,
                  },
                  body: JSON.stringify({
                    type: capturedModule,
                    prompt: capturedPrompt,
                    video_url: statusData.video_url,
                    status: "completed",
                    tokens_used: capturedCost,
                    duration,
                    aspect_ratio: aspectRatio,
                    model: capturedModel,
                  }),
                });
              }
            } catch (saveErr) {
              console.error("Save generation error:", saveErr);
            }

          } else if (statusData.failed) {
            setError("Generation failed. Please try again.");
            setLoading(false);
            clearInterval(pollInterval);
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 5000);

      setTimeout(() => {
        clearInterval(pollInterval);
        if (loading) { setLoading(false); setError("Timed out. Please try again."); }
      }, 300000);

    } catch (err) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = "klipflowai-" + Date.now() + ".mp4";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  const resetForm = () => {
    setActiveModule(null);
    setPrompt("");
    setError("");
    setVideoUrl(null);
    setStatus("");
    setImageFile(null);
    setImagePreview("");
    setImageUrlInput("");
    setUseUrl(false);
    setProgress(0);
    setElapsedTime(0);
    setWithSound(false);
    setSelectedModel("kling-v1");
  };

  const tokenCost = models.find(m => m.id === selectedModel)?.tokens || 10;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-extrabold mb-0.5">Video Studio</h1>
        <p className="text-gray-400 text-xs">9 AI modules — all features included</p>
      </div>

      <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-3 flex items-center justify-between">
        <div>
          <p className="text-purple-300 font-semibold text-sm">{tokenBalance} tokens remaining</p>
          <p className="text-gray-500 text-xs">1 video = {tokenCost} tokens · Top up from $5</p>
        </div>
        <a href="/dashboard/billing" className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-1.5 px-3 rounded-full transition">Top Up</a>
      </div>

      {!activeModule && (
        <div className="grid grid-cols-2 gap-3">
          {modules.map((mod) => (
            <div key={mod.id} onClick={() => setActiveModule(mod.id)} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-purple-500/50 transition cursor-pointer">
              {mod.badge && <div className="inline-block bg-purple-900/40 text-purple-300 text-xs font-bold px-2 py-0.5 rounded-full mb-2">{mod.badge}</div>}
              <div className="text-purple-400 text-xs font-bold mb-2">[{mod.icon}]</div>
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
            <h2 className="font-bold text-sm">{modules.find(m => m.id === activeModule)?.title}</h2>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">

            {activeModule === "image_to_video" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 mb-2">
                  <button onClick={() => setUseUrl(false)} className={"px-3 py-1.5 rounded-full text-xs font-bold transition " + (!useUrl ? "bg-purple-600 text-white" : "bg-white/10 text-gray-400")}>
                    Upload Image
                  </button>
                  <button onClick={() => setUseUrl(true)} className={"px-3 py-1.5 rounded-full text-xs font-bold transition " + (useUrl ? "bg-purple-600 text-white" : "bg-white/10 text-gray-400")}>
                    Use URL
                  </button>
                </div>

                {!useUrl ? (
                  <div>
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageFile} className="hidden" />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-white/20 hover:border-purple-500/50 rounded-xl p-6 text-center cursor-pointer transition"
                    >
                      {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="max-h-40 mx-auto rounded-lg object-contain" />
                      ) : (
                        <div>
                          <p className="text-gray-400 text-sm font-semibold mb-1">Click to upload image</p>
                          <p className="text-gray-600 text-xs">JPG, PNG, WebP up to 10MB</p>
                        </div>
                      )}
                    </div>
                    {imageFile && <p className="text-green-400 text-xs">{imageFile.name} ready</p>}
                  </div>
                ) : (
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Image URL</label>
                    <input
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm"
                    />
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-gray-400 text-xs mb-1 block">Describe your video</label>
              <textarea
                placeholder="A luxury watch rotating slowly on a marble surface, golden hour lighting, cinematic 4K..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm resize-none"
              />
            </div>

            {(activeModule === "text_to_video" || activeModule === "image_to_video") && (
              <>
                <div>
                  <label className="text-gray-400 text-xs mb-2 block">AI Model</label>
                  <div className="grid grid-cols-3 gap-2">
                    {models.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => model.available && setSelectedModel(model.id)}
                        disabled={!model.available}
                        className={"relative p-3 rounded-xl border text-left transition " + (
                          selectedModel === model.id
                            ? "border-purple-500 bg-purple-900/30"
                            : model.available
                            ? "border-white/10 bg-white/5 hover:border-purple-500/50"
                            : "border-white/5 bg-white/5 opacity-40 cursor-not-allowed"
                        )}
                      >
                        {model.badge && (
                          <div className={"text-xs font-bold px-1.5 py-0.5 rounded-full mb-1 inline-block " + (model.available ? "bg-purple-900/40 text-purple-300" : "bg-gray-900/40 text-gray-500")}>
                            {model.badge}
                          </div>
                        )}
                        <div className="font-bold text-xs mb-0.5">{model.name}</div>
                        <div className="text-gray-500 text-xs">{model.tokens} tokens</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Duration</label>
                    <select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm">
                      <option value="5">5 seconds</option>
                      <option value="10">10 seconds</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Aspect Ratio</label>
                    <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm">
                      <option value="16:9">16:9 YouTube</option>
                      <option value="9:16">9:16 TikTok</option>
                      <option value="1:1">1:1 Feed</option>
                    </select>
                  </div>
                </div>

                {selectedModel === "kling-v1" && (
                  <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">Generate with Sound</p>
                      <p className="text-gray-500 text-xs">Add ambient audio (uses Kling v2)</p>
                    </div>
                    <button onClick={() => setWithSound(!withSound)} className={"relative w-12 h-6 rounded-full transition-colors " + (withSound ? "bg-purple-600" : "bg-white/20")}>
                      <div className={"absolute top-1 w-4 h-4 bg-white rounded-full transition-all " + (withSound ? "left-7" : "left-1")} />
                    </button>
                  </div>
                )}

                {(selectedModel === "kling-v2" || selectedModel === "kling-v3") && (
                  <div className="bg-green-900/20 border border-green-500/20 rounded-xl px-4 py-3">
                    <p className="text-green-400 text-xs font-semibold">Sound included with {selectedModel === "kling-v2" ? "Kling v2" : "Kling v3"}</p>
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
            <p className="text-gray-400 text-sm">{getStatusMessage(elapsedTime)}</p>
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
          <p className="text-gray-500 text-xs text-center">Keep this page open. Average time: 1-3 minutes.</p>
        </div>
      )}

      {videoUrl && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <h3 className="font-bold">Your Video is Ready!</h3>
          </div>
          <video src={videoUrl} controls playsInline className="w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => handleDownload(videoUrl)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition text-sm">
              Save Video
            </button>
            <button onClick={resetForm} className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition text-sm">
              Generate Another
            </button>
          </div>
          <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-3">
            <p className="text-blue-300 text-xs font-semibold mb-1">iPhone users</p>
            <p className="text-gray-400 text-xs">Tap and hold the video, then select "Save to Photos" or use the Share button.</p>
          </div>
        </div>
      )}
    </div>
  );
}
