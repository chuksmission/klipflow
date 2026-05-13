'use client';
import { useState } from "react";

export default function Studio() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("5");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const modules = [
    { id: "text_to_video", icon: "📝", title: "Text to Video", desc: "Generate cinematic videos from text descriptions", tokens: "10 tokens", badge: "Most Popular" },
    { id: "image_to_video", icon: "🖼️", title: "Image to Video", desc: "Animate any still image into a stunning video", tokens: "10 tokens", badge: "" },
    { id: "ai_actor", icon: "🧑‍🎤", title: "AI Actor Generator", desc: "Create photorealistic AI human avatars", tokens: "10 tokens", badge: "" },
    { id: "ugc", icon: "🤝", title: "UGC Avatar Video", desc: "Create authentic testimonial-style videos", tokens: "10 tokens", badge: "" },
    { id: "voice", icon: "🎙️", title: "Voice Generation", desc: "Generate natural AI voiceovers", tokens: "5 tokens", badge: "" },
    { id: "image_ad", icon: "🎨", title: "AI Image Ad", desc: "Generate scroll-stopping image advertisements", tokens: "2 tokens", badge: "Cheapest" },
    { id: "prompt", icon: "✨", title: "Prompt Expander", desc: "Transform simple ideas into cinematic prompts", tokens: "1 token", badge: "" },
    { id: "script", icon: "✍️", title: "AI Script Writer", desc: "Generate viral video scripts for any niche", tokens: "1 token", badge: "" },
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

    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
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

      setStatus("Video generating... this takes 1-3 minutes.");

      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/video-status?task_id=${data.task_id}`);
          const statusData = await statusRes.json();
          if (statusData.completed && statusData.video_url) {
            setVideoUrl(statusData.video_url);
            setStatus("Video ready!");
            setLoading(false);
            clearInterval(pollInterval);
          } else if (statusData.failed) {
            setError("Video generation failed. Please try again.");
            setLoading(false);
            clearInterval(pollInterval);
          } else {
            setStatus(`Generating... ${statusData.progress || 'Please wait'}`);
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
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold mb-1">Video Studio</h1>
        <p className="text-gray-400 text-sm">9 AI modules — every plan includes all features</p>
      </div>

      <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-purple-300 font-semibold text-sm">🪙 Token Balance: 25 tokens</p>
          <p className="text-gray-500 text-xs">Each video costs 10 tokens. Top up anytime from $5.</p>
        </div>
        <a href="/dashboard/billing" className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2 px-4 rounded-full transition">
          Top Up
        </a>
      </div>

      {!activeModule && (
        <div className="grid md:grid-cols-3 gap-4">
          {modules.map((mod) => (
            <div
              key={mod.id}
              onClick={() => setActiveModule(mod.id)}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-purple-500/50 transition cursor-pointer group"
            >
              {mod.badge && (
                <div className="inline-block bg-purple-900/40 text-purple-300 text-xs font-bold px-2 py-0.5 rounded-full mb-3">
                  {mod.badge}
                </div>
              )}
              <div className="text-3xl mb-3">{mod.icon}</div>
              <h3 className="font-bold mb-1 group-hover:text-purple-400 transition">{mod.title}</h3>
              <p className="text-gray-500 text-xs mb-3 leading-relaxed">{mod.desc}</p>
              <div className="flex items-center justify-between">
                <span className="text-purple-400 text-xs font-bold">{mod.tokens}</span>
                <span className="text-gray-600 text-xs">Click to use</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeModule && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-white text-sm transition"
            >
              Back
            </button>
            <h2 className="font-bold">
              {modules.find(m => m.id === activeModule)?.icon}{" "}
              {modules.find(m => m.id === activeModule)?.title}
            </h2>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">

            {activeModule === 'image_to_video' && (
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Image URL</label>
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
              <label className="text-gray-400 text-sm mb-1 block">
                {activeModule === 'script' ? 'Describe your video topic' :
                 activeModule === 'prompt' ? 'Simple idea to expand' :
                 'Describe your video'}
              </label>
              <textarea
                placeholder={
                  activeModule === 'text_to_video'
                    ? 'A luxury watch rotating slowly on a marble surface, golden hour lighting, cinematic...'
                    : activeModule === 'image_to_video'
                    ? 'Describe how you want the image to move...'
                    : 'Describe what you want to create...'
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm resize-none"
              />
            </div>

            {(activeModule === 'text_to_video' || activeModule === 'image_to_video') && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Duration</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition text-sm"
                  >
                    <option value="5">5 seconds</option>
                    <option value="10">10 seconds</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Aspect Ratio</label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition text-sm"
                  >
                    <option value="16:9">16:9 YouTube</option>
                    <option value="9:16">9:16 TikTok</option>
                    <option value="1:1">1:1 Feed</option>
                  </select>
                </div>
              </div>
            )}

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            {status && !error && (
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-3">
                <p className="text-purple-300 text-sm">
                  {loading && "⏳ "}
                  {status}
                </p>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition"
            >
              {loading ? 'Generating...' : 'Generate — 10 tokens'}
            </button>
          </div>

          {videoUrl && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="font-bold mb-4">Your Video is Ready!</h3>
              <video
                src={videoUrl}
                controls
                className="w-full rounded-xl mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => window.open(videoUrl, '_blank')}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition text-sm"
                >
                  Download Video
                </button>
                <button
                  onClick={resetForm}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition text-sm"
                >
                  Generate Another
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}