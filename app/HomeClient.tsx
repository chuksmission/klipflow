'use client';
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ChevronDown } from "lucide-react";
import { supabase } from "./lib/supabase";
import PromptComposer from "./components/PromptComposer";
import ShowcaseGrid, { type ShowcaseItem } from "./components/ShowcaseGrid";
import { ButtonLink } from "./components/ui/Button";
import { moduleForGenerationType, savePendingGeneration, studioHref, type StudioModuleId } from "./components/catalog";
import { displaySerif } from "./components/home/fonts";
import IntroPortal from "./components/home/IntroPortal";
import HomeHeader from "./components/home/HomeHeader";
import HeroSection from "./components/home/HeroSection";
import FeatureStack from "./components/home/FeatureStack";
import DemoCarousel from "./components/home/DemoCarousel";
import LanguageSection from "./components/home/LanguageSection";
import UseCases from "./components/home/UseCases";
import PoweredBy from "./components/home/PoweredBy";
import ClosingCta from "./components/home/ClosingCta";
import SiteFooter from "./components/home/SiteFooter";
import { DEMO_SLIDES, FEATURES, USE_CASES, type UseCase } from "./components/home/home-data";
import { pickClip, pickHero } from "./components/home/media";
import type { SocialLink } from "./lib/social-links";

interface Plan {
  id: string | number;
  name: string;
  description?: string | null;
  price_monthly: number;
  price_yearly: number;
  tokens_per_month?: number | null;
  features?: string[] | null;
  is_popular?: boolean | null;
}

interface StartParams { module: StudioModuleId; prompt?: string; model?: string; aspect_ratio?: string; duration?: string; language?: string; accent?: string }

