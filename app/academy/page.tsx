import { Metadata } from 'next'
import { ArrowRight, Clapperboard, GraduationCap, ShoppingBag, Tv } from 'lucide-react'
import MarketingShell from '../components/MarketingShell'
import { ButtonLink } from '../components/ui/Button'

export const metadata: Metadata = {
  title: 'KlipflowAI Academy — Learn AI Content Creation',
  description: 'Free courses, tutorials, and guides on AI video generation, faceless channels, and AI-powered advertising. Coming soon.',
  alternates: { canonical: 'https://klipflowai.com/academy' },
}

export default function Academy() {
  return (
    <MarketingShell>
      <section className="mx-auto flex max-w-5xl flex-col items-center px-4 py-24 text-center md:px-8">
        <span className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-accent/15 text-accent-text"><GraduationCap size={26} aria-hidden /></span>
        <p className="mb-5 inline-flex rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-muted">Coming soon</p>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">KlipflowAI Academy</h1>
        <p className="mt-5 max-w-2xl text-lg text-ink-muted">
          Free courses, step-by-step tutorials, and expert guides on AI video creation, faceless channels, dropshipping ads, and AI-powered advertising.
        </p>
        <p className="mt-3 text-ink-subtle">We&apos;re building this for you. Sign up to get notified when it launches.</p>

        <div className="mt-14 grid w-full gap-4 md:grid-cols-3">
          {[
            { icon: Clapperboard, title: "AI Video Mastery", desc: "Learn to generate cinematic AI videos that convert. Prompting, models, and production workflows." },
            { icon: Tv, title: "Faceless Channel Playbook", desc: "Build a $10K/month faceless channel from scratch using KlipflowAI's automation system." },
            { icon: ShoppingBag, title: "E-Commerce Ad Academy", desc: "Find winning products, generate scroll-stopping ads, and launch profitable campaigns step by step." },
          ].map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.title} className="rounded-2xl border border-line bg-surface p-6 text-left">
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.05] text-ink-muted"><Icon size={19} aria-hidden /></span>
                  <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-subtle">Coming soon</span>
                </div>
                <h3 className="mt-4 font-semibold">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{c.desc}</p>
              </div>
            );
          })}
        </div>

        <ButtonLink href="/signup" variant="primary" size="lg" className="mt-12">Sign up to get notified <ArrowRight size={17} aria-hidden /></ButtonLink>
      </section>
    </MarketingShell>
  )
}
