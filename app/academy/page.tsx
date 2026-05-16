import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'KlipflowAI Academy — Learn AI Content Creation',
  description: 'Free courses, tutorials, and guides on AI video generation, faceless channels, and AI-powered advertising. Coming soon.',
  alternates: { canonical: 'https://klipflowai.com/academy' },
}

export default function Academy() {
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
        <div className="text-6xl mb-6">🎓</div>
        <div className="inline-block bg-purple-900/40 border border-purple-500/30 text-purple-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
          Coming Soon
        </div>
        <h1 className="text-5xl font-extrabold mb-6">KlipflowAI Academy</h1>
        <p className="text-gray-400 text-xl max-w-2xl mb-4">
          Free courses, step-by-step tutorials, and expert guides on AI video creation, faceless channels, dropshipping ads, and AI-powered advertising.
        </p>
        <p className="text-gray-500 text-lg mb-12">We're building this for you. Sign up to get notified when it launches.</p>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl w-full mb-16">
          {[
            { icon: "🎬", title: "AI Video Mastery", desc: "Learn to generate cinematic AI videos that convert. Prompting, models, and production workflows." },
            { icon: "📺", title: "Faceless Channel Playbook", desc: "Build a $10K/month faceless channel from scratch using KlipflowAI's automation system." },
            { icon: "🛍️", title: "E-Commerce Ad Academy", desc: "Find winning products, generate scroll-stopping ads, and launch profitable campaigns step by step." },
          ].map((c, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left opacity-60">
              <div className="text-3xl mb-3">{c.icon}</div>
              <h3 className="font-bold mb-2">{c.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{c.desc}</p>
              <div className="mt-4 text-purple-400 text-xs font-bold">Coming Soon</div>
            </div>
          ))}
        </div>

        <Link href="/signup" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-12 rounded-full text-lg transition">
          Sign Up to Get Notified →
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