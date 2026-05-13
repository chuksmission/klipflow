'use client';
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [tokens] = useState(25);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUser(session.user);

      // Fetch real token balance
      const tokenRes = await fetch('/api/tokens', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const tokenData = await tokenRes.json();
      if (tokenData.balance !== undefined) setTokens(tokenData.balance);

      // Fetch real generations count
      const genRes = await fetch('/api/generations', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const genData = await genRes.json();
      const generations = genData.generations || [];
      const videos = generations.filter((g: any) => g.type?.includes('video')).length;
      const images = generations.filter((g: any) => g.type?.includes('image')).length;

      setStats([
        { icon: "🎬", label: "Videos Generated", value: videos, sub: `${videos} completed`, color: "text-purple-400" },
        { icon: "🖼️", label: "Images Generated", value: images, sub: `${images} completed`, color: "text-pink-400" },
        { icon: "📡", label: "Posts Published", value: 0, sub: "0 this week", color: "text-blue-400" },
        { icon: "🕵️", label: "Ads Spied", value: 0, sub: "0 saved", color: "text-green-400" },
      ]);
    };
    getUser();
  }, []);

  const [stats, setStats] = useState([
    { icon: "🎬", label: "Videos Generated", value: 0, sub: "0 completed", color: "text-purple-400" },
    { icon: "🖼️", label: "Images Generated", value: 0, sub: "0 completed", color: "text-pink-400" },
    { icon: "📡", label: "Posts Published", value: 0, sub: "0 this week", color: "text-blue-400" },
    { icon: "🕵️", label: "Ads Spied", value: 0, sub: "0 saved", color: "text-green-400" },
  ]);

  const quickActions = [
    { icon: "🎬", title: "Generate Video", desc: "Text to video, image to video, avatar videos", href: "/dashboard/studio", color: "from-purple-600 to-purple-800" },
    { icon: "🕵️", title: "Spy on Ads", desc: "Find winning Facebook ads in your niche", href: "/dashboard/ad-spy", color: "from-pink-600 to-pink-800" },
    { icon: "🤖", title: "Set Autopilot", desc: "Auto-post to TikTok, IG, YT, FB, X daily", href: "/dashboard/autopilot", color: "from-blue-600 to-blue-800" },
    { icon: "💳", title: "Top Up Tokens", desc: "Get more credits from just $5", href: "/dashboard/billing", color: "from-green-600 to-green-800" },
    { icon: "🖼️", title: "View Gallery", desc: "All your generated videos and images", href: "/dashboard/gallery", color: "from-yellow-600 to-orange-700" },
    { icon: "⚡", title: "Activity Log", desc: "Full history of all your generations", href: "/dashboard/activity", color: "from-indigo-600 to-purple-700" },
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

  return (
    <div className="space-y-6">

      {/* WELCOME */}
      <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/20 border border-purple-500/20 rounded-2xl p-6">
        <h1 className="text-2xl font-extrabold mb-1">
          Welcome Back! 👋
        </h1>
        <p className="text-gray-400 text-sm mb-4">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <div className="flex items-center justify-between bg-black/20 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400">🪙</span>
            <span className="text-white font-bold">{tokens}</span>
            <span className="text-gray-400 text-sm">tokens remaining</span>
          </div>
          <a href="/dashboard/billing" className="text-purple-400 hover:text-white text-xs font-semibold transition">
            Top Up →
          </a>
        </div>
      </div>

      {/* FREE TRIAL BANNER */}
      {tokens === 25 && (
        <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-purple-300 mb-1">🎁 You have 25 free tokens!</h3>
            <p className="text-gray-400 text-sm">Generate your first 2 AI videos completely free. No credit card needed.</p>
          </div>
          <Link href="/dashboard/studio" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full transition whitespace-nowrap">
            Generate First Video →
          </Link>
        </div>
      )}

      {/* LOW TOKEN WARNING */}
      {tokens <= 10 && tokens < 25 && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-red-300 font-semibold text-sm">⚠️ Low Token Balance — {tokens} tokens left</p>
            <p className="text-gray-400 text-xs">Top up from $5 to continue generating.</p>
          </div>
          <Link href="/dashboard/billing" className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-2 px-4 rounded-full transition">
            Top Up Now
          </Link>
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className={`text-3xl font-extrabold mb-1 ${stat.color}`}>{stat.value}</div>
            <div className="text-white text-sm font-semibold mb-0.5">{stat.label}</div>
            <div className="text-gray-500 text-xs">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* CHARTS ROW */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* WEEKLY USAGE CHART */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="font-bold mb-1">Credits Spent (7 days)</h3>
          <p className="text-gray-500 text-xs mb-6">Successful tasks only</p>
          {weeklyUsage.every(v => v === 0) ? (
            <div className="h-32 flex items-center justify-center text-gray-600 text-sm">
              No activity yet
            </div>
          ) : (
            <div className="flex items-end gap-2 h-32">
              {weeklyUsage.map((val, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-purple-600 rounded-t-lg transition-all"
                    style={{ height: `${(val / maxUsage) * 100}%`, minHeight: val > 0 ? '4px' : '0' }}
                  />
                  <span className="text-gray-600 text-xs">{days[i]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TASK BREAKDOWN */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="font-bold mb-1">Task Breakdown</h3>
          <p className="text-gray-500 text-xs mb-6">Credits used per feature</p>
          <div className="space-y-3">
            {taskBreakdown.map((task, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">{task.label}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: task.credits > 0 ? `${(task.credits / 100) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-gray-500 text-xs w-16 text-right">{task.count} · {task.credits} cr</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div>
        <h2 className="text-lg font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {quickActions.map((action, i) => (
            <Link
              key={i}
              href={action.href}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-purple-500/50 transition group"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center text-xl mb-3`}>
                {action.icon}
              </div>
              <div className="font-bold text-sm mb-1 group-hover:text-purple-400 transition">{action.title}</div>
              <div className="text-gray-500 text-xs leading-relaxed">{action.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* RECENT ACTIVITY */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Recent Activity</h2>
          <Link href="/dashboard/activity" className="text-purple-400 hover:text-white text-sm transition">
            View all →
          </Link>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">🎬</div>
          <p className="text-gray-400 text-sm mb-4">No activity yet. Generate your first AI video to get started!</p>
          <Link href="/dashboard/studio" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full transition inline-block text-sm">
            Start Creating →
          </Link>
        </div>
      </div>

    </div>
  );
}