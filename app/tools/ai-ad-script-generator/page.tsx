'use client';
import { useState } from "react";
import Link from "next/link";

export default function AIAdScriptGenerator() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [scripts, setScripts] = useState<string[]>([]);

  const generateScripts = async () => {
    if (!url) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 2000));
    setScripts([
      `🎯 Script 1 — Problem/Solution:\n"Are you tired of spending hours creating content that gets zero engagement? There's a smarter way. KlipflowAI generates viral videos in minutes — and posts them to all your platforms automatically. Join thousands of creators who've already made the switch. Sign up free today."`,
      `⚡ Script 2 — Social Proof:\n"100,000 views in the first week. Without filming a single second of footage. That's what our users are achieving with AI-generated content. Pick your niche, set your schedule, and watch your channel grow on autopilot. Try it free — no credit card needed."`,
      `🔥 Script 3 — FOMO:\n"Your competitors are already using AI to create 10x more content than you. Every day you're not automating is a day they're pulling ahead. KlipflowAI generates your scripts, videos, and posts them everywhere — automatically. Don't get left behind. Start free today."`
    ]);
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
        <h1 className="text-5xl font-extrabold mb-4">AI Ad Script Generator</h1>
        <p className="text-gray-400 text-xl max-w-2xl mx-auto mb-12">Enter your website URL and get 3 ready-to-use video ad scripts instantly. Free. No signup required.</p>

        <div className="max-w-2xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <input
              type="url"
              placeholder="https://yourwebsite.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 bg-white/10 border border-white/20 rounded-full px-6 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={generateScripts}
              disabled={loading || !url}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold py-3 px-8 rounded-full transition"
            >
              {loading ? 'Generating...' : 'Generate Scripts →'}
            </button>
          </div>

          {scripts.length > 0 && (
            <div className="space-y-4 text-left">
              {scripts.map((script, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <pre className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{script}</pre>
                  <button
                    onClick={() => navigator.clipboard.writeText(script)}
                    className="mt-4 text-purple-400 hover:text-white text-xs font-semibold transition"
                  >
                    Copy Script →
                  </button>
                </div>
              ))}
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-6 text-center">
                <p className="text-purple-300 font-semibold mb-3">Turn these scripts into AI videos instantly</p>
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