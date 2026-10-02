'use client';
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Bot, Check, ChevronDown, Film, FileVideo, ImagePlay, Languages, Megaphone, Menu,
  Newspaper, Radar, ShoppingBag, Sparkles, UserRound, X, type LucideIcon,
} from "lucide-react";
import { supabase } from "./lib/supabase";
import AppSidebar from "./components/AppSidebar";
import PromptComposer from "./components/PromptComposer";
import ShowcaseGrid, { type ShowcaseItem } from "./components/ShowcaseGrid";
import { ButtonLink, buttonClass } from "./components/ui/Button";
import { moduleForGenerationType, savePendingGeneration, studioHref, type StudioModuleId } from "./components/catalog";

interface QuickStart {
  title: string;
  desc: string;
  module: StudioModuleId;
  category?: string;
  prompt?: string;
  aspect_ratio?: string;
  icon: LucideIcon;
  badge?: string;
}

const QUICK_STARTS: QuickStart[] = [
  { title: "UGC ad",           desc: "Creator-style testimonial",    module: "ugc_ad",           category: "ugc",         icon: Megaphone,   badge: "Popular", aspect_ratio: "9:16", prompt: "Woman in her kitchen holding the product, talking to camera, authentic testimonial style" },
  { title: "Product ad",       desc: "Studio-quality product shots", module: "text_to_video",    category: "product",     icon: ShoppingBag, aspect_ratio: "16:9", prompt: "Product rotating slowly on a marble pedestal, soft studio lighting, cinematic 4K" },
  { title: "Faceless reel",    desc: "Script to scenes with audio",  module: "script_to_video",  category: "faceless",    icon: FileVideo },
  { title: "Translate a video", desc: "New language, same voice",    module: "video_translator", category: "translation", icon: Languages,   badge: "New" },
  { title: "Cinematic shot",   desc: "Film-grade text to video",     module: "text_to_video",    category: "cinematic",   icon: Film,        aspect_ratio: "16:9", prompt: "Slow drone shot over misty mountains at sunrise, epic cinematic lighting" },
  { title: "Animate a photo",  desc: "Bring any image to life",      module: "image_to_video",                            icon: ImagePlay },
  { title: "AI presenter",     desc: "Photorealistic spokesperson",  module: "ai_actor",                                  icon: UserRound },
  { title: "Image ad",         desc: "Scroll-stopping static ads",   module: "image_ad",         category: "image",       icon: Newspaper },
];

const MODELS = ["Kling 3.0", "Veo 3.1", "Sora 2", "Seedance 2.0", "Hailuo 2.3", "Wan 2.6", "Luma Ray 3"];

