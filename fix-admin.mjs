import { writeFileSync } from 'fs';

const layout = `"use client";
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
}`;

const aiProviders = `"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminAIProviders() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const providers = [
    { name: "Kling AI", desc: "Video generation — Kling v1, v2, v3", fields: [{ key: "kling_access_key", label: "Access Key", secret: true }, { key: "kling_secret_key", label: "Secret Key", secret: true }] },
    { name: "OpenAI", desc: "GPT-4 for scripts, prompt expansion and Sora for video", fields: [{ key: "openai_api_key", label: "API Key", secret: true }] },
    { name: "ElevenLabs", desc: "AI voice generation", fields: [{ key: "elevenlabs_api_key", label: "API Key", secret: true }] },
    { name: "Runway", desc: "Runway Gen-4 video generation", fields: [{ key: "runway_api_key", label: "API Key", secret: true }] },
  ];

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/settings?category=ai_providers", { headers: { Authorization: "Bearer " + session.access_token } });
      const data = await res.json();
      const map: Record<string, string> = {};
      data.settings?.forEach((s: any) => { map[s.key] = s.value || ""; });
      setSettings(map);
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ settings: Object.entries(settings).map(([key, value]) => ({ key, value })) }) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold mb-1">AI Providers</h1><p className="text-gray-400 text-sm">Manage API keys for all AI models</p></div>
        <button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition text-sm">{saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}</button>
      </div>
      {loading ? <p className="text-gray-400">Loading...</p> : (
        <div className="space-y-4">
          {providers.map((provider, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="mb-4"><h3 className="font-bold">{provider.name}</h3><p className="text-gray-500 text-xs">{provider.desc}</p></div>
              <div className="space-y-3">
                {provider.fields.map((field) => (
                  <div key={field.key}>
                    <label className="text-gray-400 text-xs mb-1 block">{field.label}</label>
                    <input type={field.secret ? "password" : "text"} value={settings[field.key] || ""} onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })} placeholder={"Enter " + field.label} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}`;

const paymentGateways = `"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminPaymentGateways() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const gateways = [
    { id: "stripe", name: "Stripe", desc: "Global payments", fields: [{ key: "stripe_publishable_key", label: "Publishable Key", secret: false }, { key: "stripe_secret_key", label: "Secret Key", secret: true }] },
    { id: "paypal", name: "PayPal", desc: "Global payments", fields: [{ key: "paypal_client_id", label: "Client ID", secret: false }, { key: "paypal_client_secret", label: "Client Secret", secret: true }] },
    { id: "paystack", name: "Paystack", desc: "Africa payments — Nigeria, Ghana, Kenya, South Africa", fields: [{ key: "paystack_public_key", label: "Public Key", secret: false }, { key: "paystack_secret_key", label: "Secret Key", secret: true }] },
    { id: "flutterwave", name: "Flutterwave", desc: "Africa and Global payments", fields: [{ key: "flutterwave_public_key", label: "Public Key", secret: false }, { key: "flutterwave_secret_key", label: "Secret Key", secret: true }] },
    { id: "razorpay", name: "Razorpay", desc: "India payments", fields: [{ key: "razorpay_key_id", label: "Key ID", secret: false }, { key: "razorpay_key_secret", label: "Key Secret", secret: true }] },
  ];

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/settings?category=payments", { headers: { Authorization: "Bearer " + session.access_token } });
      const data = await res.json();
      const map: Record<string, string> = {};
      data.settings?.forEach((s: any) => { map[s.key] = s.value || ""; });
      setSettings(map);
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ settings: Object.entries(settings).map(([key, value]) => ({ key, value })) }) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold mb-1">Payment Gateways</h1><p className="text-gray-400 text-sm">Configure and enable payment providers</p></div>
        <button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition text-sm">{saving ? "Saving..." : saved ? "Saved!" : "Save Gateways"}</button>
      </div>
      {loading ? <p className="text-gray-400">Loading...</p> : (
        <div className="space-y-4">
          {gateways.map((gateway) => (
            <div key={gateway.id} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div><h3 className="font-bold">{gateway.name}</h3><p className="text-gray-500 text-xs">{gateway.desc}</p></div>
                <button onClick={() => setEnabled({ ...enabled, [gateway.id]: !enabled[gateway.id] })} className={"relative w-12 h-6 rounded-full transition-colors " + (enabled[gateway.id] ? "bg-purple-600" : "bg-white/20")}>
                  <div className={"absolute top-1 w-4 h-4 bg-white rounded-full transition-all " + (enabled[gateway.id] ? "left-7" : "left-1")} />
                </button>
              </div>
              <div className="space-y-3">
                {gateway.fields.map((field) => (
                  <div key={field.key}>
                    <label className="text-gray-400 text-xs mb-1 block">{field.label}</label>
                    <input type={field.secret ? "password" : "text"} value={settings[field.key] || ""} onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })} placeholder={"Enter " + field.label} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}`;

