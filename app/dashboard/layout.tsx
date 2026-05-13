'use client';
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [tokens, setTokens] = useState(25);
  const [plan, setPlan] = useState('Trial');
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [notifications] = useState(2);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);
    };
    getUser();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const navItems = [
    { href: '/dashboard', icon: '📊', label: 'Dashboard' },
    { href: '/dashboard/studio', icon: '🎬', label: 'Video Studio' },
    { href: '/dashboard/ad-spy', icon: '🕵️', label: 'Ad Spy' },
    { href: '/dashboard/autopilot', icon: '🤖', label: 'Autopilot' },
    { href: '/dashboard/gallery', icon: '🖼️', label: 'Gallery' },
    { href: '/dashboard/activity', icon: '⚡', label: 'Activity' },
    { href: '/dashboard/billing', icon: '💳', label: 'Billing' },
    { href: '/dashboard/settings', icon: '⚙️', label: 'Settings' },
    { href: '/dashboard/help', icon: '❓', label: 'Help' },
  ];

  const filteredNav = navItems.filter(item =>
    item.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">

      {/* SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/10 fixed h-full bg-gray-950">

        {/* LOGO */}
        <div className="p-6 border-b border-white/10">
          <Link href="/" className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            KlipflowAI
          </Link>
        </div>

        {/* SEARCH */}
        <div className="px-4 py-3 border-b border-white/10">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Search menu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition"
            />
          </div>
        </div>

        {/* NAV */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                pathname === item.href
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* BOTTOM */}
        <div className="p-4 border-t border-white/10">
          <div className="text-gray-500 text-xs mb-1 truncate">{user?.email}</div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 text-xs transition font-semibold"
          >
            <span>🚪</span> Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 md:ml-64 flex flex-col">

        {/* TOP HEADER */}
        <header className="sticky top-0 z-40 bg-gray-950 border-b border-white/10 px-4 py-3 flex items-center justify-between">
          {/* MOBILE LOGO */}
          <Link href="/" className="md:hidden text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            KlipflowAI
          </Link>

          {/* BREADCRUMB */}
          <div className="hidden md:block text-gray-400 text-sm">
            Dashboard <span className="text-gray-600 mx-2">›</span>
            <span className="text-white capitalize">{pathname.split('/').pop()}</span>
          </div>

          {/* RIGHT SIDE */}
          <div className="flex items-center gap-3">
            {/* PLAN BADGE */}
            <div className="bg-purple-900/40 border border-purple-500/30 text-purple-300 text-xs font-bold px-3 py-1 rounded-full">
              {plan}
            </div>

            {/* TOKEN BALANCE */}
            <div className="bg-white/5 border border-white/10 rounded-full px-4 py-1.5 flex items-center gap-2">
              <span className="text-yellow-400 text-sm">🪙</span>
              <span className="text-white font-bold text-sm">{tokens.toLocaleString()}</span>
              <span className="text-gray-500 text-xs">tokens</span>
            </div>

            {/* NOTIFICATIONS */}
            <button className="relative w-9 h-9 bg-white/5 border border-white/10 rounded-full flex items-center justify-center hover:bg-white/10 transition">
              <span className="text-sm">🔔</span>
              {notifications > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold">
                  {notifications}
                </span>
              )}
            </button>

            {/* SETTINGS */}
            <Link href="/dashboard/settings" className="w-9 h-9 bg-white/5 border border-white/10 rounded-full flex items-center justify-center hover:bg-white/10 transition">
              <span className="text-sm">⚙️</span>
            </Link>

            {/* MOBILE MENU */}
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden w-9 h-9 bg-white/5 border border-white/10 rounded-full flex items-center justify-center">
              <span>{menuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        </header>

        {/* MOBILE MENU */}
        {menuOpen && (
          <div className="md:hidden fixed inset-0 z-30 bg-gray-950 pt-20 px-4 overflow-y-auto">
            <div className="relative mb-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
              <input
                type="text"
                placeholder="Search menu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
              />
            </div>
            <nav className="space-y-1">
              {filteredNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                    pathname === item.href
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
            <button onClick={handleSignOut} className="mt-6 flex items-center gap-2 text-gray-500 hover:text-white text-sm transition">
              <span>🚪</span> Sign Out
            </button>
          </div>
        )}

        {/* PAGE CONTENT */}
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}