'use client';
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Bell, Menu, Settings, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import AppSidebar from "../components/AppSidebar";
import { hasPendingGeneration } from "../components/catalog";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [plan, setPlan] = useState('Trial');
  const [menuOpen, setMenuOpen] = useState(false);
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

      // Prompt or template picked on the homepage before signing up
      if (hasPendingGeneration() && window.location.pathname !== '/dashboard/studio') {
        router.push('/dashboard/studio');
      }

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

  const getBadgeColor = (color: string) => {
    const map: Record<string, string> = {
      purple: 'bg-accent/12 border-accent/25 text-accent-text',
      blue: 'bg-sky-500/10 border-sky-500/25 text-sky-300',
      green: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
      red: 'bg-red-500/10 border-red-500/25 text-red-300',
      yellow: 'bg-amber-500/10 border-amber-500/25 text-amber-300',
    };
    return map[color] ?? map.purple;
  };

  const section = pathname.split('/').pop() ?? '';
  const pageTitle = section === 'dashboard' ? 'Overview' : section === 'studio' ? 'Studio' : section.replace(/-/g, ' ');

  return (
    <div className="flex min-h-screen bg-canvas text-ink">

      {/* SIDEBAR */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 border-r border-line bg-canvas z-50">
        <AppSidebar loggedIn email={user?.email} onSignOut={handleSignOut} />
      </aside>

      {/* MAIN */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0 overflow-x-hidden">

        {/* TOP HEADER */}
        <header className="sticky top-0 z-40 h-16 bg-canvas/85 backdrop-blur-md border-b border-line px-4 md:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="lg:hidden grid h-10 w-10 place-items-center rounded-lg text-ink-muted hover:bg-surface hover:text-ink">
              <Menu size={20} aria-hidden />
            </button>
            <h1 className="text-[15px] font-medium text-ink capitalize truncate">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent-text capitalize">
              {plan}
            </span>

            {/* NOTIFICATION BELL */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setShowBell(!showBell)}
                aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                className="relative grid h-10 w-10 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface hover:text-ink"
              >
                <Bell size={19} aria-hidden />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* DROPDOWN */}
              {showBell && (
                <div className="absolute right-0 top-12 w-80 max-w-[calc(100vw-2rem)] bg-surface border border-line rounded-2xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                    <h3 className="font-medium text-sm">Notifications</h3>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-accent-text hover:text-ink text-xs transition-colors">
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-ink-subtle text-sm">
                        You&apos;re all caught up
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => markAsRead(n.id)}
                          className={"px-4 py-3 border-b border-line/60 cursor-pointer hover:bg-white/[0.03] transition-colors " + (!readIds.includes(n.id) ? "bg-white/[0.02]" : "")}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${!readIds.includes(n.id) ? 'bg-accent-text' : 'bg-transparent'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${getBadgeColor(n.color)}`}>
                                  {n.title}
                                </span>
                              </div>
                              <p className="text-ink-muted text-xs leading-relaxed">{n.message}</p>
                              <p className="text-ink-subtle text-xs mt-1">
                                {new Date(n.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <Link href="/dashboard/settings" aria-label="Settings" className="grid h-10 w-10 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface hover:text-ink">
              <Settings size={19} aria-hidden />
            </Link>
          </div>
        </header>

        {/* MOBILE MENU */}
        {menuOpen && (
          <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] border-r border-line bg-canvas">
              <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-surface hover:text-ink z-10">
                <X size={20} aria-hidden />
              </button>
              <AppSidebar loggedIn email={user?.email} onSignOut={handleSignOut} onNavigate={() => setMenuOpen(false)} />
            </div>
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
