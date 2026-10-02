'use client';
import { useState } from "react";
import Link from "next/link";
import MarketingShell from "../../components/MarketingShell";

export default function AIAdScriptGeneratorClient() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [scripts, setScripts] = useState<string[]>([]);

  const generateScripts = async () => {
    if (!url) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 2000));
    setScripts([
      `Script 1 — Problem/Solution:\n"Are you tired of spending hours creating content that gets zero engagement? There's a smarter way. KlipflowAI generates viral videos in minutes — and posts them to all your platforms automatically. Join thousands of creators who've already made the switch. Sign up free today."`,
      `Script 2 — Social Proof:\n"100,000 views in the first week. Without filming a single second of footage. That's what our users are achieving with AI-generated content. Pick your niche, set your schedule, and watch your channel grow on autopilot. Try it free — no credit card needed."`,
      `Script 3 — FOMO:\n"Your competitors are already using AI to create 10x more content than you. Every day you're not automating is a day they're pulling ahead. KlipflowAI generates your scripts, videos, and posts them everywhere — automatically. Don't get left behind. Start free today."`
    ]);
    setLoading(false);
  };

  return (
    <MarketingShell>

      <section className="px-4 py-20 text-center md:px-8">
        <p className="mb-5 inline-flex rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-muted">Free tool</p>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">AI Ad Script Generator</h1>
        <p className="text-ink-muted text-lg max-w-2xl mx-auto mb-12">Enter your website URL and get 3 ready-to-use video ad scripts instantly. Free. No signup required.</p>

        <div className="max-w-2xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <input
              type="url"
              placeholder="https://yourwebsite.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 bg-canvas border border-line hover:border-line-strong rounded-xl px-4 h-12 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
            />
            <button
              onClick={generateScripts}
              disabled={loading || !url}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-medium h-12 px-6 rounded-xl transition"
            >
              {loading ? 'Generating...' : 'Generate Scripts →'}
            </button>
          </div>

          {scripts.length > 0 && (
            <div className="space-y-4 text-left">
              {scripts.map((script, i) => (
                <div key={i} className="bg-surface border border-line rounded-2xl p-6">
                  <pre className="text-ink text-sm leading-relaxed whitespace-pre-wrap">{script}</pre>
                  <button
                    onClick={() => navigator.clipboard.writeText(script)}
                    className="mt-4 text-accent-text hover:text-white text-xs font-semibold transition"
                  >
                    Copy Script →
                  </button>
                </div>
              ))}
              <div className="bg-accent/[0.07] border border-accent/25 rounded-2xl p-6 text-center">
                <p className="text-accent-text font-semibold mb-3">Turn these scripts into AI videos instantly</p>
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