export default function HomeClient({ socialLinks }: { socialLinks: SocialLink[] }) {
  const t = useTranslations("home");
  const c = useTranslations("common");
  const [pricingTab, setPricingTab] = useState('creators');
  const [creatorBilling, setCreatorBilling] = useState('monthly');
  const [ecomBilling, setEcomBilling] = useState('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [creatorPlans, setCreatorPlans] = useState<Plan[]>([]);
  const [ecomPlansDb, setEcomPlansDb] = useState<Plan[]>([]);
  const [showcase, setShowcase] = useState<ShowcaseItem[]>([]);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<StudioModuleId>("text_to_video");
  const [showBar, setShowBar] = useState(false);
  const afterHero = useRef<HTMLDivElement>(null);
  const beforeClosing = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setIsLoggedIn(true);
    };
    const fetchPlans = async () => {
      try {
        const res = await fetch("/api/plans");
        const data = await res.json();
        const all: Plan[] = data.plans || [];
        setCreatorPlans(all.filter((p) => p.name.toLowerCase().includes("creator")));
        setEcomPlansDb(all.filter((p) => !p.name.toLowerCase().includes("creator")));
      } catch { /* pricing shows its loading note */ }
    };
    const fetchShowcase = async () => {
      try {
        const res = await fetch("/api/showcase");
        const data = await res.json();
        setShowcase(data.items ?? []);
      } catch { /* showcase is optional: sections show placeholders */ }
    };
    checkSession();
    fetchPlans();
    fetchShowcase();
  }, []);

  // Floating prompt bar: shown between the end of the hero and the closing CTA
  useEffect(() => {
    const start = afterHero.current;
    const end = beforeClosing.current;
    if (!start || !end) return;
    let past = false;
    let atEnd = false;
    const sync = () => setShowBar(past && !atEnd);
    const a = new IntersectionObserver(([e]) => { past = e.boundingClientRect.top < 0 && !e.isIntersecting; sync(); }, { threshold: 0 });
    const b = new IntersectionObserver(([e]) => { atEnd = e.isIntersecting || e.boundingClientRect.top < 0; sync(); }, { threshold: 0 });
    a.observe(start);
    b.observe(end);
    return () => { a.disconnect(); b.disconnect(); };
  }, []);

  const startCreating = (p: StartParams) => {
    savePendingGeneration(p);
    router.push(isLoggedIn ? studioHref(p.module) : "/signup");
  };
  const openModule = (module: StudioModuleId) => startCreating({ module });
  const handlePromptSubmit = () => startCreating({ module: mode, prompt: prompt.trim() || undefined });

  // Demo videos open the tool they demonstrate, without carrying over a prompt or model
  const useTemplate = (item: ShowcaseItem) => startCreating({
    module: moduleForGenerationType(item.type, item.model),
    prompt: item.type === "demo_video" ? undefined : item.prompt ?? undefined,
    model: item.type === "demo_video" ? undefined : item.model ?? undefined,
    aspect_ratio: item.aspect_ratio ?? undefined,
    duration: item.duration ?? undefined,
    language: item.language ?? undefined,
    accent: item.accent ?? undefined,
  });

  const openUseCase = (card: UseCase) => {
    if (card.module) startCreating({ module: card.module, prompt: card.prompt, aspect_ratio: card.aspect_ratio });
    else if (card.href) router.push(card.href.startsWith("/dashboard") && !isLoggedIn ? "/signup" : card.href);
  };

  // Which showcase clip illustrates each section (placeholders where none fits)
  const media = useMemo(() => {
    const used = new Set<ShowcaseItem["id"]>();
    const hero = pickHero(showcase);
    if (hero) used.add(hero.id);
    const features = FEATURES.map((f) => (f.module ? pickClip(showcase, f.types, used, true) : null));
    const demos = DEMO_SLIDES.map((s) => showcase.find((i) => i.type === "demo_video" && moduleForGenerationType(i.type, i.model) === s.module) ?? null);
    const useCases: Record<string, ShowcaseItem | null> = {};
    for (const u of USE_CASES) for (const card of u.cards) useCases[`${u.id}/${card.id}`] = card.types.length ? pickClip(showcase, card.types, used, true) : null;
    return { hero, features, demos, useCases };
  }, [showcase]);

  const ecomSavings: Record<string, string> = { monthly: '', sixmonths: t("save14"), yearly: t("save20") };
  const faqs = t.raw("faq") as { q: string; a: string }[];

  const planCard = (plan: Plan, price: number | string, billingNote: string | null) => (
    <div key={plan.id} className={"relative flex flex-col rounded-2xl border p-7 " + (plan.is_popular ? "border-accent/70 bg-accent/[0.06]" : "border-white/[0.08] bg-white/[0.02]")}>
      {plan.is_popular && <span className="absolute -top-3 start-7 rounded-full bg-accent px-3 py-1 text-xs font-medium text-white">{t("mostPopular")}</span>}
      <h3 className="text-lg font-semibold text-ink">{plan.name}</h3>
      {plan.description && <p className="mt-1 text-sm text-ink-muted">{plan.description}</p>}
      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-4xl font-semibold tracking-tight text-ink">${price}</span>
        <span className="text-ink-muted">{t("perMonth")}</span>
      </div>
      {billingNote && <p className="mt-1 text-xs text-ink-subtle">{billingNote}</p>}
      {plan.tokens_per_month && <p className="mt-3 text-sm font-medium text-accent-text">{t("tokensPerMonth", { count: plan.tokens_per_month })}</p>}
      {Array.isArray(plan.features) && plan.features.length > 0 && (
        <ul className="mt-5 space-y-2.5">
          {plan.features.map((feature, j) => (
            <li key={j} className="flex items-start gap-2.5 text-sm text-ink-muted">
              <Check size={16} className="mt-0.5 flex-shrink-0 text-accent-text" aria-hidden /> {feature}
            </li>
          ))}
        </ul>
      )}
      <div className="flex-1" />
      <ButtonLink href="/signup" variant={plan.is_popular ? "primary" : "secondary"} size="lg" className="mt-7 w-full rounded-full">{t("getStarted")}</ButtonLink>
    </div>
  );

  const toggleClass = (on: boolean) => "h-8 rounded-full px-4 text-[13px] transition-colors " + (on ? "bg-white text-black" : "text-white/60 hover:text-white");

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <IntroPortal />
      <HomeHeader loggedIn={isLoggedIn} />

      <main>
        <HeroSection videoUrl={media.hero?.video_url ?? null} serifClass={displaySerif.className} onStart={() => openModule("text_to_video")} />
        <div ref={afterHero} />

        <FeatureStack clips={media.features} onOpen={openModule} />
        <DemoCarousel clips={media.demos} onOpen={openModule} />
        <LanguageSection clip={media.hero} onStart={() => openModule("video_translator")} />
        <span id="templates" className="block scroll-mt-16" />
        <UseCases clips={media.useCases} onCard={openUseCase} />

        {/* Community gallery: every featured clip, with "Try it" */}
        {showcase.length > 0 && (
          <section id="showcase" className="scroll-mt-16 px-4 py-24 md:px-8">
            <div className="mx-auto max-w-6xl">
              <div className="mb-10 text-center">
                <h2 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">{t("showcaseTitle")}</h2>
                <p className="mt-3 text-sm text-ink-muted md:text-base">{t("showcaseSubtitle")}</p>
              </div>
              <ShowcaseGrid items={showcase} onUse={useTemplate} />
            </div>
          </section>
        )}

        <PoweredBy />

        {/* PRICING */}
        <section id="pricing" className="scroll-mt-16 px-4 py-24 md:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">{t("pricingTitle")}</h2>
              <p className="mt-3 text-ink-muted">{t("pricingSubtitle")}</p>
            </div>

            <div className="mt-10 flex justify-center">
              <div className="inline-flex rounded-full border border-white/10 p-1" role="tablist">
                {[{ key: 'creators', label: t('forCreators') }, { key: 'ecom', label: t('forEcom') }].map((tab) => (
                  <button key={tab.key} role="tab" aria-selected={pricingTab === tab.key} onClick={() => setPricingTab(tab.key)}
                    className={"h-9 rounded-full px-5 text-sm font-medium transition-colors " + (pricingTab === tab.key ? "bg-white text-black" : "text-white/60 hover:text-white")}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex justify-center">
              {pricingTab === 'creators' ? (
                <div className="inline-flex rounded-full border border-white/10 p-1" role="tablist" aria-label={t("billingPeriod")}>
                  {[{ key: 'monthly', label: t('monthly') }, { key: 'yearly', label: t('yearly'), note: t('saveUpTo') }].map((o) => (
                    <button key={o.key} role="tab" aria-selected={creatorBilling === o.key} onClick={() => setCreatorBilling(o.key)} className={toggleClass(creatorBilling === o.key)}>
                      {o.label}{o.note && <span className={"ms-1.5 " + (creatorBilling === o.key ? "text-accent" : "text-accent-text")}>{o.note}</span>}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="inline-flex rounded-full border border-white/10 p-1" role="tablist" aria-label={t("billingPeriod")}>
                  {[{ key: 'monthly', label: t('monthly') }, { key: 'sixmonths', label: t('sixMonths') }, { key: 'yearly', label: t('yearly') }].map((o) => (
                    <button key={o.key} role="tab" aria-selected={ecomBilling === o.key} onClick={() => setEcomBilling(o.key)} className={toggleClass(ecomBilling === o.key)}>
                      {o.label}{ecomSavings[o.key] && <span className={"ms-1.5 " + (ecomBilling === o.key ? "text-accent" : "text-accent-text")}>{ecomSavings[o.key]}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {pricingTab === 'creators' ? (
              <div className="mx-auto mt-10 grid max-w-3xl gap-5 md:grid-cols-2">
                {creatorPlans.length === 0
                  ? <p className="col-span-full py-8 text-center text-sm text-ink-muted">{t("loadingPlans")}</p>
                  : creatorPlans.map((plan) => planCard(plan, creatorBilling === 'monthly' ? plan.price_monthly : plan.price_yearly, creatorBilling === 'yearly' ? t('billedAnnually') : null))}
              </div>
            ) : (
              <div className="mt-10 grid gap-5 md:grid-cols-3">
                {ecomPlansDb.length === 0
                  ? <p className="col-span-full py-8 text-center text-sm text-ink-muted">{t("loadingPlans")}</p>
                  : ecomPlansDb.map((plan) => planCard(
                      plan,
                      ecomBilling === 'monthly' ? plan.price_monthly : ecomBilling === 'sixmonths' ? Math.round(plan.price_monthly * 0.86) : plan.price_yearly,
                      ecomBilling === 'sixmonths' ? t('billedSixMonths') : ecomBilling === 'yearly' ? t('billedAnnually') : null,
                    ))}
              </div>
            )}

            <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:flex-row">
              <div>
                <p className="font-medium text-ink">{t("tryFreeTitle")}</p>
                <p className="text-sm text-ink-muted">{t("tryFreeDesc")}</p>
              </div>
              <ButtonLink href="/signup" variant="secondary" size="md" className="rounded-full">{c("startFree")}</ButtonLink>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-16 px-4 py-24 md:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-semibold tracking-tight text-white md:text-5xl">{t("faqTitle")}</h2>
            <p className="mt-3 text-center text-ink-muted">{t.rich("faqMore", { link: (chunks) => <a href="mailto:support@klipflowai.com" className="text-accent-text hover:underline">{chunks}</a> })}</p>
            <div className="mt-10 divide-y divide-white/[0.06] border-y border-white/[0.06]">
              {faqs.map((item, i) => (
                <div key={i}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}
                    className="flex w-full items-center justify-between gap-4 py-5 text-start text-[15px] font-medium text-ink transition-colors hover:text-white">
                    {item.q}
                    <ChevronDown size={18} aria-hidden className={"flex-shrink-0 text-ink-muted transition-transform " + (openFaq === i ? "rotate-180" : "")} />
                  </button>
                  {openFaq === i && <p className="pb-5 text-sm leading-relaxed text-ink-muted">{item.a}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <div ref={beforeClosing} />
        <ClosingCta serifClass={displaySerif.className} onStart={() => openModule("text_to_video")} />
      </main>

      <SiteFooter socialLinks={socialLinks} />

      {/* FLOATING PROMPT BAR */}
      <div
        inert={!showBar}
        className={"fixed bottom-5 left-1/2 z-30 w-[min(640px,calc(100%-2rem))] -translate-x-1/2 transition-all duration-300 " + (showBar ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0")}
      >
        <PromptComposer variant="bar" value={prompt} onChange={setPrompt} mode={mode} onModeChange={setMode} onSubmit={handlePromptSubmit} />
      </div>
    </div>
  );
}
