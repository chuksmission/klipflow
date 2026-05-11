import Link from "next/link";

interface FAQItem {
  q: string;
  a: string;
}

interface PSEOPageProps {
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  keywords: string[];
  howItWorks: { step: string; icon: string; title: string; desc: string }[];
  features: { icon: string; title: string; desc: string }[];
  faqs: FAQItem[];
  ctaTitle: string;
  ctaDesc: string;
}

export default function PSEOPage({
  badge,
  title,
  subtitle,
  description,
  keywords,
  howItWorks,
  features,
  faqs,
  ctaTitle,
  ctaDesc
}: PSEOPageProps) {
  return (
    <main className="min-h-screen bg-black text-white">

      {/* NAV */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10 sticky top-0 z-50 bg-black/90 backdrop-blur-md">
        <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
          KlipflowAI
        </Link>
        <div className="hidden md:flex gap-8 text-gray-400 text-sm">
          <Link href="/#features" className="hover:text-white transition">Features</Link>
          <Link href="/#pricing" className="hover:text-white transition">Pricing</Link>
          <Link href="/#faq" className="hover:text-white transition">FAQ</Link>
        </div>
        <div className="flex items-center gap-3">
          <button className="text-gray-400 hover:text-white text-sm font-semibold py-2 px-5 rounded-full border border-white/20 hover:border-white/40 transition">
            Sign In
          </button>
          <Link href="/" className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-2 px-5 rounded-full transition">
            Sign Up Free
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="flex flex-col items-center justify-center text-center px-4 py-24">
        <div className="inline-block bg-purple-900/40 border border-purple-500/30 text-purple-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
          {badge}
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold mb-6 leading-tight max-w-4xl">
          {title}
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mb-8">{subtitle}</p>
        <p className="text-gray-500 text-sm max-w-3xl mb-10 leading-relaxed">{description}</p>
        <Link
          href="/"
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-10 rounded-full text-lg transition"
        >
          Start Free — 25 Tokens No Credit Card →
        </Link>
        <p className="text-gray-600 text-xs mt-4">No credit card required · Cancel anytime</p>

        {/* KEYWORDS */}
        <div className="flex flex-wrap gap-2 justify-center mt-10 max-w-3xl">
          {keywords.map((k, i) => (
            <span key={i} className="bg-white/5 border border-white/10 text-gray-400 text-xs px-3 py-1 rounded-full">{k}</span>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-8 py-20 bg-white/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">How It Works</h2>
          <p className="text-gray-400 text-center mb-12">Simple. Fast. Powerful.</p>
          <div className="grid md:grid-cols-3 gap-8">
            {howItWorks.map((s, i) => (
              <div key={i} className="bg-black border border-white/10 rounded-2xl p-8 text-center hover:border-purple-500/50 transition">
                <div className="text-4xl mb-3">{s.icon}</div>
                <div className="text-purple-400 text-xs font-bold uppercase tracking-widest mb-2">Step {s.step}</div>
                <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="px-8 py-20 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">Everything Included</h2>
        <p className="text-gray-400 text-center mb-12">No extra tools needed. Everything in one platform.</p>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-purple-500/50 transition">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-8 py-20 bg-white/5">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((item, i) => (
              <div key={i} className="border border-white/10 rounded-xl p-6">
                <h3 className="font-semibold mb-2">{item.q}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-8 py-24 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-extrabold mb-4">{ctaTitle}</h2>
          <p className="text-gray-400 text-lg mb-8">{ctaDesc}</p>
          <Link
            href="/"
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-12 rounded-full text-lg transition"
          >
            Sign Up Free →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 px-8 py-10 text-center text-gray-600 text-sm">
        <Link href="/" className="text-white font-bold">KlipflowAI</Link> © 2026 · All rights reserved ·{" "}
        <Link href="/privacy-policy" className="hover:text-white transition">Privacy Policy</Link> ·{" "}
        <Link href="/terms-of-service" className="hover:text-white transition">Terms of Service</Link>
      </footer>

    </main>
  );
}