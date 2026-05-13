export default function Studio() {
  const modules = [
    { icon: "📝", title: "Text to Video", desc: "Generate cinematic videos from text descriptions", tokens: "10 tokens", badge: "Most Popular" },
    { icon: "🖼️", title: "Image to Video", desc: "Animate any still image into a stunning video", tokens: "10 tokens", badge: "" },
    { icon: "🧑‍🎤", title: "AI Actor Generator", desc: "Create photorealistic AI human avatars", tokens: "10 tokens", badge: "" },
    { icon: "📸", title: "Upload Your Actor", desc: "Generate videos using your own talent's photo", tokens: "10 tokens", badge: "" },
    { icon: "🤝", title: "UGC Avatar Video", desc: "Create authentic testimonial-style videos", tokens: "10 tokens", badge: "" },
    { icon: "🎙️", title: "Voice Generation", desc: "Generate natural AI voiceovers for your videos", tokens: "5 tokens", badge: "" },
    { icon: "🖼️", title: "AI Image Ad", desc: "Generate scroll-stopping image advertisements", tokens: "2 tokens", badge: "Cheapest" },
    { icon: "✨", title: "Prompt Expander", desc: "Transform simple ideas into cinematic prompts", tokens: "1 token", badge: "Free Almost" },
    { icon: "✍️", title: "AI Script Writer", desc: "Generate viral video scripts for any niche", tokens: "1 token", badge: "" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold mb-1">Video Studio</h1>
        <p className="text-gray-400 text-sm">9 AI modules — every plan includes all features</p>
      </div>

      <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-purple-300 font-semibold text-sm">🪙 Your Token Balance: 25 tokens</p>
          <p className="text-gray-500 text-xs">Each video costs 10 tokens. Top up anytime from $5.</p>
        </div>
        <a href="/dashboard/billing" className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2 px-4 rounded-full transition">
          Top Up →
        </a>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {modules.map((mod, i) => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-purple-500/50 transition cursor-pointer group">
            {mod.badge && (
              <div className="inline-block bg-purple-900/40 text-purple-300 text-xs font-bold px-2 py-0.5 rounded-full mb-3">{mod.badge}</div>
            )}
            <div className="text-3xl mb-3">{mod.icon}</div>
            <h3 className="font-bold mb-1 group-hover:text-purple-400 transition">{mod.title}</h3>
            <p className="text-gray-500 text-xs mb-3 leading-relaxed">{mod.desc}</p>
            <div className="flex items-center justify-between">
              <span className="text-purple-400 text-xs font-bold">{mod.tokens}</span>
              <button className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-1.5 px-4 rounded-full transition">
                Coming Soon
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}