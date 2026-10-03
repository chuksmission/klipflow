'use client';
import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Activity, ArrowRight, Bot, Clapperboard, Coins, CreditCard, Image as ImageIcon, Images, Radar, Send, Sparkles, type LucideIcon } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Badge, ButtonLink, EmptyState, PageHeader, SectionTitle, StatCard, cardClass } from "../components/ui";

export default function Dashboard() {
  const t = useTranslations("overview");
  const nav = useTranslations("nav");
  const locale = useLocale();
  const [user, setUser] = useState<any>(null);
  const [tokens, setTokens] = useState(25);
  const [counts, setCounts] = useState({ videos: 0, images: 0 });

  const stats: { icon: LucideIcon; label: string; value: number; sub: string }[] = [
    { icon: Clapperboard, label: t("videosGenerated"), value: counts.videos, sub: t("completed", { count: counts.videos }) },
    { icon: ImageIcon, label: t("imagesGenerated"), value: counts.images, sub: t("completed", { count: counts.images }) },
    { icon: Send, label: t("postsPublished"), value: 0, sub: t("thisWeek", { count: 0 }) },
    { icon: Radar, label: t("adsSpied"), value: 0, sub: t("saved", { count: 0 }) },
  ];

  const quickActions: { icon: LucideIcon; title: string; desc: string; href: string }[] = [
    { icon: Sparkles, title: t("openStudio"), desc: t("openStudioDesc"), href: "/dashboard/studio" },
    { icon: Radar, title: t("spyAds"), desc: t("spyAdsDesc"), href: "/dashboard/ad-spy" },
    { icon: Bot, title: t("setupAutopilot"), desc: t("setupAutopilotDesc"), href: "/dashboard/autopilot" },
    { icon: CreditCard, title: t("topUpTokens"), desc: t("topUpTokensDesc"), href: "/dashboard/billing" },
    { icon: Images, title: nav("gallery"), desc: t("galleryDesc"), href: "/dashboard/gallery" },
    { icon: Activity, title: nav("activity"), desc: t("activityDesc"), href: "/dashboard/activity" },
  ];

  const taskBreakdown = [
    { label: t("taskTextToVideo"), count: 0, credits: 0 },
    { label: t("taskImageToVideo"), count: 0, credits: 0 },
    { label: t("taskActor"), count: 0, credits: 0 },
    { label: t("taskVoice"), count: 0, credits: 0 },
    { label: nav("adSpy"), count: 0, credits: 0 },
  ];

  const weeklyUsage = [0, 0, 0, 0, 0, 0, 0];
  // Monday-first weekday names in the interface language
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" }));
  const maxUsage = Math.max(...weeklyUsage, 1);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUser(session.user);

      try {
        const tokenRes = await fetch('/api/tokens', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const tokenData = await tokenRes.json();
        if (tokenData.balance !== undefined) setTokens(tokenData.balance);
      } catch (e) {
        console.error('Token fetch error:', e);
      }

      try {
        const genRes = await fetch('/api/generations', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const genData = await genRes.json();
        const generations = genData.generations || [];
        setCounts({
          videos: generations.filter((g: any) => g.type?.includes('video')).length,
          images: generations.filter((g: any) => g.type?.includes('image')).length,
        });
      } catch (e) {
        console.error('Generations fetch error:', e);
      }
    };
    getUser();
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t("welcome")}
        description={new Date().toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        actions={<ButtonLink href="/dashboard/studio" variant="primary"><Sparkles size={16} aria-hidden /> {nav("create")}</ButtonLink>}
      />

      {/* TOKENS */}
      <div className={`${cardClass} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="flex items-center gap-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent-text"><Coins size={20} aria-hidden /></span>
          <div>
            <p className="text-2xl font-semibold tracking-tight">{tokens} <span className="text-base font-normal text-ink-muted">{t("tokensUnit")}</span></p>
            <p className="text-sm text-ink-subtle">{t("availableBalance")}</p>
          </div>
        </div>
        <ButtonLink href="/dashboard/billing" variant="secondary">{t("topUp")}</ButtonLink>
      </div>

      {/* FREE TRIAL BANNER */}
      {tokens === 25 && (
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-accent/30 bg-accent/[0.08] p-5 md:flex-row md:items-center">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2"><Badge tone="accent">{t("freeTrial")}</Badge><h3 className="font-semibold">{t("freeTrialTitle")}</h3></div>
            <p className="text-sm text-ink-muted">{t("freeTrialDesc")}</p>
          </div>
          <ButtonLink href="/dashboard/studio" variant="primary">{t("firstVideo")} <ArrowRight size={16} className="rtl:-scale-x-100" aria-hidden /></ButtonLink>
        </div>
      )}

      {/* LOW TOKEN WARNING */}
      {tokens <= 10 && tokens < 25 && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-red-500/25 bg-red-500/[0.08] p-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-red-300">{t("lowBalance", { count: tokens })}</p>
            <p className="text-xs text-ink-muted">{t("lowBalanceDesc")}</p>
          </div>
          <ButtonLink href="/dashboard/billing" variant="primary" size="sm">{t("topUpNow")}</ButtonLink>
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} icon={stat.icon} label={stat.label} value={stat.value} hint={stat.sub} />
        ))}
      </div>

      {/* CHARTS ROW */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className={`${cardClass} p-5 md:p-6`}>
          <SectionTitle description={t("successfulOnly")}>{t("creditsSpent")}</SectionTitle>
          {weeklyUsage.every(v => v === 0) ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-line text-sm text-ink-subtle">
              {t("noActivity")}
            </div>
          ) : (
            <div className="flex h-32 items-end gap-2">
              {weeklyUsage.map((val, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full rounded-t-md bg-accent transition-all" style={{ height: `${(val / maxUsage) * 100}%`, minHeight: val > 0 ? '4px' : '0' }} />
                  <span className="text-xs text-ink-subtle">{days[i]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`${cardClass} p-5 md:p-6`}>
          <SectionTitle description={t("perFeature")}>{t("taskBreakdown")}</SectionTitle>
          <div className="space-y-3.5">
            {taskBreakdown.map((task) => (
              <div key={task.label} className="flex items-center justify-between gap-3">
                <span className="text-sm text-ink-muted">{task.label}</span>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.07]">
                    <div className="h-full rounded-full bg-accent" style={{ width: task.credits > 0 ? `${(task.credits / 100) * 100}%` : '0%' }} />
                  </div>
                  <span className="w-16 text-end text-xs tabular-nums text-ink-subtle">{t("taskCount", { count: task.count, credits: task.credits })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div>
        <SectionTitle>{t("quickActions")}</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href} className={`${cardClass} group flex items-start gap-4 p-5 transition-colors hover:border-line-strong hover:bg-raised`}>
                <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-text"><Icon size={19} aria-hidden /></span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink">{action.title}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-ink-muted">{action.desc}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* RECENT ACTIVITY */}
      <div>
        <SectionTitle action={<Link href="/dashboard/activity" className="text-sm font-medium text-accent-text hover:text-ink">{t("viewAll")}</Link>}>{t("recentActivity")}</SectionTitle>
        <EmptyState
          icon={Clapperboard}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          action={<ButtonLink href="/dashboard/studio" variant="primary">{t("startCreating")}</ButtonLink>}
        />
      </div>
    </div>
  );
}
