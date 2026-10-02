import { Metadata } from 'next'
import { ArrowRight, AudioLines, Clapperboard, PenLine, Plug, Radar } from 'lucide-react'
import MarketingShell from '../components/MarketingShell'
import { ButtonLink } from '../components/ui/Button'

export const metadata: Metadata = {
  title: 'KlipflowAI API Documentation — Developer Access',
  description: 'Full REST API access for KlipflowAI. Integrate AI video generation, ad creation, and content automation into your own applications. Coming soon.',
  alternates: { canonical: 'https://klipflowai.com/api-docs' },
}

export default function APIDocs() {
  return (
    <MarketingShell>
      <section className="mx-auto flex max-w-4xl flex-col items-center px-4 py-24 text-center md:px-8">
        <span className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-accent/15 text-accent-text"><Plug size={26} aria-hidden /></span>
        <p className="mb-5 inline-flex rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-muted">Coming soon</p>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">KlipflowAI API</h1>
        <p className="mt-5 max-w-2xl text-lg text-ink-muted">
          Full REST API access to KlipflowAI&apos;s AI video generation, ad creation, script writing, and content automation — ready to integrate into your own applications.
        </p>
        <p className="mt-3 text-ink-subtle">Available on the Agency plan. Documentation launching soon.</p>

        <div className="mt-14 grid w-full gap-4 text-left md:grid-cols-2">
          {[
            { icon: Clapperboard, title: "Video Generation API", desc: "Generate AI videos programmatically. Pass a prompt, get back a video URL. Full model selection support." },
            { icon: PenLine, title: "Script Writer API", desc: "Generate video scripts for any niche. Trending hooks, full scripts, and CTAs via a single API call." },
            { icon: AudioLines, title: "Voice Generation API", desc: "Convert text to natural AI voiceover. Multiple voices, languages, and styles supported." },
            { icon: Radar, title: "Ad Intelligence API", desc: "Query winning Facebook ads by niche and duration. Build your own ad research tools on top of our data." },
          ].map((e) => {
            const Icon = e.icon;
            return (
              <div key={e.title} className="rounded-2xl border border-line bg-surface p-6">
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.05] text-ink-muted"><Icon size={19} aria-hidden /></span>
                  <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-subtle">Coming soon</span>
                </div>
                <h3 className="mt-4 font-semibold">{e.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{e.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-10 w-full overflow-hidden rounded-2xl border border-line bg-surface text-left">
          <div className="border-b border-line px-5 py-3 text-xs font-medium text-ink-subtle">Preview: what the API will look like</div>
          <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-ink">{`POST https://api.klipflowai.com/v1/generate

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

        <ButtonLink href="/signup" variant="primary" size="lg" className="mt-12">Sign up for API early access <ArrowRight size={17} aria-hidden /></ButtonLink>
      </section>
    </MarketingShell>
  )
}
