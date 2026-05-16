import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About KlipflowAI — Our Mission & Story',
  description: 'KlipflowAI is built to give every creator and brand the power of a full creative and advertising team — powered entirely by AI.',
  alternates: { canonical: 'https://klipflowai.com/about' },
}

export default function About() {
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

      <section className="max-w-4xl mx-auto px-8 py-24">
        <div className="inline-block bg-purple-900/40 border border-purple-500/30 text-purple-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
          🚀 Our Story
        </div>
        <h1 className="text-5xl font-extrabold mb-6">
          Built for the New Era of
          <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent"> AI-Powered Creation</span>
        </h1>
        <p className="text-gray-400 text-xl leading-relaxed mb-16">
          KlipflowAI was built with one mission — to give every creator, brand, and entrepreneur the power of a full creative and advertising team, powered entirely by AI.
        </p>

        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {[
            { stat: "9", label: "AI Modules" },
            { stat: "5", label: "Platforms Supported" },
            { stat: "$0", label: "To Get Started" },
          ].map((s, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
              <div className="text-5xl font-extrabold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent mb-2">{s.stat}</div>
              <div className="text-gray-400 text-sm">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="space-y-12 mb-20">
          <div>
            <h2 className="text-2xl font-bold mb-4">Why We Built KlipflowAI</h2>
            <p className="text-gray-400 leading-relaxed">Creating content and running ads used to require expensive agencies, video editors, copywriters, and media buyers. The barrier to entry was high — and only big brands could afford to compete at scale.</p>
            <p className="text-gray-400 leading-relaxed mt-4">We built KlipflowAI to level the playing field. Every feature is designed to replace a task that used to cost hundreds or thousands of dollars — and deliver it in seconds, for anyone.</p>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4">What We Believe</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { icon: "🎯", title: "Speed wins", desc: "The creator or brand that moves fastest wins. We obsess over cutting every second out of the workflow." },
                { icon: "💰", title: "Revenue over vanity", desc: "We don't build features for demos. Every tool in KlipflowAI is designed to make you money." },
                { icon: "🔄", title: "Closed loops beat open ends", desc: "From research to creation to distribution — we close the loop so nothing falls through the cracks." },
                { icon: "🌍", title: "Anyone can compete", desc: "You don't need a team, a budget, or technical skills. Just an idea and an internet connection." },
              ].map((v, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="text-3xl mb-3">{v.icon}</div>
                  <h3 className="font-bold mb-2">{v.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4">Our Platform</h2>
            <p className="text-gray-400 leading-relaxed">KlipflowAI combines Facebook Ad Spy, AI video generation, UGC creation, AI actors, voice synthesis, script writing, and automated social posting — all in one closed-loop platform. No switching between tools. No lost time. Just results.</p>
          </div>
        </div>

        <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-10 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-gray-400 mb-8">Join creators and brands already using KlipflowAI. 25 free tokens, no credit card required.</p>
          <Link href="/signup" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-12 rounded-full text-lg transition inline-block">
            Sign Up Free →
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 px-8 py-10 text-center text-gray-600 text-sm">
        <Link href="/" className="text-white font-bold">KlipflowAI</Link> © 2026 ·{" "}
        <Link href="/privacy-policy" className="hover:text-white transition">Privacy Policy</Link> ·{" "}
        <Link href="/terms-of-service" className="hover:text-white transition">Terms of Service</Link>
      </footer>
    </main>
  )
}