import { Metadata } from 'next'
import { ArrowRight, Globe2, Repeat, Target, TrendingUp } from 'lucide-react'
import MarketingShell from '../components/MarketingShell'
import { ButtonLink } from '../components/ui/Button'

export const metadata: Metadata = {
  title: 'About KlipflowAI — Our Mission & Story',
  description: 'KlipflowAI is built to give every creator and brand the power of a full creative and advertising team — powered entirely by AI.',
  alternates: { canonical: 'https://klipflowai.com/about' },
}

export default function About() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-4xl px-4 py-20 md:px-8">
        <p className="mb-5 inline-flex rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-muted">Our story</p>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Built for the new era of AI-powered creation</h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-muted md:text-xl">
          KlipflowAI was built with one mission — to give every creator, brand, and entrepreneur the power of a full creative and advertising team, powered entirely by AI.
        </p>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {[
            { stat: "9", label: "AI Modules" },
            { stat: "5", label: "Platforms Supported" },
            { stat: "$0", label: "To Get Started" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-line bg-surface p-6">
              <div className="text-4xl font-semibold tracking-tight">{s.stat}</div>
              <div className="mt-1 text-sm text-ink-muted">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-16 space-y-14">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Why we built KlipflowAI</h2>
            <p className="mt-4 leading-relaxed text-ink-muted">Creating content and running ads used to require expensive agencies, video editors, copywriters, and media buyers. The barrier to entry was high — and only big brands could afford to compete at scale.</p>
            <p className="mt-4 leading-relaxed text-ink-muted">We built KlipflowAI to level the playing field. Every feature is designed to replace a task that used to cost hundreds or thousands of dollars — and deliver it in seconds, for anyone.</p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight">What we believe</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                { icon: Target, title: "Speed wins", desc: "The creator or brand that moves fastest wins. We obsess over cutting every second out of the workflow." },
                { icon: TrendingUp, title: "Revenue over vanity", desc: "We don't build features for demos. Every tool in KlipflowAI is designed to make you money." },
                { icon: Repeat, title: "Closed loops beat open ends", desc: "From research to creation to distribution — we close the loop so nothing falls through the cracks." },
                { icon: Globe2, title: "Anyone can compete", desc: "You don't need a team, a budget, or technical skills. Just an idea and an internet connection." },
              ].map((v) => {
                const Icon = v.icon;
                return (
                  <div key={v.title} className="rounded-2xl border border-line bg-surface p-6">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent-text"><Icon size={19} aria-hidden /></span>
                    <h3 className="mt-4 font-semibold">{v.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">{v.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Our platform</h2>
            <p className="mt-4 leading-relaxed text-ink-muted">KlipflowAI combines Facebook Ad Spy, AI video generation, UGC creation, AI actors, voice synthesis, script writing, and automated social posting — all in one closed-loop platform. No switching between tools. No lost time. Just results.</p>
          </div>
        </div>

        <div className="relative mt-16 overflow-hidden rounded-3xl border border-line bg-surface px-6 py-12 text-center">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ background: "radial-gradient(60% 80% at 50% 0%, rgba(109,74,255,0.35), transparent 70%)" }} />
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-tight">Ready to get started?</h2>
            <p className="mx-auto mt-3 max-w-md text-ink-muted">25 free tokens, no credit card required.</p>
            <ButtonLink href="/signup" variant="primary" size="lg" className="mt-8">Sign up free <ArrowRight size={17} aria-hidden /></ButtonLink>
          </div>
        </div>
      </section>
    </MarketingShell>
  )
}
