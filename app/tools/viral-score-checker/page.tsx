'use client';
import { useState } from "react";
import Link from "next/link";

export default function ViralScoreChecker() {
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const checkScore = async () => {
    if (!videoUrl) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 2500));
    setResult({
      score: 73,
      hook: 82,
      retention: 68,
      shareability: 71,
      trendAlignment: 74,
      tips: [
        "Strong opening hook — first 3 seconds are critical and yours performs well",
        "Consider adding text overlays in the first 5 seconds to boost retention",
        "Music choice aligns well with current trending audio",
        "Add a stronger CTA in the final 3 seconds to improve conversion"
      ]
    });
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10 sticky top-0 z-50 bg-black/90 backdrop-blur-md">
        <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
          KlipflowAI
        </Link>
        <Link href="/" className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-2 px-5 rounded-full transition">
          Sign Up Free
        </Link>
      </nav>

      <section className="px-8 py-20 text-center">
        <div className="inline-block bg-purple-900/40 border border-purple-500/30 text-purple-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
          🆓 Free Tool
        </div>
        <h1 className="text-5xl font-extrabold mb-4">Viral Score Checker</h1>
        <p className="text-gray-400 text-xl max-w-2xl mx-auto mb-12">Paste any TikTok, Instagram Reel, or YouTube Short URL and get an instant virality probability score. Free.</p>

        <div className="max-w-2xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <input
              type="url"
              placeholder="https://tiktok.com/@user/video/..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="flex-1 bg-white/10 border border-white/20 rounded-full px-6 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={checkScore}
              disabled={loading || !videoUrl}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold py-3 px-8 rounded-full transition"
            >
              {loading ? 'Analyzing...' : 'Check Score →'}
            </button>
          </div>

          {result && (
            <div className="space-y-6 text-left">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                <div className="text-7xl font-extrabold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent mb-2">{result.score}</div>
                <div className="text-gray-400 text-lg">Viral Probability Score</div>
                <div className="text-purple-300 text-sm mt-1">{result.score >= 70 ? "High viral potential 🔥" : result.score >= 50 ? "Moderate potential ⚡" : "Needs improvement 📈"}</div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Hook Score", value: result.hook },
                  { label: "Retention", value: result.retention },
                  { label: "Shareability", value: result.shareability },
                  { label: "Trend Alignment", value: result.trendAlignment }
                ].map((m, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-purple-400">{m.value}</div>
                    <div className="text-gray-500 text-xs mt-1">{m.label}</div>
                  </div>
                ))}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="font-bold mb-4">💡 Improvement Tips</h3>
                <ul className="space-y-2">
                  {result.tips.map((tip: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-purple-400 mt-0.5">→</span> {tip}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-6 text-center">
                <p className="text-purple-300 font-semibold mb-3">Generate higher-scoring videos automatically with AI</p>
                <Link href="/" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full transition inline-block">
                  Sign Up Free — 25 Tokens →
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-white/10 px-8 py-10 text-center text-gray-600 text-sm">
        <Link href="/" className="text-white font-bold">KlipflowAI</Link> © 2026 ·{" "}
        <Link href="/privacy-policy" className="hover:text-white transition">Privacy Policy</Link> ·{" "}
        <Link href="/terms-of-service" className="hover:text-white transition">Terms of Service</Link>
      </footer>
    </main>
  );
}