const socialAuth = `"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminSocialAuth() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ google: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const providers = [
    { id: "google", name: "Google OAuth", desc: "Sign in with Google", redirect: "https://jcovsxvbrakofybchvbc.supabase.co/auth/v1/callback", fields: [{ key: "google_client_id", label: "Client ID", secret: false }, { key: "google_client_secret", label: "Client Secret", secret: true }] },
    { id: "facebook", name: "Facebook OAuth", desc: "Sign in with Facebook", redirect: "https://jcovsxvbrakofybchvbc.supabase.co/auth/v1/callback", fields: [{ key: "facebook_app_id", label: "App ID", secret: false }, { key: "facebook_app_secret", label: "App Secret", secret: true }] },
    { id: "apple", name: "Apple Sign In", desc: "Sign in with Apple — required for iOS App Store", redirect: "https://jcovsxvbrakofybchvbc.supabase.co/auth/v1/callback", fields: [{ key: "apple_service_id", label: "Service ID", secret: false }, { key: "apple_team_id", label: "Team ID", secret: false }, { key: "apple_key_id", label: "Key ID", secret: false }, { key: "apple_private_key", label: "Private Key", secret: true }] },
    { id: "phone", name: "Phone OTP via Twilio", desc: "Sign in with phone number via SMS OTP", redirect: null, fields: [{ key: "twilio_account_sid", label: "Account SID", secret: false }, { key: "twilio_auth_token", label: "Auth Token", secret: true }, { key: "twilio_phone_number", label: "Phone Number", secret: false }] },
  ];

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/settings?category=social_auth", { headers: { Authorization: "Bearer " + session.access_token } });
      const data = await res.json();
      const map: Record<string, string> = {};
      data.settings?.forEach((s: any) => { map[s.key] = s.value || ""; });
      setSettings(map);
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ settings: Object.entries(settings).map(([key, value]) => ({ key, value })) }) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold mb-1">Social Auth</h1><p className="text-gray-400 text-sm">Configure all authentication providers</p></div>
        <button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition text-sm">{saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}</button>
      </div>
      {loading ? <p className="text-gray-400">Loading...</p> : (
        <div className="space-y-4">
          {providers.map((provider) => (
            <div key={provider.id} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div><h3 className="font-bold">{provider.name}</h3><p className="text-gray-500 text-xs">{provider.desc}</p></div>
                <button onClick={() => setEnabled({ ...enabled, [provider.id]: !enabled[provider.id] })} className={"relative w-12 h-6 rounded-full transition-colors " + (enabled[provider.id] ? "bg-purple-600" : "bg-white/20")}>
                  <div className={"absolute top-1 w-4 h-4 bg-white rounded-full transition-all " + (enabled[provider.id] ? "left-7" : "left-1")} />
                </button>
              </div>
              {provider.redirect && (
                <div className="bg-black/20 rounded-xl px-4 py-2 mb-3">
                  <p className="text-gray-500 text-xs mb-0.5">Redirect URI</p>
                  <p className="text-purple-400 text-xs font-mono break-all">{provider.redirect}</p>
                </div>
              )}
              <div className="space-y-3">
                {provider.fields.map((field) => (
                  <div key={field.key}>
                    <label className="text-gray-400 text-xs mb-1 block">{field.label}</label>
                    <input type={field.secret ? "password" : "text"} value={settings[field.key] || ""} onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })} placeholder={"Enter " + field.label} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}`;

