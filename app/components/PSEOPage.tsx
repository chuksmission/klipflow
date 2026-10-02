import { ArrowRight, Check, ChevronDown } from "lucide-react";
import MarketingShell from "./MarketingShell";
import { ButtonLink } from "./ui/Button";

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
  // `icon` is accepted for compatibility with existing pages but not rendered
  // (the design system uses Lucide icons rather than emoji).
  howItWorks: { step: string; icon: string; title: string; desc: string }[];
  features: { icon: string; title: string; desc: string }[];
  faqs: FAQItem[];
  ctaTitle: string;
  ctaDesc: string;
}

// Strip a leading emoji from badge text, e.g. "🎬 AI Video Generator" -> "AI Video Generator"
const stripEmoji = (text: string) => text.replace(/^[\p{Extended_Pictographic}️‍\s]+/u, "");

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
    <MarketingShell>
      {/* HERO */}
      <section className="relative overflow-hidden px-4 pb-20 pt-20 text-center md:px-8">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-10 h-[380px] w-[860px] max-w-[150%] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(closest-side, rgba(109,74,255,0.5), rgba(34,211,238,0.1) 60%, transparent)" }} />
        <div className="relative mx-auto max-w-3xl">
          <p className="mx-auto mb-5 inline-flex rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-muted">{stripEmoji(badge)}</p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">{title}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-muted">{subtitle}</p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-ink-subtle">{description}</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/signup" variant="primary" size="lg">Start free with 25 tokens <ArrowRight size={17} aria-hidden /></ButtonLink>
            <ButtonLink href="/#templates" variant="secondary" size="lg">See examples</ButtonLink>
          </div>
          <p className="mt-4 text-xs text-ink-subtle">No credit card required · Cancel anytime</p>
          <div className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2">
            {keywords.map((k) => (
              <span key={k} className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-muted">{k}</span>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-t border-line px-4 py-20 md:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-semibold tracking-tight">How it works</h2>
          <p className="mt-2 text-center text-ink-muted">Simple, fast, and powerful.</p>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {howItWorks.map((s) => (
              <div key={s.step} className="rounded-2xl border border-line bg-surface p-6">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-sm font-semibold text-accent-text">{s.step}</span>
                <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="border-t border-line px-4 py-20 md:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Everything included</h2>
          <p className="mt-2 text-center text-ink-muted">No extra tools needed. Everything in one platform.</p>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-line bg-surface p-6">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-accent-text"><Check size={18} aria-hidden /></span>
                <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-line px-4 py-20 md:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Frequently asked questions</h2>
          <div className="mt-10 divide-y divide-line rounded-2xl border border-line bg-surface">
            {faqs.map((item) => (
              <details key={item.q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-medium text-ink transition-colors hover:bg-white/[0.02] [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown size={18} className="flex-shrink-0 text-ink-muted transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <p className="px-5 pb-5 text-sm leading-relaxed text-ink-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24 md:px-8">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-line bg-surface px-6 py-16 text-center">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ background: "radial-gradient(60% 80% at 50% 0%, rgba(109,74,255,0.35), transparent 70%)" }} />
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{ctaTitle}</h2>
            <p className="mx-auto mt-3 max-w-lg text-ink-muted">{ctaDesc}</p>
            <ButtonLink href="/signup" variant="primary" size="lg" className="mt-8">Start for free <ArrowRight size={17} aria-hidden /></ButtonLink>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
