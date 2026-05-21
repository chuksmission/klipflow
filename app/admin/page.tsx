"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

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
    { label: "Total Users", value: stats.totalUsers, sub: stats.newToday + " new today", color: "text-blue-400", bg: "bg-blue-900/20 border-blue-500/30", href: "/admin/users" },
    { label: "MRR", value: "$" + (stats.mrr || 0).toFixed(0), sub: stats.activeSubscriptions + " active subs", color: "text-green-400", bg: "bg-green-900/20 border-green-500/30", href: "/admin/revenue" },
    { label: "Videos Generated", value: stats.totalGenerations, sub: stats.generationsToday + " today", color: "text-purple-400", bg: "bg-purple-900/20 border-purple-500/30", href: "/admin/generations" },
    { label: "Tokens Used", value: stats.totalTokensUsed?.toLocaleString(), sub: "All time", color: "text-yellow-400", bg: "bg-yellow-900/20 border-yellow-500/30", href: "/admin/generations" },
    { label: "Active Now", value: traffic.activeNow, sub: "Visitors last 5 mins", color: "text-emerald-400", bg: "bg-emerald-900/20 border-emerald-500/30", href: "#traffic" },
    { label: "Visitors Today", value: traffic.today, sub: traffic.last7days + " this week", color: "text-cyan-400", bg: "bg-cyan-900/20 border-cyan-500/30", href: "#traffic" },
    { label: "Leads", value: stats.totalLeads, sub: "Contact forms", color: "text-orange-400", bg: "bg-orange-900/20 border-orange-500/30", href: "/admin/leads" },
    { label: "Abuse Blocked", value: stats.abuseAttempts, sub: "Blocked signups", color: "text-red-400", bg: "bg-red-900/20 border-red-500/30", href: "/admin/abuse-control" },
  ];

  const quickLinks = [
    { label: "AI Providers", desc: "Manage API keys", href: "/admin/ai-providers", color: "bg-purple-900/20 border-purple-500/30 text-purple-400" },
    { label: "Token Pricing", desc: "Set credit costs", href: "/admin/token-pricing", color: "bg-yellow-900/20 border-yellow-500/30 text-yellow-400" },
    { label: "Plans", desc: "Manage subscriptions", href: "/admin/plans", color: "bg-blue-900/20 border-blue-500/30 text-blue-400" },
    { label: "Payment Gateways", desc: "Stripe, Paystack, Flutterwave", href: "/admin/payment-gateways", color: "bg-green-900/20 border-green-500/30 text-green-400" },
    { label: "Announcements", desc: "Push notifications", href: "/admin/announcements", color: "bg-orange-900/20 border-orange-500/30 text-orange-400" },
    { label: "Email Settings", desc: "Configure SMTP", href: "/admin/email-settings", color: "bg-pink-900/20 border-pink-500/30 text-pink-400" },
  ];

  // Chart max for bar scaling
  const chartMax = Math.max(...(traffic.chart?.map((d: any) => d.visits) || [1]), 1);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/20 border border-purple-500/20 rounded-2xl p-6">
        <h1 className="text-2xl font-extrabold mb-1">Admin Dashboard</h1>
        <p className="text-gray-400 text-sm">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} — Platform-wide overview
        </p>
      </div>

      {/* STAT CARDS */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 animate-pulse">
              <div className="h-8 bg-white/10 rounded mb-2" />
              <div className="h-4 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((stat, i) => (
            <Link key={i} href={stat.href} className={"border rounded-2xl p-5 hover:opacity-80 transition " + stat.bg}>
              <div className={"text-3xl font-extrabold mb-1 " + stat.color}>{stat.value}</div>
              <div className="text-white text-sm font-semibold mb-0.5">{stat.label}</div>
              <div className="text-gray-500 text-xs">{stat.sub}</div>
            </Link>
          ))}
        </div>
      )}

      {/* TRAFFIC ANALYTICS */}
      <div id="traffic" className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-lg">Traffic Analytics</h2>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-400 text-xs font-bold">{traffic.activeNow} active now</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Last 5 mins", value: traffic.activeNow, color: "text-green-400" },
            { label: "Today", value: traffic.today, color: "text-cyan-400" },
            { label: "Last 7 days", value: traffic.last7days, color: "text-purple-400" },
            { label: "Last 30 days", value: traffic.last30days, color: "text-blue-400" },
          ].map((item, i) => (
            <div key={i} className="bg-black/20 rounded-xl p-4 text-center">
              <div className={"text-2xl font-extrabold " + item.color}>{item.value}</div>
              <div className="text-gray-500 text-xs mt-1">{item.label}</div>
            </div>
          ))}
        </div>

        {/* TRAFFIC CHART */}
        {traffic.chart?.length > 0 && (
          <div className="mb-6">
            <p className="text-gray-400 text-xs font-semibold mb-3">Daily visits — last 7 days</p>
            <div className="flex items-end gap-2 h-24">
              {traffic.chart.map((d: any, i: number) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-purple-600/60 rounded-t-sm transition-all"
                    style={{ height: Math.max(4, (d.visits / chartMax) * 80) + "px" }}
                    title={d.visits + " visits"}
                  />
                  <span className="text-gray-600 text-xs">{d.date?.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* TOP COUNTRIES */}
          <div>
            <p className="text-gray-400 text-xs font-semibold mb-3">Top countries (30 days)</p>
            <div className="space-y-2">
              {traffic.topCountries?.length === 0 ? (
                <p className="text-gray-600 text-sm">No data yet</p>
              ) : (
                traffic.topCountries?.map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{COUNTRY_FLAGS[c.code] || "🌍"}</span>
                      <span className="text-sm">{c.country}</span>
                    </div>
                    <span className="text-gray-400 text-xs">{c.visits} visits</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* TOP PAGES */}
          <div>
            <p className="text-gray-400 text-xs font-semibold mb-3">Top pages (30 days)</p>
            <div className="space-y-2">
              {traffic.topPages?.length === 0 ? (
                <p className="text-gray-600 text-sm">No data yet</p>
              ) : (
                traffic.topPages?.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-gray-300 truncate max-w-48">{p.page}</span>
                    <span className="text-gray-400 text-xs">{p.visits} visits</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* QUICK SETTINGS */}
      <div>
        <h2 className="text-lg font-bold mb-4">Quick Settings</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {quickLinks.map((link, i) => (
            <Link key={i} href={link.href} className={"border rounded-xl p-4 hover:opacity-80 transition " + link.color}>
              <div className="font-bold text-sm mb-0.5">{link.label}</div>
              <div className="text-gray-400 text-xs">{link.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* RECENT USERS & ACTIVITY */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">Recent Users</h3>
            <Link href="/admin/users" className="text-purple-400 text-xs hover:text-white transition">View all</Link>
          </div>
          {recentUsers.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No users yet</p>
          ) : (
            <div className="space-y-3">
              {recentUsers.map((user, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-xs font-bold">
                      {user.email?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold truncate max-w-40">{user.email}</div>
                      <div className="text-gray-500 text-xs">{new Date(user.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="bg-green-900/30 text-green-400 text-xs font-bold px-2 py-0.5 rounded-full">active</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">Recent Generations</h3>
            <Link href="/admin/generations" className="text-purple-400 text-xs hover:text-white transition">View all</Link>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No activity yet</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold capitalize">{activity.type?.replace(/_/g, " ")}</div>
                    <div className="text-gray-500 text-xs truncate max-w-48">{activity.prompt}</div>
                  </div>
                  <div className="text-yellow-400 text-xs font-bold">{activity.tokens_used} tokens</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