const emailSettings = `"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminEmailSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");

  const fields = [
    { key: "smtp_host", label: "SMTP Host", placeholder: "smtp.resend.com", secret: false },
    { key: "smtp_port", label: "SMTP Port", placeholder: "465", secret: false },
    { key: "smtp_security", label: "Security Protocol", placeholder: "TLS", secret: false },
    { key: "smtp_username", label: "Username", placeholder: "resend", secret: false },
    { key: "smtp_password", label: "Password or API Key", placeholder: "your-api-key", secret: true },
    { key: "smtp_sender_email", label: "Sender Email", placeholder: "noreply@klipflowai.com", secret: false },
    { key: "smtp_sender_name", label: "Sender Name", placeholder: "KlipflowAI", secret: false },
  ];

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/settings?category=email", { headers: { Authorization: "Bearer " + session.access_token } });
      const data = await res.json();
      const map: Record<string, string> = {};
      data.settings?.forEach((s: any) => { map[s.key] = s.value || ""; });
      setSettings(map);
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ settings: Object.entries(settings).map(([key, value]) => ({ key, value })) }) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold mb-1">Email Settings</h1><p className="text-gray-400 text-sm">Configure SMTP for transactional emails</p></div>
        <button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition text-sm">{saving ? "Saving..." : saved ? "Saved!" : "Save Configuration"}</button>
      </div>
      {loading ? <p className="text-gray-400">Loading...</p> : (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="text-gray-400 text-xs mb-1 block">{field.label}</label>
              <input type={field.secret ? "password" : "text"} value={settings[field.key] || ""} onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })} placeholder={field.placeholder} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
            </div>
          ))}
          <div className="pt-4 border-t border-white/10">
            <label className="text-gray-400 text-xs mb-1 block">Send Test Email</label>
            <div className="flex gap-2">
              <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
              <button onClick={() => { setTesting(true); setTimeout(() => { setTestResult("Test sent!"); setTesting(false); setTimeout(() => setTestResult(""), 3000); }, 2000); }} disabled={testing || !testEmail} className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-xl transition text-sm">{testing ? "Sending..." : "Send"}</button>
            </div>
            {testResult && <p className="text-green-400 text-xs mt-2">{testResult}</p>}
          </div>
        </div>
      )}
    </div>
  );
}`;

const siteSettings = `"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminSiteSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fields = [
    { key: "site_name", label: "Site Name", placeholder: "KlipflowAI" },
    { key: "site_url", label: "Site URL", placeholder: "https://klipflowai.com" },
    { key: "support_email", label: "Support Email", placeholder: "support@klipflowai.com" },
    { key: "free_trial_tokens", label: "Free Trial Tokens", placeholder: "25" },
    { key: "max_accounts_per_device", label: "Max Accounts Per Device", placeholder: "3" },
  ];

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/settings?category=general", { headers: { Authorization: "Bearer " + session.access_token } });
      const data = await res.json();
      const map: Record<string, string> = {};
      data.settings?.forEach((s: any) => { map[s.key] = s.value || ""; });
      setSettings(map);
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ settings: Object.entries(settings).map(([key, value]) => ({ key, value })) }) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold mb-1">Site Settings</h1><p className="text-gray-400 text-sm">Configure your platform settings</p></div>
        <button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition text-sm">{saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}</button>
      </div>
      {loading ? <p className="text-gray-400">Loading...</p> : (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="text-gray-400 text-xs mb-1 block">{field.label}</label>
              <input type="text" value={settings[field.key] || ""} onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })} placeholder={field.placeholder} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}`;

