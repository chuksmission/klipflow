import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'KlipflowAI API Documentation — Developer Access',
  description: 'Full REST API access for KlipflowAI. Integrate AI video generation, ad creation, and content automation into your own applications. Coming soon.',
  alternates: { canonical: 'https://klipflowai.com/api-docs' },
}

export default function APIDocs() {
  return (
    <main className="min-h-screen bg-black text-white">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10 sticky top-0 z-50 bg-black/90 backdrop-blur-md">
        <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
          KlipflowAI
        </Link>
        <Link href="/signup" className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-2 px-5 rounded-full transition">
          Sign Up Free
        </Link>
      </nav>

      <section className="flex flex-col items-center justify-center text-center px-8 py-32">
        <div className="text-6xl mb-6">🔌</div>
        <div className="inline-block bg-purple-900/40 border border-purple-500/30 text-purple-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
          Coming Soon
        </div>
        <h1 className="text-5xl font-extrabold mb-6">KlipflowAI API</h1>
        <p className="text-gray-400 text-xl max-w-2xl mb-4">
          Full REST API access to KlipflowAI's AI video generation, ad creation, script writing, and content automation — ready to integrate into your own applications.
        </p>
        <p className="text-gray-500 text-lg mb-12">Available on Agency plan. Documentation launching soon.</p>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl w-full mb-16 text-left">
          {[
            { icon: "🎬", title: "Video Generation API", desc: "Generate AI videos programmatically. Pass a prompt, get back a video URL. Full model selection support." },
            { icon: "📝", title: "Script Writer API", desc: "Generate video scripts for any niche. Trending hooks, full scripts, and CTAs via a single API call." },
            { icon: "🎙️", title: "Voice Generation API", desc: "Convert text to natural AI voiceover. Multiple voices, languages, and styles supported." },
            { icon: "🕵️", title: "Ad Intelligence API", desc: "Query winning Facebook ads by niche and duration. Build your own ad research tools on top of our data." },
          ].map((e, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 opacity-60">
              <div className="text-3xl mb-3">{e.icon}</div>
              <h3 className="font-bold mb-2">{e.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{e.desc}</p>
              <div className="mt-4 text-purple-400 text-xs font-bold">Coming Soon</div>
            </div>
          ))}
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-2xl w-full mb-12 text-left">
          <div className="text-purple-400 text-xs font-bold uppercase tracking-widest mb-3">Preview — What the API will look like</div>
          <pre className="text-gray-300 text-sm leading-relaxed overflow-x-auto">{`POST https://api.klipflowai.com/v1/generate

{
  "model": "kling-3.0",
  "prompt": "Cinematic product shot...",
  "duration": 5,
  "aspect_ratio": "16:9"
}

// Response
{
  "video_url": "https://...",
  "tokens_used": 10,
  "generation_id": "gen_xxx"
}`}</pre>
        </div>

        <Link href="/signup" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-12 rounded-full text-lg transition">
          Sign Up for API Early Access →
        </Link>
      </section>

      <footer className="border-t border-white/10 px-8 py-10 text-center text-gray-600 text-sm">
        <Link href="/" className="text-white font-bold">KlipflowAI</Link> © 2026 ·{" "}
        <Link href="/privacy-policy" className="hover:text-white transition">Privacy Policy</Link> ·{" "}
        <Link href="/terms-of-service" className="hover:text-white transition">Terms of Service</Link>
      </footer>
    </main>
  )
}