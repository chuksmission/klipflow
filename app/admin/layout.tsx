"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
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

  const navSections = [
    { title: "Main", items: [
      { href: "/admin", label: "Overview" },
      { href: "/admin/users", label: "Users" },
      { href: "/admin/revenue", label: "Revenue and Orders" },
      { href: "/admin/generations", label: "Generations" },
    ]},
    { title: "AI and Automation", items: [
      { href: "/admin/ai-providers", label: "AI Providers" },
      { href: "/admin/prompt-templates", label: "Prompt Templates" },
      { href: "/admin/video-templates", label: "Video Templates" },
      { href: "/admin/token-pricing", label: "Token Pricing" },
    ]},
    { title: "Monetization", items: [
      { href: "/admin/plans", label: "Plans" },
      { href: "/admin/payment-gateways", label: "Payment Gateways" },
      { href: "/admin/orders", label: "Orders" },
    ]},
    { title: "Auth and Integrations", items: [
      { href: "/admin/social-auth", label: "Social Auth" },
      { href: "/admin/integrations", label: "Platform Integrations" },
    ]},
    { title: "Appearance", items: [
      { href: "/admin/site-settings", label: "Site Settings" },
      { href: "/admin/announcements", label: "Announcements" },
    ]},
    { title: "Content", items: [
      { href: "/admin/blog", label: "Blog CMS" },
      { href: "/admin/leads", label: "Leads" },
    ]},
    { title: "Communications", items: [
      { href: "/admin/email-settings", label: "Email Settings" },
      { href: "/admin/email-templates", label: "Email Templates" },
    ]},
    { title: "Security", items: [
      { href: "/admin/abuse-control", label: "Abuse Control" },
    ]},
  ];

  const allItems = navSections.flatMap((s) => s.items);
  const filteredSections = search
    ? [{ title: "Results", items: allItems.filter((i) => i.label.toLowerCase().includes(search.toLowerCase())) }]
    : navSections;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex overflow-x-hidden">
      <aside className="hidden md:flex flex-col w-64 border-r border-white/10 fixed h-full bg-gray-950 overflow-y-auto">
        <div className="p-4 border-b border-white/10">
          <Link href="/admin" className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">KlipflowAI</Link>
          <div className="text-xs text-gray-500 mt-0.5">Admin Panel</div>
        </div>
        <div className="px-3 py-3 border-b border-white/10">
          <input type="text" placeholder="Search menu..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition" />
        </div>
        <nav className="flex-1 px-3 py-3 space-y-4">
          {filteredSections.map((section) => (
            <div key={section.title}>
              <div className="text-gray-600 text-xs font-bold uppercase tracking-wider px-3 mb-1">{section.title}</div>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <Link key={item.href} href={item.href} className={"flex items-center px-3 py-2 rounded-xl text-xs font-semibold transition " + (pathname === item.href ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white hover:bg-white/5")}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <Link href="/dashboard" className="block text-gray-500 hover:text-white text-xs transition mb-2">Back to Dashboard</Link>
          <button onClick={handleSignOut} className="text-red-400 hover:text-red-300 text-xs transition font-semibold">Sign Out</button>
        </div>
      </aside>

      <div className="flex-1 md:ml-64 flex flex-col min-w-0 overflow-x-hidden">
        <header className="sticky top-0 z-40 bg-gray-950 border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <div className="hidden md:block text-gray-400 text-xs">
            Admin <span className="text-gray-600 mx-1">›</span>
            <span className="text-white capitalize">{pathname.split("/").pop()?.replace(/-/g, " ") || "Overview"}</span>
          </div>
          <Link href="/admin" className="md:hidden text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">KlipflowAI Admin</Link>
          <div className="flex items-center gap-3">
            <div className="bg-red-900/30 border border-red-500/30 text-red-300 text-xs font-bold px-3 py-1 rounded-full">Admin</div>
            <Link href="/dashboard" className="text-gray-500 hover:text-white text-xs transition">Dashboard</Link>
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden w-9 h-9 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">{menuOpen ? "X" : "="}</button>
          </div>
        </header>

        {menuOpen && (
          <div className="md:hidden fixed inset-0 z-30 bg-gray-950 pt-16 px-4 overflow-y-auto">
            <input type="text" placeholder="Search menu..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 mb-4" />
            <nav className="space-y-4">
              {filteredSections.map((section) => (
                <div key={section.title}>
                  <div className="text-gray-600 text-xs font-bold uppercase tracking-wider px-3 mb-1">{section.title}</div>
                  <div className="space-y-0.5">
                    {section.items.map((item) => (
                      <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={"flex items-center px-3 py-2.5 rounded-xl text-sm font-semibold transition " + (pathname === item.href ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white hover:bg-white/5")}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
            <div className="mt-6 space-y-2">
              <Link href="/dashboard" className="block text-gray-500 text-sm">Back to Dashboard</Link>
              <button onClick={handleSignOut} className="text-red-400 text-sm">Sign Out</button>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6 overflow-x-hidden w-full min-w-0">{children}</main>
      </div>
    </div>
  );
}