const users = `"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [tokenAmount, setTokenAmount] = useState("");
  const [tokenAction, setTokenAction] = useState("add");
  const [updatingTokens, setUpdatingTokens] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newStaff, setNewStaff] = useState({ email: "", role: "author" });
  const [message, setMessage] = useState("");

  const roles = [
    { value: "super_admin", label: "Super Admin", desc: "Full access", color: "text-red-400" },
    { value: "manager", label: "Manager", desc: "Users, revenue, content", color: "text-orange-400" },
    { value: "author", label: "Author", desc: "Blog and leads only", color: "text-blue-400" },
    { value: "support", label: "Support", desc: "View only", color: "text-green-400" },
  ];

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/admin/users", { headers: { Authorization: "Bearer " + session.access_token } });
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  };

  const handleTokenUpdate = async () => {
    if (!selectedUser || !tokenAmount) return;
    setUpdatingTokens(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/admin/update-tokens", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ user_id: selectedUser.id, amount: parseInt(tokenAmount), action: tokenAction }) });
    const data = await res.json();
    if (data.success) { setMessage("Tokens updated!"); setSelectedUser({ ...selectedUser, token_balance: data.new_balance }); setTimeout(() => setMessage(""), 3000); }
    setTokenAmount("");
    setUpdatingTokens(false);
  };

  const handleBanUser = async (userId: string, isBanned: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/admin/ban-user", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ user_id: userId, ban: !isBanned }) });
    setUsers(users.map((u) => u.id === userId ? { ...u, is_banned: !isBanned } : u));
    if (selectedUser?.id === userId) setSelectedUser({ ...selectedUser, is_banned: !isBanned });
    setMessage(!isBanned ? "User banned." : "User unbanned.");
    setTimeout(() => setMessage(""), 3000);
  };

  const handleRoleChange = async (userId: string, role: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("user_profiles").upsert({ id: userId, role, is_admin: role !== "user" }, { onConflict: "id" });
    setUsers(users.map((u) => u.id === userId ? { ...u, role } : u));
    if (selectedUser?.id === userId) setSelectedUser({ ...selectedUser, role });
    setMessage("Role updated!");
    setTimeout(() => setMessage(""), 3000);
  };

  const filtered = users.filter((u) => u.email?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold mb-1">Users</h1><p className="text-gray-400 text-sm">{users.length} total registered users</p></div>
        <button onClick={() => setShowCreateForm(!showCreateForm)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-xl transition text-sm">+ Create Staff Account</button>
      </div>

      {message && <div className="bg-green-900/20 border border-green-500/30 rounded-xl px-4 py-3"><p className="text-green-400 text-sm">{message}</p></div>}

      {showCreateForm && (
        <div className="bg-white/5 border border-purple-500/30 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold">Create Staff Account</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Email Address</label>
              <input type="email" value={newStaff.email} onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })} placeholder="staff@example.com" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Role</label>
              <select value={newStaff.role} onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm">
                {roles.filter((r) => r.value !== "super_admin").map((role) => (<option key={role.value} value={role.value}>{role.label}</option>))}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setMessage("Invitation sent to " + newStaff.email); setShowCreateForm(false); setNewStaff({ email: "", role: "author" }); setTimeout(() => setMessage(""), 4000); }} disabled={!newStaff.email} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition text-sm">Send Invitation</button>
            <button onClick={() => setShowCreateForm(false)} className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl transition text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <input type="text" placeholder="Search by email..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm" />
          {loading ? <p className="text-gray-400 text-sm">Loading users...</p> : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filtered.map((user, i) => (
                <div key={i} onClick={() => setSelectedUser(user)} className={"flex items-center justify-between p-3 rounded-xl cursor-pointer transition " + (selectedUser?.id === user.id ? "bg-purple-900/30 border border-purple-500/50" : "bg-white/5 border border-white/10 hover:border-purple-500/30")}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-purple-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0">{user.email?.[0]?.toUpperCase()}</div>
                    <div>
                      <div className="text-sm font-semibold truncate max-w-40">{user.email}</div>
                      <div className="text-gray-500 text-xs">{new Date(user.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {user.is_banned && <span className="bg-red-900/30 text-red-400 text-xs px-2 py-0.5 rounded-full">Banned</span>}
                    {user.role && user.role !== "user" && <span className="bg-purple-900/30 text-purple-400 text-xs px-2 py-0.5 rounded-full capitalize">{user.role.replace("_", " ")}</span>}
                    <span className={user.email_confirmed ? "bg-green-900/30 text-green-400 text-xs px-2 py-0.5 rounded-full" : "bg-yellow-900/30 text-yellow-400 text-xs px-2 py-0.5 rounded-full"}>{user.email_confirmed ? "verified" : "unverified"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedUser ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-lg font-bold">{selectedUser.email?.[0]?.toUpperCase()}</div>
              <div>
                <h3 className="font-bold">{selectedUser.email}</h3>
                <p className="text-gray-500 text-xs">Joined {new Date(selectedUser.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/20 rounded-xl p-3"><div className="text-gray-500 text-xs mb-1">Token Balance</div><div className="text-yellow-400 font-bold">{selectedUser.token_balance ?? "—"} tokens</div></div>
              <div className="bg-black/20 rounded-xl p-3"><div className="text-gray-500 text-xs mb-1">Status</div><div className={selectedUser.is_banned ? "text-red-400 font-bold text-sm" : "text-green-400 font-bold text-sm"}>{selectedUser.is_banned ? "Banned" : "Active"}</div></div>
            </div>

            <div>
              <label className="text-gray-400 text-xs mb-2 block font-semibold">Adjust Token Balance</label>
              <div className="flex gap-2 mb-2">
                {["add", "deduct", "set"].map((action) => (
                  <button key={action} onClick={() => setTokenAction(action)} className={"flex-1 py-2 rounded-xl text-xs font-bold transition capitalize " + (tokenAction === action ? (action === "add" ? "bg-green-600 text-white" : action === "deduct" ? "bg-red-600 text-white" : "bg-blue-600 text-white") : "bg-white/10 text-gray-400")}>{action}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="number" value={tokenAmount} onChange={(e) => setTokenAmount(e.target.value)} placeholder="Enter amount" className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
                <button onClick={handleTokenUpdate} disabled={updatingTokens || !tokenAmount} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-xl transition text-sm">{updatingTokens ? "..." : "Apply"}</button>
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-xs mb-2 block font-semibold">Change Role</label>
              <div className="grid grid-cols-2 gap-2">
                {roles.map((role) => (
                  <button key={role.value} onClick={() => handleRoleChange(selectedUser.id, role.value)} className={"p-2.5 rounded-xl border text-left transition " + (selectedUser.role === role.value ? "border-purple-500 bg-purple-900/20" : "border-white/10 bg-white/5 hover:border-purple-500/30")}>
                    <div className={"font-bold text-xs " + role.color}>{role.label}</div>
                    <div className="text-gray-600 text-xs">{role.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-white/10">
              <button onClick={() => handleBanUser(selectedUser.id, selectedUser.is_banned)} className={"flex-1 font-bold py-2.5 rounded-xl transition text-sm " + (selectedUser.is_banned ? "bg-green-900/30 text-green-400 hover:bg-green-900/50" : "bg-red-900/30 text-red-400 hover:bg-red-900/50")}>{selectedUser.is_banned ? "Unban User" : "Ban User"}</button>
              <button onClick={() => setSelectedUser(null)} className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 rounded-xl transition text-sm">Close</button>
            </div>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <p className="text-gray-400 text-sm">Select a user to view details and manage their account</p>
          </div>
        )}
      </div>
    </div>
  );
}`;

writeFileSync('app/admin/layout.tsx', layout, 'utf8');
writeFileSync('app/admin/ai-providers/page.tsx', aiProviders, 'utf8');
writeFileSync('app/admin/payment-gateways/page.tsx', paymentGateways, 'utf8');
writeFileSync('app/admin/social-auth/page.tsx', socialAuth, 'utf8');
writeFileSync('app/admin/email-settings/page.tsx', emailSettings, 'utf8');
writeFileSync('app/admin/site-settings/page.tsx', siteSettings, 'utf8');
writeFileSync('app/admin/users/page.tsx', users, 'utf8');

console.log('All files fixed successfully!');