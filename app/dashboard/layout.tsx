'use client';
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [plan, setPlan] = useState('Trial');
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showBell, setShowBell] = useState(false);
  const [readIds, setReadIds] = useState<number[]>([]);
  const bellRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUser(session.user);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('is_banned, plan, subscription_status')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile?.is_banned) {
        await supabase.auth.signOut();
        router.push('/login');
        return;
      }

      if (profile?.plan && profile.plan !== 'trial') {
        setPlan(profile.plan);
      } else if (profile?.subscription_status === 'active') {
        setPlan('Active');
      }
    };

    const fetchNotifications = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('created_at', { ascending: false })
        .limit(10);
      setNotifications(data || []);

      // Load read IDs from localStorage
      const stored = localStorage.getItem('klipflow_read_notifications');
      if (stored) setReadIds(JSON.parse(stored));
    };

    getUser();
    fetchNotifications();
  }, []);

  // Close bell dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowBell(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markAsRead = (id: number) => {
    const updated = [...new Set([...readIds, id])];
    setReadIds(updated);
    localStorage.setItem('klipflow_read_notifications', JSON.stringify(updated));
  };

  const markAllRead = () => {
    const allIds = notifications.map(n => n.id);
    setReadIds(allIds);
    localStorage.setItem('klipflow_read_notifications', JSON.stringify(allIds));
  };

  const unreadCount = notifications.filter(n => !readIds.includes(n.id)).length;

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
  ];

  const filteredNav = navItems.filter(item =>
    item.label.toLowerCase().includes(search.toLowerCase())
  );

  const getBadgeColor = (color: string) => {
    const map: Record<string, string> = {
      purple: 'bg-purple-900/40 border-purple-500/30 text-purple-300',
      blue: 'bg-blue-900/40 border-blue-500/30 text-blue-300',
      green: 'bg-green-900/40 border-green-500/30 text-green-300',
      red: 'bg-red-900/40 border-red-500/30 text-red-300',
      yellow: 'bg-yellow-900/40 border-yellow-500/30 text-yellow-300',
    };
    return map[color] ?? map.purple;
  };

  return (
    <div className="flex min-h-screen bg-gray-950 text-white">

      {/* SIDEBAR */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-gray-950 border-r border-white/10 z-50">
        <div className="p-6 border-b border-white/10">
          <Link href="/dashboard" className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            KlipflowAI
          </Link>
        </div>

        <div className="px-4 pt-4">
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
      <div className="flex-1 md:ml-64 flex flex-col min-w-0 overflow-x-hidden">

        {/* TOP HEADER */}
        <header className="sticky top-0 z-40 bg-gray-950 border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="md:hidden text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            KlipflowAI
          </Link>

          <div className="hidden md:block text-gray-400 text-sm">
            Dashboard <span className="text-gray-600 mx-2">›</span>
            <span className="text-white capitalize">{pathname.split('/').pop()}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-purple-900/40 border border-purple-500/30 text-purple-300 text-xs font-bold px-3 py-1 rounded-full capitalize">
              {plan}
            </div>

            {/* NOTIFICATION BELL */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setShowBell(!showBell)}
                className="relative w-9 h-9 bg-white/5 border border-white/10 rounded-full flex items-center justify-center hover:bg-white/10 transition"
              >
                <span className="text-sm">🔔</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* DROPDOWN */}
              {showBell && (
                <div className="absolute right-0 top-11 w-80 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <h3 className="font-bold text-sm">Notifications</h3>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-purple-400 hover:text-white text-xs transition">
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-gray-500 text-sm">
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => markAsRead(n.id)}
                          className={"px-4 py-3 border-b border-white/5 cursor-pointer hover:bg-white/5 transition " + (!readIds.includes(n.id) ? "bg-white/3" : "")}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${!readIds.includes(n.id) ? 'bg-purple-400' : 'bg-transparent'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getBadgeColor(n.color)}`}>
                                  {n.title}
                                </span>
                              </div>
                              <p className="text-gray-300 text-xs leading-relaxed">{n.message}</p>
                              <p className="text-gray-600 text-xs mt-1">
                                {new Date(n.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {notifications.length > 0 && (
                    <div className="px-4 py-2 text-center border-t border-white/10">
                      <p className="text-gray-600 text-xs">{notifications.length} total notifications</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Link href="/dashboard/settings" className="w-9 h-9 bg-white/5 border border-white/10 rounded-full flex items-center justify-center hover:bg-white/10 transition">
              <span className="text-sm">⚙️</span>
            </Link>

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
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden w-full min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
