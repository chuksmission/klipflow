"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

export default function AdminOverview() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    newToday: 0,
    totalGenerations: 0,
    totalTokensUsed: 0,
    totalRevenue: 0,
    activeSubscriptions: 0,
    totalLeads: 0,
    abuseAttempts: 0,
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
        if (data.recentUsers) setRecentUsers(data.recentUsers);
        if (data.recentActivity) setRecentActivity(data.recentActivity);
      } catch (e) {
        console.error("Stats fetch error:", e);
      }
      setLoading(false);
    };
    fetchStats();
  }, []);

  const statCards = [
    { icon: "??", label: "Total Users", value: stats.totalUsers, sub: stats.newToday + " new today", color: "text-blue-400", href: "/admin/users" },
    { icon: "??", label: "Videos Generated", value: stats.totalGenerations, sub: "All time", color: "text-purple-400", href: "/admin/generations" },
    { icon: "??", label: "Tokens Used", value: stats.totalTokensUsed.toLocaleString(), sub: "All time", color: "text-yellow-400", href: "/admin/generations" },
    { icon: "??", label: "Total Revenue", value: "$" + stats.totalRevenue, sub: "All time", color: "text-green-400", href: "/admin/revenue" },
    { icon: "??", label: "Subscriptions", value: stats.activeSubscriptions, sub: "Active paying users", color: "text-pink-400", href: "/admin/revenue" },
    { icon: "??", label: "Leads", value: stats.totalLeads, sub: "Contact forms", color: "text-orange-400", href: "/admin/leads" },
    { icon: "???", label: "Abuse Attempts", value: stats.abuseAttempts, sub: "Blocked signups", color: "text-red-400", href: "/admin/abuse-control" },
  ];

  const quickLinks = [
    { icon: "??", label: "AI Providers", desc: "Manage API keys", href: "/admin/ai-providers" },
    { icon: "??", label: "Token Pricing", desc: "Set credit costs", href: "/admin/token-pricing" },
    { icon: "??", label: "Plans", desc: "Manage subscriptions", href: "/admin/plans" },
    { icon: "??", label: "Payment Gateways", desc: "Stripe, Paystack, Flutterwave", href: "/admin/payment-gateways" },
    { icon: "??", label: "Email Settings", desc: "Configure SMTP", href: "/admin/email-settings" },
    { icon: "??", label: "Announcements", desc: "Push notifications", href: "/admin/announcements" },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/20 border border-purple-500/20 rounded-2xl p-6">
        <h1 className="text-2xl font-extrabold mb-1">Admin Dashboard ???</h1>
        <p className="text-gray-400 text-sm">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}  Platform-wide overview
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 animate-pulse">
              <div className="h-8 bg-white/10 rounded mb-2" />
              <div className="h-4 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((stat, i) => (
            <Link key={i} href={stat.href} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-purple-500/50 transition">
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className={"text-2xl font-extrabold mb-1 " + stat.color}>{stat.value}</div>
              <div className="text-white text-xs font-semibold mb-0.5">{stat.label}</div>
              <div className="text-gray-500 text-xs">{stat.sub}</div>
            </Link>
          ))}
        </div>
      )}

      <div>
        <h2 className="text-lg font-bold mb-4">Quick Settings</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {quickLinks.map((link, i) => (
            <Link key={i} href={link.href} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-purple-500/50 transition">
              <div className="text-2xl mb-2">{link.icon}</div>
              <div className="font-bold text-sm mb-0.5">{link.label}</div>
              <div className="text-gray-500 text-xs">{link.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">Recent Users</h3>
            <Link href="/admin/users" className="text-purple-400 text-xs hover:text-white transition">View all ?</Link>
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
            <h3 className="font-bold">Recent Activity</h3>
            <Link href="/admin/generations" className="text-purple-400 text-xs hover:text-white transition">View all ?</Link>
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
                  <div className="text-yellow-400 text-xs font-bold">?? {activity.tokens_used}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
