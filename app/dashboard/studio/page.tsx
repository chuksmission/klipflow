'use client';
import { useState } from "react";

export default function Studio() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("5");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
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
    setTaskId(null);
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

      setTaskId(data.task_id);
      setStatus("Video generating... this takes 1-3 minutes.");

      // Poll for status
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

      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (!videoUrl) {
          setError("Generation timed out. Please try again.");
          setLoading(false);
        }
      }, 300000);

    } catch (err) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold mb-1">Video Studio</h1>
        <p className="text-gray-400 text-sm">9 AI modules — every plan includes all features</p>
      </div>

      {/* TOKEN BALANCE */}
      <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-purple-300 font-semibold text-sm">🪙 Token Balance: 25 tokens</p>
          <p className="text-gray-500 text-xs">Each video costs 10 tokens. Top up anytime from $5.</p>
        </div>
        <a href="/dashboard/billing" className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2 px-4 rounded-full transition">
          Top Up →
        </a>
      </div>

      {/* MODULE GRID */}
      {!activeModule && (
        <div className="grid md:grid-cols-3 gap-4">
          {modules.map((mod) => (
            <div
              key={mod.id}
              onClick={() => setActiveModule(mod.id)}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-purple-500/50 transition cursor-pointer group"
            >
              {mod.badge && (
                <div className="inline-block bg-purple-900/40 text-purple-300 text-xs font-bold px-2 py-0.5 rounded-full mb-3">{mod.badge}</div>
              )}
              <div className="text-3xl mb-3">{mod.icon}</div>
              <h3 className="font-bold mb-1 group-hover:text-purple-400 transition">{mod.title}</h3>
              <p className="text-gray-500 text-xs mb-3 leading-relaxed">{mod.desc}</p>
              <div className="flex items-center justify-between">
                <span className="text-purple-400 text-xs font-bold">{mod.tokens}</span>
                <span className="text-gray-600 text-xs">Click to use →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* GENERATION FORM */}
      {activeModule && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                s