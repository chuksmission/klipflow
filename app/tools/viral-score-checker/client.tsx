'use client';
import { useState } from "react";
import Link from "next/link";
import MarketingShell from "../../components/MarketingShell";

export default function ViralScoreCheckerClient() {
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
    <MarketingShell>

      <section className="px-4 py-20 text-center md:px-8">
        <p className="mb-5 inline-flex rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-muted">Free tool</p>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">Viral Score Checker</h1>
        <p className="text-ink-muted text-lg max-w-2xl mx-auto mb-12">Paste any TikTok, Instagram Reel, or YouTube Short URL and get an instant virality probability score. Free.</p>

        <div className="max-w-2xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <input
              type="url"
              placeholder="https://tiktok.com/@user/video/..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="flex-1 bg-canvas border border-line hover:border-line-strong rounded-xl px-4 h-12 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
            />
            <button
              onClick={checkScore}
              disabled={loading || !videoUrl}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-medium h-12 px-6 rounded-xl transition"
            >
              {loading ? 'Analyzing...' : 'Check Score →'}
            </button>
          </div>

          {result && (
            <div className="space-y-6 text-left">
              <div className="bg-surface border border-line rounded-2xl p-8 text-center">
                <div className="text-7xl font-semibold tracking-tight text-ink mb-2">{result.score}</div>
                <div className="text-ink-muted text-lg">Viral Probability Score</div>
                <div className="text-accent-text text-sm mt-1">{result.score >= 70 ? "High viral potential" : result.score >= 50 ? "Moderate potential" : "Needs improvement"}</div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Hook Score", value: result.hook },
                  { label: "Retention", value: result.retention },
                  { label: "Shareability", value: result.shareability },
                  { label: "Trend Alignment", value: result.trendAlignment }
                ].map((m, i) => (
                  <div key={i} className="bg-surface border border-line rounded-xl p-4 text-center">
                    <div className="text-2xl font-semibold text-accent-text">{m.value}</div>
                    <div className="text-ink-subtle text-xs mt-1">{m.label}</div>
                  </div>
                ))}
              </div>

              <div className="bg-surface border border-line rounded-2xl p-6">
                <h3 className="font-semibold mb-4">Improvement Tips</h3>
                <ul className="space-y-2">
                  {result.tips.map((tip: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink">
                      <span className="text-accent-text mt-0.5">→</span> {tip}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-accent/[0.07] border border-accent/25 rounded-2xl p-6 text-center">
                <p className="text-accent-text font-semibold mb-3">Generate higher-scoring videos automatically with AI</p>
                <Link href="/signup" className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-8 rounded-xl transition inline-block">
                  Sign Up Free — 25 Tokens →
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </MarketingShell>
  );
}