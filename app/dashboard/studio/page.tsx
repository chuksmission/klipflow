'use client';
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function Studio() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("5");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [withSound, setWithSound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [tokenBalance, setTokenBalance] = useState(25);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      setElapsedTime(0);
      setProgress(0);
      timer = setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          // Simulate progress — reaches ~90% over 3 minutes
          const simulatedProgress = Math.min(90, (newTime / 180) * 100);
          setProgress(simulatedProgress);
          return newTime;
        });
      }, 1000);
    } else {
      if (videoUrl) setProgress(100);
    }
    return () => clearInterval(timer);
  }, [loading, videoUrl]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const getStatusMessage = (elapsed: number) => {
    if (elapsed < 10) return "Initializing AI models...";
    if (elapsed < 30) return "Analyzing your prompt...";
    if (elapsed < 60) return "Generating video frames...";
    if (elapsed < 120) return "Rendering cinematic details...";
    if (elapsed < 150) return "Adding final touches...";
    return "Almost ready, finalizing...";
  };

  const modules = [
    { id: "text_to_video", icon: "📝", title: "Text to Video", desc: "Generate cinematic videos from text", tokens: "10 tokens", badge: "Most Popular" },
    { id: "image_to_video", icon: "🖼️", title: "Image to Video", desc: "Animate any still image into video", tokens: "10 tokens", badge: "" },
    { id: "ai_actor", icon: "🧑‍🎤", title: "AI Actor", desc: "Create photorealistic AI human avatars", tokens: "10 tokens", badge: "" },
    { id: "ugc", icon: "🤝", title: "UGC Avatar", desc: "Authentic testimonial-style videos", tokens: "10 tokens", badge: "" },
    { id: "voice", icon: "🎙️", title: "Voice Generation", desc: "Natural AI voiceovers for videos", tokens: "5 tokens", badge: "" },
    { id: "image_ad", icon: "🎨", title: "Image Ad", desc: "Scroll-stopping image advertisements", tokens: "2 tokens", badge: "Cheapest" },
    { id: "prompt", icon: "✨", title: "Prompt Expander", desc: "Transform ideas into cinematic prompts", tokens: "1 token", badge: "" },
    { id: "script", icon: "✍️", title: "Script Writer", desc: "Generate viral video scripts", tokens: "1 token", badge: "" },
  ];

  const handleGenerate = async () => {
    if (!prompt) {
      setError("Please enter a prompt.");
      return;
    }
    setLoading(true);
    setError("");
    setVideoUrl(null);
    setStatus("Starting generation...");
    setProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Please sign in to generate videos.");
        setLoading(false);
        return;
      }

      // Deduct tokens first
      const tokenRes = await fetch('/api/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ amount: 10 })
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        setError(tokenData.error || 'Insufficient tokens.');
        setLoading(false);
        return;
      }

      setTokenBalance(tokenData.balance);

      const finalPrompt = withSound
        ? `${prompt}. Include natural ambient sound and audio.`
        : prompt;

      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          mode: activeModule === 'image_to_video' ? 'image_to_video' : 'text_to_video',
          image_url: imageUrl || undefined,
          duration,
          aspect_ratio: aspectRatio,
          model: 'kling-v1'
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Generation failed.');
        setLoading(false);
        return;
      }

      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/video-status?task_id=${data.task_id}`);
          const statusData = await statusRes.json();
          if (statusData.completed && statusData.video_url) {
            setVideoUrl(statusData.video_url);
            setStatus("Video ready!");
            setProgress(100);
            setLoading(false);
            clearInterval(pollInterval);

            // Save generation to database
            await fetch('/api/generations', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                type: activeModule,
                prompt: finalPrompt,
                video_url: statusData.video_url,
                status: 'completed',
                tokens_used: 10,
                duration,
                aspect_ratio: aspectRatio
              })
            });

          } else if (statusData.failed) {
            setError("Generation failed. Please try again.");
            setLoading(false);
            clearInterval(pollInterval);
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 5000);

      setTimeout(() => {
        clearInterval(pollInterval);
        setLoading(false);
      }, 300000);

    } catch (err) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const resetForm = () => {
    setActiveModule(null);
    setPrompt("");
    setError("");
    setVideoUrl(null);
    setStatus("");
    setImageUrl("");
    setProgress(0);
    setElapsedTime(0);
    setWithSound(false);
  };

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `klipflowai-video-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-extrabold mb-0.5">Video Studio</h1>
        <p className="text-gray-400 text-xs">9 AI modules — all features included</p>
      </div>

      {/* TOKEN BALANCE */}
      <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-3 flex items-center justify-between">
        <div>
          <p className="text-purple-300 font-semibold text-sm">🪙 {tokenBalance} tokens remaining</p>
          <p className="text-gray-500 text-xs">1 video = 10 tokens · Top up from $5</p>
        </div>
        <a href="/dashboard/billing" className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-1.5 px-3 rounded-full transition">
          Top Up
        </a>
      </div>

      {/* MODULE GRID */}
      {!activeModule && (
        <div className="grid grid-cols-2 gap-3">
          {modules.map((mod) => (
            <div
              key={mod.id}
              onClick={() => setActiveModule(mod.id)}
              className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-purple-500/50 transition cursor-pointer"
            >
              {mod.badge && (
                <div className="inline-block bg-purple-900/40 text-purple-300 text-xs font-bold px-2 py-0.5 rounded-full mb-2">
                  {mod.badge}
                </div>
              )}
              <div className="text-2xl mb-2">{mod.icon}</div>
              <h3 className="font-bold text-sm mb-1">{mod.title}</h3>
              <p className="text-gray-500 text-xs mb-2 leading-relaxed">{mod.desc}</p>
              <span className="text-purple-400 text-xs font-bold">{mod.tokens}</span>
            </div>
          ))}
        </div>
      )}

      {/* GENERATION FORM */}
      {activeModule && !loading && !videoUrl && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={resetForm} className="text-gray-400 hover:text-white text-sm transition">
              ← Back
            </button>
            <h2 className="font-bold text-sm">
              {modules.find(m => m.id === activeModule)?.icon}{" "}
              {modules.find(m => m.id === activeModule)?.title}
            </h2>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">

            {activeModule === 'image_to_video' && (
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Image URL</label>
                <input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm"
                />
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

            {(activeModule === 'text_to_video' || activeModule === 'image_to_video') && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Duration</label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm"
                    >
                      <option value="5">5 seconds</option>
                      <option value="10">10 seconds</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Aspect Ratio</label>
                    <select
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm"
                    >
                      <option value="16:9">16:9 YouTube</option>
                      <option value="9:16">9:16 TikTok</option>
                      <option value="1:1">1:1 Feed</option>
                    </select>
                  </div>
                </div>

                {/* SOUND TOGGLE */}
                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">🔊 Generate with Sound</p>
                    <p className="text-gray-500 text-xs">Add ambient audio to your video</p>
                  </div>
                  <button
                    onClick={() => setWithSound(!withSound)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${withSound ? 'bg-purple-600' : 'bg-white/20'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${withSound ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition"
            >
              Generate — 10 tokens
            </button>
          </div>
        </div>
      )}

      {/* LOADING / PROGRESS */}
      {loading && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-2 animate-pulse">🎬</div>
            <h3 className="font-bold mb-1">Generating Your Video</h3>
            <p className="text-gray-400 text-sm">{getStatusMessage(elapsedTime)}</p>
          </div>

          {/* PROGRESS BAR */}
          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span>{Math.round(progress)}% complete</span>
              <span>⏱ {formatTime(elapsedTime)} elapsed</span>
            </div>
            <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-pink-500 rounded-full transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* STEPS */}
          <div className="space-y-2">
            {[
              { label: "AI models initialized", done: elapsedTime >= 10 },
              { label: "Prompt analyzed", done: elapsedTime >= 30 },
              { label: "Video frames generated", done: elapsedTime >= 60 },
              { label: "Cinematic details rendered", done: elapsedTime >= 120 },
              { label: "Video finalized", done: !!videoUrl },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={step.done ? "text-green-400" : "text-gray-600"}>
                  {step.done ? "✓" : "○"}
                </span>
                <span className={step.done ? "text-gray-300" : "text-gray-600"}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          <p className="text-gray-500 text-xs text-center">
            Please keep this page open. Average generation time is 1-3 minutes.
          </p>
        </div>
      )}

      {/* VIDEO RESULT */}
      {videoUrl && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-lg">✅</span>
            <h3 className="font-bold">Your Video is Ready!</h3>
          </div>

          <video
            src={videoUrl}
            controls
            playsInline
            className="w-full rounded-xl"
          />

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleDownload(videoUrl)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition text-sm"
            >
              ⬇️ Save Video
            </button>
            <button
              onClick={resetForm}
              className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition text-sm"
            >
              Generate Another
            </button>
          </div>

          {/* MOBILE SAVE TIP */}
          <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-3 space-y-2">
            <p className="text-blue-300 text-xs font-semibold">📱 How to Save Your Video</p>
            <p className="text-gray-400 text-xs">
              <span className="text-white font-semibold">iPhone:</span> Tap "Save Video" → tap "Download" in the popup → open your Files app → find the video → tap Share → "Save to Photos"
            </p>
            <p className="text-gray-400 text-xs">
              <span className="text-white font-semibold">Android:</span> Tap "Save Video" → video saves directly to your Downloads folder → open Gallery app to find it.
            </p>
            <p className="text-gray-400 text-xs">
              <span className="text-white font-semibold">Desktop:</span> Click "Save Video" → video downloads automatically to your Downloads folder.
            </p>
          </div>

          <p className="text-gray-500 text-xs text-center">
            Watermark-free downloads available on paid plans
          </p>
        </div>
      )}
    </div>
  );
}