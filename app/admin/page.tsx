"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Activity, Clapperboard, Coins, Cpu, CreditCard, DollarSign, Eye, Globe2, Inbox, Mail, Megaphone, Package, ShieldAlert, Users } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Badge, PageHeader, Skeleton } from "../components/ui";

const COUNTRY_FLAGS: Record<string, string> = {
  US: "🇺🇸", GB: "🇬🇧", CA: "🇨🇦", AU: "🇦🇺", NG: "🇳🇬", GH: "🇬🇭",
  KE: "🇰🇪", ZA: "🇿🇦", IN: "🇮🇳", DE: "🇩🇪", FR: "🇫🇷", BR: "🇧🇷",
  MX: "🇲🇽", JP: "🇯🇵", CN: "🇨🇳", SG: "🇸🇬", AE: "🇦🇪", PH: "🇵🇭",
  ID: "🇮🇩", PK: "🇵🇰", EG: "🇪🇬", TZ: "🇹🇿", ET: "🇪🇹", RW: "🇷🇼",
};

export default function AdminOverview() {
  const [stats, setStats] = useState<any>({
    totalUsers: 0, newToday: 0, totalGenerations: 0, generationsToday: 0,
    totalTokensUsed: 0, mrr: 0, activeSubscriptions: 0, totalLeads: 0, abuseAttempts: 0,
  });
  const [traffic, setTraffic] = useState<any>({
    activeNow: 0, today: 0, last7days: 0, last30days: 0,
    topCountries: [], topPages: [], chart: [],
  });
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const res = await fetch("/api/admin/stats", {
          headers: { Authorization: "Bearer " + session.access_token },
        });
        const data = await res.json();
        if (data.stats) setStats(data.stats);
        if (data.traffic) setTraffic(data.traffic);
        if (data.recentUsers) setRecentUsers(data.recentUsers);
        if (data.recentActivity) setRecentActivity(data.recentActivity);
      } catch (e) {
        console.error("Stats fetch error:", e);
      }
      setLoading(false);
    };
    fetchStats();
    // Refresh active visitors every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const statCards = [
    { label: "Total users", value: stats.totalUsers, sub: stats.newToday + " new today", icon: Users, href: "/admin/users" },
    { label: "MRR", value: "$" + (stats.mrr || 0).toFixed(0), sub: stats.activeSubscriptions + " active subs", icon: DollarSign, href: "/admin/revenue" },
    { label: "Videos generated", value: stats.totalGenerations, sub: stats.generationsToday + " today", icon: Clapperboard, href: "/admin/generations" },
    { label: "Tokens used", value: stats.totalTokensUsed?.toLocaleString(), sub: "All time", icon: Coins, href: "/admin/generations" },
    { label: "Active now", value: traffic.activeNow, sub: "Visitors last 5 mins", icon: Activity, href: "#traffic" },
    { label: "Visitors today", value: traffic.today, sub: traffic.last7days + " this week", icon: Eye, href: "#traffic" },
    { label: "Leads", value: stats.totalLeads, sub: "Contact forms", icon: Inbox, href: "/admin/leads" },
    { label: "Abuse blocked", value: stats.abuseAttempts, sub: "Blocked signups", icon: ShieldAlert, href: "/admin/abuse-control" },
  ];

  const quickLinks = [
    { label: "AI Providers", desc: "Manage API keys", href: "/admin/ai-providers", icon: Cpu },
    { label: "Token Pricing", desc: "Set credit costs", href: "/admin/token-pricing", icon: Coins },
    { label: "Plans", desc: "Manage subscriptions", href: "/admin/plans", icon: Package },
    { label: "Payment Gateways", desc: "Stripe, Paystack, Flutterwave", href: "/admin/payment-gateways", icon: CreditCard },
    { label: "Announcements", desc: "Push notifications", href: "/admin/announcements", icon: Megaphone },
    { label: "Email Settings", desc: "Configure SMTP", href: "/admin/email-settings", icon: Mail },
  ];

  // Chart max for bar scaling
  const chartMax = Math.max(...(traffic.chart?.map((d: any) => d.visits) || [1]), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description={new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) + " · Platform-wide"}
      />

      {/* STAT CARDS */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-[118px] rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((stat, i) => (
            <Link key={i} href={stat.href} className="rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-raised">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] text-ink-muted">{stat.label}</span>
                <stat.icon size={16} className="text-ink-subtle" aria-hidden />
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{stat.value}</div>
              <div className="mt-1 text-xs text-ink-subtle">{stat.sub}</div>
            </Link>
          ))}
        </div>
      )}

      {/* TRAFFIC ANALYTICS */}
      <div id="traffic" className="bg-surface border border-line rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-base">Traffic Analytics</h2>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-emerald-300 text-xs font-semibold">{traffic.activeNow} active now</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Last 5 mins", value: traffic.activeNow, color: "text-emerald-300" },
            { label: "Today", value: traffic.today, color: "text-sky-300" },
            { label: "Last 7 days", value: traffic.last7days, color: "text-purple-400" },
            { label: "Last 30 days", value: traffic.last30days, color: "text-sky-300" },
          ].map((item, i) => (
            <div key={i} className="rounded-xl border border-line bg-canvas p-4">
              <div className={"text-2xl font-semibold tracking-tight tabular-nums " + item.color}>{item.value}</div>
              <div className="text-ink-subtle text-xs mt-1">{item.label}</div>
            </div>
          ))}
        </div>

        {/* TRAFFIC CHART */}
        {traffic.chart?.length > 0 && (
          <div className="mb-6">
            <p className="text-ink-muted text-xs font-semibold mb-3">Daily visits — last 7 days</p>
            <div className="flex items-end gap-2 h-24">
              {traffic.chart.map((d: any, i: number) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-accent rounded-t-sm transition-all"
                    style={{ height: Math.max(4, (d.visits / chartMax) * 80) + "px" }}
                    title={d.visits + " visits"}
                  />
                  <span className="text-ink-subtle text-xs">{d.date?.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* TOP COUNTRIES */}
          <div>
            <p className="text-ink-muted text-xs font-semibold mb-3">Top countries (30 days)</p>
            <div className="space-y-2">
              {traffic.topCountries?.length === 0 ? (
                <p className="text-ink-subtle text-sm">No data yet</p>
              ) : (
                traffic.topCountries?.map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-center text-lg">{COUNTRY_FLAGS[c.code] || <Globe2 size={16} className="inline text-ink-subtle" aria-hidden />}</span>
                      <span className="text-sm">{c.country}</span>
                    </div>
                    <span className="text-ink-muted text-xs">{c.visits} visits</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* TOP PAGES */}
          <div>
            <p className="text-ink-muted text-xs font-semibold mb-3">Top pages (30 days)</p>
            <div className="space-y-2">
              {traffic.topPages?.length === 0 ? (
                <p className="text-ink-subtle text-sm">No data yet</p>
              ) : (
                traffic.topPages?.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-ink truncate max-w-48">{p.page}</span>
                    <span className="text-ink-muted text-xs">{p.visits} visits</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* QUICK SETTINGS */}
      <div>
        <h2 className="text-base font-semibold mb-4">Quick Settings</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {quickLinks.map((link, i) => (
            <Link key={i} href={link.href} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-raised">
              <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-accent/15 text-accent-text"><link.icon size={17} aria-hidden /></span>
              <div className="min-w-0">
                <div className="text-sm font-semibold">{link.label}</div>
                <div className="text-xs text-ink-muted">{link.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* RECENT USERS & ACTIVITY */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-surface border border-line rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Users</h3>
            <Link href="/admin/users" className="text-purple-400 text-xs hover:text-white transition">View all</Link>
          </div>
          {recentUsers.length === 0 ? (
            <p className="text-ink-subtle text-sm text-center py-4">No users yet</p>
          ) : (
            <div className="space-y-3">
              {recentUsers.map((user, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-accent/20 text-xs font-semibold text-accent-text">
                      {user.email?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold truncate max-w-40">{user.email}</div>
                      <div className="text-ink-subtle text-xs">{new Date(user.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <Badge tone="success">active</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface border border-line rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Generations</h3>
            <Link href="/admin/generations" className="text-purple-400 text-xs hover:text-white transition">View all</Link>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-ink-subtle text-sm text-center py-4">No activity yet</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold capitalize">{activity.type?.replace(/_/g, " ")}</div>
                    <div className="text-ink-subtle text-xs truncate max-w-48">{activity.prompt}</div>
                  </div>
                  <div className="text-amber-300 text-xs font-semibold">{activity.tokens_used} tokens</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
