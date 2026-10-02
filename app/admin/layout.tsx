"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft, ChartLine, Clapperboard, Coins, Cpu, CreditCard, FileText, Film, Inbox, KeyRound, LayoutDashboard, Loader2, LogOut, Mail, MailOpen, Megaphone, Menu, Newspaper, Package, Plug, Receipt, Repeat2, Search, Settings2, ShieldAlert, ShieldCheck, Sparkles, Users, WandSparkles, X, type LucideIcon } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .single();
      if (!profile?.is_admin) { router.push("/dashboard"); return; }
      setIsAdmin(true);
      setLoading(false);
    };
    checkAdmin();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const navSections: { title: string; items: { href: string; label: string; icon: LucideIcon }[] }[] = [
    { title: "Main", items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard },
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/revenue", label: "Revenue and Orders", icon: ChartLine },
      { href: "/admin/generations", label: "Generations", icon: Clapperboard },
    ]},
    { title: "AI and Automation", items: [
      { href: "/admin/ai-providers", label: "AI Providers", icon: Cpu },
      { href: "/admin/showcase-studio", label: "Showcase Studio", icon: WandSparkles },
      { href: "/admin/ad-remix", label: "Ad Remix", icon: Repeat2 },
      { href: "/admin/prompt-templates", label: "Prompt Templates", icon: FileText },
      { href: "/admin/video-templates", label: "Video Templates", icon: Film },
      { href: "/admin/token-pricing", label: "Token Pricing", icon: Coins },
    ]},
    { title: "Monetization", items: [
      { href: "/admin/plans", label: "Plans", icon: Package },
      { href: "/admin/payment-gateways", label: "Payment Gateways", icon: CreditCard },
      { href: "/admin/orders", label: "Orders", icon: Receipt },
    ]},
    { title: "Auth and Integrations", items: [
      { href: "/admin/social-auth", label: "Social Auth", icon: KeyRound },
      { href: "/admin/integrations", label: "Platform Integrations", icon: Plug },
    ]},
    { title: "Appearance", items: [
      { href: "/admin/site-settings", label: "Site Settings", icon: Settings2 },
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
    ]},
    { title: "Content", items: [
      { href: "/admin/blog", label: "Blog CMS", icon: Newspaper },
      { href: "/admin/leads", label: "Leads", icon: Inbox },
    ]},
    { title: "Communications", items: [
      { href: "/admin/email-settings", label: "Email Settings", icon: Mail },
      { href: "/admin/email-templates", label: "Email Templates", icon: MailOpen },
    ]},
    { title: "Security", items: [
      { href: "/admin/abuse-control", label: "Abuse Control", icon: ShieldAlert },
    ]},
  ];

  const allItems = navSections.flatMap((s) => s.items);
  const filteredSections = search
    ? [{ title: "Results", items: allItems.filter((i) => i.label.toLowerCase().includes(search.toLowerCase())) }]
    : navSections;
  const currentItem = allItems.find((i) => i.href === pathname);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-ink">
        <div className="flex items-center gap-3 text-sm text-ink-muted">
          <Loader2 size={18} className="animate-spin text-accent-text" aria-hidden /> Verifying admin access…
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/admin" onClick={onNavigate} className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-white"><Sparkles size={16} aria-hidden /></span>
          <span className="text-[17px] font-semibold tracking-tight">KlipflowAI</span>
        </Link>
        <span className="rounded-md border border-line bg-raised px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">Admin</span>
      </div>
      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <input type="text" placeholder="Search settings…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search admin menu"
            className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25" />
        </div>
      </div>
      <nav className="no-scrollbar flex-1 overflow-y-auto px-3 pb-4" aria-label="Admin">
        {filteredSections.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-2 pt-5 text-xs font-medium text-ink-subtle">{section.title}</p>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
                  className={"flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors " + (active ? "bg-white/[0.08] text-ink" : "text-ink-muted hover:bg-white/[0.04] hover:text-ink")}>
                  <Icon size={17} className={active ? "text-accent-text" : ""} aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
        {search && filteredSections[0].items.length === 0 && <p className="px-3 pt-4 text-sm text-ink-subtle">No matches</p>}
      </nav>
      <div className="space-y-1 border-t border-line p-3">
        <Link href="/dashboard" onClick={onNavigate} className="flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-ink-muted transition-colors hover:bg-white/[0.04] hover:text-ink">
          <ArrowLeft size={17} aria-hidden /> Back to app
        </Link>
        <button onClick={handleSignOut} className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-ink-muted transition-colors hover:bg-white/[0.04] hover:text-ink">
          <LogOut size={17} aria-hidden /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-canvas text-ink">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 border-r border-line bg-canvas lg:block">
        {sidebar()}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden lg:ml-64">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md md:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="grid h-10 w-10 place-items-center rounded-lg text-ink-muted hover:bg-white/5 hover:text-ink lg:hidden">
              <Menu size={20} aria-hidden />
            </button>
            <h1 className="truncate text-[15px] font-medium">{currentItem?.label ?? (pathname.split("/").pop()?.replace(/-/g, " ") || "Overview")}</h1>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-muted">
            <ShieldCheck size={13} className="text-accent-text" aria-hidden /> Admin
          </span>
        </header>

        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] border-r border-line bg-canvas">
              <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 z-10 grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-white/5 hover:text-ink">
                <X size={20} aria-hidden />
              </button>
              {sidebar(() => setMenuOpen(false))}
            </div>
          </div>
        )}

        <main className="w-full min-w-0 flex-1 overflow-x-hidden p-4 md:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
