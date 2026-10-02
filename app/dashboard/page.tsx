'use client';
import { useState, useEffect } from "react";
import Link from "next/link";
import { Activity, ArrowRight, Bot, Clapperboard, Coins, CreditCard, Image as ImageIcon, Images, Radar, Send, Sparkles, type LucideIcon } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Badge, ButtonLink, EmptyState, PageHeader, SectionTitle, StatCard, cardClass } from "../components/ui";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [tokens, setTokens] = useState(25);
  const [stats, setStats] = useState<{ icon: LucideIcon; label: string; value: number; sub: string }[]>([
    { icon: Clapperboard, label: "Videos generated", value: 0, sub: "0 completed" },
    { icon: ImageIcon, label: "Images generated", value: 0, sub: "0 completed" },
    { icon: Send, label: "Posts published", value: 0, sub: "0 this week" },
    { icon: Radar, label: "Ads spied", value: 0, sub: "0 saved" },
  ]);

  const quickActions: { icon: LucideIcon; title: string; desc: string; href: string }[] = [
    { icon: Sparkles, title: "Open Studio", desc: "Text to video, image to video, UGC ads and more", href: "/dashboard/studio" },
    { icon: Radar, title: "Spy on ads", desc: "Find winning Facebook ads in your niche", href: "/dashboard/ad-spy" },
    { icon: Bot, title: "Set up Autopilot", desc: "Auto-post to TikTok, IG, YouTube, Facebook and X", href: "/dashboard/autopilot" },
    { icon: CreditCard, title: "Top up tokens", desc: "Get more credits from $5", href: "/dashboard/billing" },
    { icon: Images, title: "Gallery", desc: "All your generated videos and images", href: "/dashboard/gallery" },
    { icon: Activity, title: "Activity", desc: "Full history of your generations", href: "/dashboard/activity" },
  ];

  const taskBreakdown = [
    { label: "Text to Video", count: 0, credits: 0 },
    { label: "Image to Video", count: 0, credits: 0 },
    { label: "AI Actor Generator", count: 0, credits: 0 },
    { label: "Voice Generation", count: 0, credits: 0 },
    { label: "Ad Spy", count: 0, credits: 0 },
  ];

  const weeklyUsage = [0, 0, 0, 0, 0, 0, 0];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
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
        const videos = generations.filter((g: any) => g.type?.includes('video')).length;
        const images = generations.filter((g: any) => g.type?.includes('image')).length;

        setStats([
          { icon: Clapperboard, label: "Videos generated", value: videos, sub: `${videos} completed` },
          { icon: ImageIcon, label: "Images generated", value: images, sub: `${images} completed` },
          { icon: Send, label: "Posts published", value: 0, sub: "0 this week" },
          { icon: Radar, label: "Ads spied", value: 0, sub: "0 saved" },
        ]);
      } catch (e) {
        console.error('Generations fetch error:', e);
      }
    };
    getUser();
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Welcome back"
        description={new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        actions={<ButtonLink href="/dashboard/studio" variant="primary"><Sparkles size={16} aria-hidden /> Create</ButtonLink>}
      />

      {/* TOKENS */}
      <div className={`${cardClass} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="flex items-center gap-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent-text"><Coins size={20} aria-hidden /></span>
          <div>
            <p className="text-2xl font-semibold tracking-tight">{tokens} <span className="text-base font-normal text-ink-muted">tokens</span></p>
            <p className="text-sm text-ink-subtle">Available balance</p>
          </div>
        </div>
        <ButtonLink href="/dashboard/billing" variant="secondary">Top up</ButtonLink>
      </div>

      {/* FREE TRIAL BANNER */}
      {tokens === 25 && (
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-accent/30 bg-accent/[0.08] p-5 md:flex-row md:items-center">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2"><Badge tone="accent">Free trial</Badge><h3 className="font-semibold">You have 25 free tokens</h3></div>
            <p className="text-sm text-ink-muted">Generate your first 2 AI videos for free. No credit card needed.</p>
          </div>
          <ButtonLink href="/dashboard/studio" variant="primary">Generate your first video <ArrowRight size={16} aria-hidden /></ButtonLink>
        </div>
      )}

      {/* LOW TOKEN WARNING */}
      {tokens <= 10 && tokens < 25 && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-red-500/25 bg-red-500/[0.08] p-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-red-300">Low balance: {tokens} tokens left</p>
            <p className="text-xs text-ink-muted">Top up from $5 to keep generating.</p>
          </div>
          <ButtonLink href="/dashboard/billing" variant="primary" size="sm">Top up now</ButtonLink>
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
          <SectionTitle description="Successful tasks only">Credits spent (7 days)</SectionTitle>
          {weeklyUsage.every(v => v === 0) ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-line text-sm text-ink-subtle">
              No activity yet
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
          <SectionTitle description="Credits used per feature">Task breakdown</SectionTitle>
          <div className="space-y-3.5">
            {taskBreakdown.map((task) => (
              <div key={task.label} className="flex items-center justify-between gap-3">
                <span className="text-sm text-ink-muted">{task.label}</span>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.07]">
                    <div className="h-full rounded-full bg-accent" style={{ width: task.credits > 0 ? `${(task.credits / 100) * 100}%` : '0%' }} />
                  </div>
                  <span className="w-16 text-right text-xs tabular-nums text-ink-subtle">{task.count} · {task.credits} cr</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div>
        <SectionTitle>Quick actions</SectionTitle>
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
        <SectionTitle action={<Link href="/dashboard/activity" className="text-sm font-medium text-accent-text hover:text-ink">View all</Link>}>Recent activity</SectionTitle>
        <EmptyState
          icon={Clapperboard}
          title="Nothing here yet"
          description="Generate your first AI video and it will show up here."
          action={<ButtonLink href="/dashboard/studio" variant="primary">Start creating</ButtonLink>}
        />
      </div>
    </div>
  );
}