export default function HomeClient() {
  const [pricingTab, setPricingTab] = useState('creators');
  const [creatorBilling, setCreatorBilling] = useState('monthly');
  const [ecomBilling, setEcomBilling] = useState('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [creatorPlans, setCreatorPlans] = useState<any[]>([]);
  const [ecomPlansDb, setEcomPlansDb] = useState<any[]>([]);
  const [showcase, setShowcase] = useState<ShowcaseItem[]>([]);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<StudioModuleId>("text_to_video");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setIsLoggedIn(true);
    };
    const fetchPlans = async () => {
      const res = await fetch("/api/plans");
      const data = await res.json();
      const all: any[] = data.plans || [];
      setCreatorPlans(all.filter((p) => p.name.toLowerCase().includes("creator")));
      setEcomPlansDb(all.filter((p) => !p.name.toLowerCase().includes("creator")));
    };
    const fetchShowcase = async () => {
      try {
        const res = await fetch("/api/showcase");
        const data = await res.json();
        setShowcase(data.items ?? []);
      } catch { /* showcase is optional */ }
    };
    checkSession();
    fetchPlans();
    fetchShowcase();
  }, []);

  // Floating prompt bar appears once the hero composer scrolls out of view
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setShowBar(!entry.isIntersecting), { rootMargin: "-80px 0px 0px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const startCreating = (p: { module: StudioModuleId; prompt?: string; model?: string; aspect_ratio?: string; duration?: string }) => {
    savePendingGeneration(p);
    router.push(isLoggedIn ? studioHref(p.module) : "/signup");
  };

  const handlePromptSubmit = () => startCreating({ module: mode, prompt: prompt.trim() || undefined });

  const useTemplate = (item: ShowcaseItem) => startCreating({
    module: moduleForGenerationType(item.type),
    prompt: item.prompt ?? undefined,
    model: item.model ?? undefined,
    aspect_ratio: item.aspect_ratio ?? undefined,
    duration: item.duration ?? undefined,
  });

  // Give each Quick Start tile a distinct showcase clip from its category, if one exists
  const usedIds = new Set<ShowcaseItem["id"]>();
  const tileMedia = QUICK_STARTS.map((qs) => {
    const match = showcase.find((s) => !usedIds.has(s.id) && qs.category && s.featured_category === qs.category);
    if (match) usedIds.add(match.id);
    return match;
  });

  const ecomSavings: Record<string, string> = {
    monthly: '', sixmonths: 'Save 14%', yearly: 'Save 20%'
  };

  const faqs = [
    { q: "What is KlipflowAI?", a: "KlipflowAI is an all-in-one AI platform for content creators and e-commerce brands. It combines Facebook Ad Spy, AI video and image generation, script writing, voice synthesis, avatar creation, automated social posting across 5 platforms, and one-click ad launching — all in one place." },
    { q: "How does the AI Employee work for creators?", a: "You pick your niche and posting frequency once. KlipflowAI then automatically finds trending topics in your niche, writes the script, generates the visuals, adds a voiceover, and posts to TikTok, Instagram, YouTube, Facebook, and X on your schedule. You literally just check in to see your growth." },
    { q: "Which platforms does auto-posting support?", a: "TikTok, Instagram, YouTube Shorts, Facebook, and X (Twitter). That's 5 platforms — more than any competitor on the market." },
    { q: "What types of content can I create?", a: "Text-to-video, image-to-video, AI actor videos, UGC testimonial videos, AI image ads, script-to-video with voiceover, and more. Every format you need for social media and advertising." },
    { q: "Do free trial videos have a watermark?", a: "Yes. Your 25 free trial tokens generate watermarked videos so you can experience the full quality before committing. The watermark disappears automatically the moment you subscribe to any paid plan." },
    { q: "What are tokens?", a: "Tokens are your generation credits. 1 video = 10 tokens, 1 image = 2 tokens. Every signup gets 25 free tokens — enough for 2 full videos. Top up anytime from $5 inside your dashboard." },
    { q: "Is the Facebook Ad Spy legal?", a: "Yes. We use Meta's official Ads Library API which is publicly available and fully compliant with Meta's terms of service. No scraping, no violations." },
    { q: "Can I upload my own actor for videos?", a: "Yes. Upload a photo of your talent and generate AI videos using their likeness. You'll confirm you own the rights to the image before generating." },
    { q: "How is KlipflowAI different from other AI video tools?", a: "KlipflowAI is the only platform that combines ad intelligence, AI video and image generation, script writing, voice synthesis, avatar creation, automated 5-platform posting, AND one-click ad launching. Competitors only do one or two of these things." },
    { q: "How fast is video generation?", a: "Standard videos generate in 1-3 minutes. Pro and Agency plan users get priority processing, typically under 60 seconds." },
    { q: "Can I cancel anytime?", a: "Absolutely. No contracts, no hidden fees. Cancel with one click from your dashboard and you'll never be charged again." },
    { q: "Is KlipflowAI suitable for beginners?", a: "Yes. If you can pick a niche and type a sentence, you can use KlipflowAI. No video editing, no design skills, no technical knowledge required whatsoever." }
  ];

  const planCard = (plan: any, price: number | string, billingNote: string | null) => (
    <div key={plan.id} className={"relative flex flex-col rounded-2xl border p-7 " + (plan.is_popular ? "border-accent bg-accent/[0.07]" : "border-line bg-surface")}>
      {plan.is_popular && <span className="absolute -top-3 left-7 rounded-full bg-accent px-3 py-1 text-xs font-medium text-white">Most popular</span>}
      <h3 className="text-lg font-semibold text-ink">{plan.name}</h3>
      {plan.description && <p className="mt-1 text-sm text-ink-muted">{plan.description}</p>}
      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-4xl font-semibold tracking-tight text-ink">${price}</span>
        <span className="text-ink-muted">/mo</span>
      </div>
      {billingNote && <p className="mt-1 text-xs text-ink-subtle">{billingNote}</p>}
      {plan.tokens_per_month && <p className="mt-3 text-sm font-medium text-accent-text">{plan.tokens_per_month} tokens / month</p>}
      {Array.isArray(plan.features) && plan.features.length > 0 && (
        <ul className="mt-5 space-y-2.5">
          {plan.features.map((f: string, j: number) => (
            <li key={j} className="flex items-start gap-2.5 text-sm text-ink-muted">
              <Check size={16} className="mt-0.5 flex-shrink-0 text-accent-text" aria-hidden /> {f}
            </li>
          ))}
        </ul>
      )}
      <div className="flex-1" />
      <ButtonLink href="/signup" variant={plan.is_popular ? "primary" : "secondary"} size="lg" className="mt-7 w-full">Get started</ButtonLink>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* SIDEBAR (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-line bg-canvas lg:block">
        <AppSidebar loggedIn={isLoggedIn} />
      </aside>

      {/* SIDEBAR (mobile drawer) */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] border-r border-line bg-canvas">
            <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-white/5 hover:text-ink">
              <X size={20} aria-hidden />
            </button>
            <AppSidebar loggedIn={isLoggedIn} onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        {/* TOP BAR */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line/60 bg-canvas/80 px-4 backdrop-blur-md md:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="grid h-10 w-10 place-items-center rounded-lg text-ink-muted hover:bg-white/5 hover:text-ink">
              <Menu size={20} aria-hidden />
            </button>
            <Link href="/" className="text-[17px] font-semibold tracking-tight">KlipflowAI</Link>
          </div>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Page sections">
            <a href="#templates" className={buttonClass("ghost", "sm")}>Templates</a>
            <a href="#pricing" className={buttonClass("ghost", "sm")}>Pricing</a>
            <a href="#faq" className={buttonClass("ghost", "sm")}>FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <ButtonLink href="/dashboard" variant="primary" size="md">Go to dashboard <ArrowRight size={16} aria-hidden /></ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="secondary" size="md">Sign in</ButtonLink>
                <ButtonLink href="/signup" variant="primary" size="md" className="hidden sm:inline-flex">Start for free</ButtonLink>
              </>
            )}
          </div>
        </header>

        <main>
          {/* HERO */}
          <section className="relative overflow-hidden px-4 pb-16 pt-14 md:px-8 md:pt-20">
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[900px] max-w-[140%] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
              style={{ background: "radial-gradient(closest-side, rgba(109,74,255,0.55), rgba(34,211,238,0.12) 60%, transparent)" }} />
            <div className="relative mx-auto max-w-3xl text-center">
              <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-muted">
                <Sparkles size={13} className="text-signal" aria-hidden /> Kling, Veo, Sora and Seedance in one place
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-6xl">Make videos that sell</h1>
              <p className="mx-auto mt-4 max-w-xl text-base text-ink-muted md:text-lg">
                Describe it and KlipflowAI generates UGC ads, product videos and faceless content with the world&apos;s best AI models.
              </p>
            </div>
            <div ref={heroRef} className="relative mx-auto mt-10 max-w-3xl">
              <PromptComposer value={prompt} onChange={setPrompt} mode={mode} onModeChange={setMode} onSubmit={handlePromptSubmit} />
              <p className="mt-4 text-center text-xs text-ink-subtle">25 free tokens on signup · No credit card required</p>
            </div>
            <div className="relative mx-auto mt-12 flex max-w-4xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-subtle">
              {MODELS.map((m) => <span key={m}>{m}</span>)}
            </div>
          </section>

          {/* QUICK STARTS */}
          <section id="templates" className="scroll-mt-20 px-4 pb-20 md:px-8">
            <div className="mx-auto max-w-6xl">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Quick starts</h2>
                  <p className="mt-1 text-sm text-ink-muted">Pick a format and we&apos;ll set up the Studio for you.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                {QUICK_STARTS.map((qs, i) => {
                  const Icon = qs.icon;
                  const media = tileMedia[i];
                  return (
                    <button
                      key={qs.title}
                      onClick={() => startCreating({ module: qs.module, prompt: qs.prompt, aspect_ratio: qs.aspect_ratio })}
                      className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-surface text-left transition-colors hover:border-line-strong"
                    >
                      {media ? (
                        media.output_type === "image"
                          ? <img src={media.video_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          : <video src={media.video_url + "#t=0.1"} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(120% 90% at ${i % 2 ? "100%" : "0%"} 0%, rgba(109,74,255,0.28), transparent 60%)` }}>
                          <Icon size={56} strokeWidth={1.25} className="absolute right-4 top-4 text-white/15 transition-colors group-hover:text-white/25" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-3.5 pt-10">
                        <div className="flex items-center gap-2">
                          <Icon size={16} className="text-white" aria-hidden />
                          <span className="text-[15px] font-medium text-white">{qs.title}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-white/65">{qs.desc}</p>
                      </div>
                      {qs.badge && (
                        <span className={"absolute left-3 top-3 rounded-full px-2 py-0.5 text-[11px] font-medium " + (qs.badge === "New" ? "bg-signal text-black" : "bg-white text-black")}>{qs.badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* SHOWCASE */}
          {showcase.length > 0 && (
            <section id="showcase" className="scroll-mt-20 px-4 pb-24 md:px-8">
              <div className="mx-auto max-w-6xl">
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Made with KlipflowAI</h2>
                  <p className="mt-1 text-sm text-ink-muted">Every example is a template. Click &quot;Use this&quot; to start from the same prompt and model.</p>
                </div>
                <ShowcaseGrid items={showcase} onUse={useTemplate} />
              </div>
            </section>
          )}

          {/* BEYOND GENERATION */}
          <section className="px-4 pb-24 md:px-8">
            <div className="mx-auto max-w-6xl">
              <div className="mb-8 max-w-2xl">
                <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">From idea to results</h2>
                <p className="mt-2 text-ink-muted">Find what&apos;s already working, make a better version, and get it in front of people.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { icon: Radar, title: "Ad Spy", desc: "Browse Facebook ads that have been running profitably, then remix the winning formula into your own creative.", href: "/dashboard/ad-spy" },
                  { icon: Sparkles, title: "Studio", desc: "Text, image and script to video, UGC ads, AI presenters, translations and image ads from one prompt box.", href: studioHref("text_to_video") },
                  { icon: Bot, title: "Autopilot", desc: "Set your niche and schedule once. Scripts, visuals and voiceover are created and posted for you.", href: "/dashboard/autopilot" },
                ].map((f) => {
                  const Icon = f.icon;
                  return (
                    <Link key={f.title} href={isLoggedIn ? f.href : "/signup"} className="group rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-line-strong">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent-text"><Icon size={20} aria-hidden /></span>
                      <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.desc}</p>
                      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent-text">
                        Open {f.title} <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>

          {/* PRICING */}
          <section id="pricing" className="scroll-mt-20 border-t border-line px-4 py-24 md:px-8">
            <div className="mx-auto max-w-5xl">
              <div className="text-center">
                <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Simple, transparent pricing</h2>
                <p className="mt-3 text-ink-muted">Every plan includes every feature. Only the volume changes.</p>
              </div>

              <div className="mt-10 flex justify-center">
                <div className="inline-flex rounded-xl border border-line bg-surface p-1" role="tablist">
                  {[{ key: 'creators', label: 'For creators' }, { key: 'ecom', label: 'For e-commerce' }].map((t) => (
                    <button key={t.key} role="tab" aria-selected={pricingTab === t.key} onClick={() => setPricingTab(t.key)}
                      className={"h-9 rounded-lg px-5 text-sm font-medium transition-colors " + (pricingTab === t.key ? "bg-raised text-ink shadow-sm" : "text-ink-muted hover:text-ink")}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex justify-center">
                {pricingTab === 'creators' ? (
                  <div className="inline-flex rounded-xl border border-line p-1" role="tablist" aria-label="Billing period">
                    {[{ key: 'monthly', label: 'Monthly' }, { key: 'yearly', label: 'Yearly', note: 'Save up to 24%' }].map((o) => (
                      <button key={o.key} role="tab" aria-selected={creatorBilling === o.key} onClick={() => setCreatorBilling(o.key)}
                        className={"h-8 rounded-lg px-4 text-[13px] transition-colors " + (creatorBilling === o.key ? "bg-white/10 text-ink" : "text-ink-muted hover:text-ink")}>
                        {o.label}{o.note && <span className="ml-1.5 text-accent-text">{o.note}</span>}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="inline-flex rounded-xl border border-line p-1" role="tablist" aria-label="Billing period">
                    {[{ key: 'monthly', label: 'Monthly' }, { key: 'sixmonths', label: '6 months' }, { key: 'yearly', label: 'Yearly' }].map((o) => (
                      <button key={o.key} role="tab" aria-selected={ecomBilling === o.key} onClick={() => setEcomBilling(o.key)}
                        className={"h-8 rounded-lg px-4 text-[13px] transition-colors " + (ecomBilling === o.key ? "bg-white/10 text-ink" : "text-ink-muted hover:text-ink")}>
                        {o.label}{ecomSavings[o.key] && <span className="ml-1.5 text-accent-text">{ecomSavings[o.key]}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {pricingTab === 'creators' ? (
                <div className="mx-auto mt-10 grid max-w-3xl gap-5 md:grid-cols-2">
                  {creatorPlans.length === 0
                    ? <p className="col-span-full py-8 text-center text-sm text-ink-muted">Loading plans…</p>
                    : creatorPlans.map((plan) => planCard(plan, creatorBilling === 'monthly' ? plan.price_monthly : plan.price_yearly, creatorBilling === 'yearly' ? 'Billed annually' : null))}
                </div>
              ) : (
                <div className="mt-10 grid gap-5 md:grid-cols-3">
                  {ecomPlansDb.length === 0
                    ? <p className="col-span-full py-8 text-center text-sm text-ink-muted">Loading plans…</p>
                    : ecomPlansDb.map((plan) => planCard(
                        plan,
                        ecomBilling === 'monthly' ? plan.price_monthly : ecomBilling === 'sixmonths' ? Math.round(plan.price_monthly * 0.86) : plan.price_yearly,
                        ecomBilling === 'sixmonths' ? 'Billed every 6 months' : ecomBilling === 'yearly' ? 'Billed annually' : null,
                      ))}
                </div>
              )}

              <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5 sm:flex-row">
                <div>
                  <p className="font-medium text-ink">Try it free first</p>
                  <p className="text-sm text-ink-muted">25 free tokens, enough for 2 watermarked videos. No credit card.</p>
                </div>
                <ButtonLink href="/signup" variant="secondary" size="md">Start for free</ButtonLink>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="scroll-mt-20 border-t border-line px-4 py-24 md:px-8">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-center text-3xl font-semibold tracking-tight md:text-4xl">Frequently asked questions</h2>
              <p className="mt-3 text-center text-ink-muted">More questions? Email <a href="mailto:support@klipflowai.com" className="text-accent-text hover:underline">support@klipflowai.com</a></p>
              <div className="mt-10 divide-y divide-line rounded-2xl border border-line bg-surface">
                {faqs.map((item, i) => (
                  <div key={i}>
                    <button onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-medium text-ink transition-colors hover:bg-white/[0.02]">
                      {item.q}
                      <ChevronDown size={18} aria-hidden className={"flex-shrink-0 text-ink-muted transition-transform " + (openFaq === i ? "rotate-180" : "")} />
                    </button>
                    {openFaq === i && <p className="px-5 pb-5 text-sm leading-relaxed text-ink-muted">{item.a}</p>}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* FINAL CTA */}
          <section className="px-4 pb-24 md:px-8">
            <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-line bg-surface px-6 py-16 text-center">
              <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ background: "radial-gradient(60% 80% at 50% 0%, rgba(109,74,255,0.35), transparent 70%)" }} />
              <div className="relative">
                <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Your next ad is one prompt away</h2>
                <p className="mx-auto mt-3 max-w-lg text-ink-muted">Start with 25 free tokens. No credit card, cancel anytime.</p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <ButtonLink href="/signup" variant="primary" size="lg">Start for free <ArrowRight size={17} aria-hidden /></ButtonLink>
                  <a href="#pricing" className={buttonClass("secondary", "lg")}>See pricing</a>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* FOOTER */}
        <footer className="border-t border-line px-4 py-14 md:px-8">
          <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-4">
            <div>
              <span className="text-[17px] font-semibold tracking-tight">KlipflowAI</span>
              <p className="mt-3 text-sm leading-relaxed text-ink-subtle">Spy on what works, create better ads, and launch them, all in one place.</p>
            </div>
            {[
              { title: "Product", links: [{ href: "#templates", label: "Templates" }, { href: "#pricing", label: "Pricing" }, { href: "/api-docs", label: "API docs" }] },
              { title: "Resources", links: [{ href: "/blog", label: "Blog" }, { href: "/academy", label: "Academy" }, { href: "#faq", label: "FAQ" }] },
              { title: "Company", links: [{ href: "/about", label: "About" }, { href: "/contact", label: "Contact" }, { href: "/privacy-policy", label: "Privacy policy" }, { href: "/terms-of-service", label: "Terms of service" }, { href: "/refund-policy", label: "Refund policy" }] },
            ].map((col) => (
              <div key={col.title}>
                <h3 className="mb-4 text-sm font-medium text-ink">{col.title}</h3>
                <ul className="space-y-2.5 text-sm text-ink-subtle">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {l.href.startsWith("#") ? <a href={l.href} className="transition-colors hover:text-ink">{l.label}</a> : <Link href={l.href} className="transition-colors hover:text-ink">{l.label}</Link>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mx-auto mt-12 max-w-6xl border-t border-line pt-6 text-sm text-ink-subtle">© 2026 KlipflowAI. All rights reserved.</div>
        </footer>
      </div>

      {/* FLOATING PROMPT BAR */}
      <div
        inert={!showBar}
        className={"fixed bottom-5 left-1/2 z-30 w-[min(640px,calc(100%-2rem))] -translate-x-1/2 transition-all duration-300 lg:ml-32 " + (showBar ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0")}
      >
        <PromptComposer variant="bar" value={prompt} onChange={setPrompt} mode={mode} onSubmit={handlePromptSubmit} />
      </div>
    </div>
  );
}
