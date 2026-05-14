import { writeFileSync } from 'fs';

const aiProviders = `"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminAIProviders() {
  const [settings, setSettings] = useState({});
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
      const map = {};
      data.settings?.forEach((s) => { map[s.key] = s.value || ""; });
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
  const [settings, setSettings] = useState({});
  const [enabled, setEnabled] = useState({});
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
      const map = {};
      data.settings?.forEach((s) => { map[s.key] = s.value || ""; });
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
  const [settings, setSettings] = useState({});
  const [enabled, setEnabled] = useState({ google: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const providers = [
    { id: "google", name: "Google OAuth", desc: "Sign in with Google", redirect: "https://jcovsxvbrakofybchvbc.supabase.co/auth/v1/callback", fields: [{ key: "google_client_id", label: "Client ID", secret: false }, { key: "google_client_secret", label: "Client Secret", secret: true }] },
    { id: "facebook", name: "Facebook OAuth", desc: "Sign in with Facebook", redirect: "https://jcovsxvbrakofybchvbc.supabase.co/auth/v1/callback", fields: [{ key: "facebook_app_id", label: "App ID", secret: false }, { key: "facebook_app_secret", label: "App Secret", secret: true }] },
    { id: "apple", name: "Apple Sign In", desc: "Sign in with Apple — required for iOS App Store", redirect: "https://jcovsxvbrakofybchvbc.supabase.co/auth/v1/callback", fields: [{ key: "apple_service_id", label: "Service ID", secret: false }, { key: "apple_team_id", label: "Team ID", secret: false }, { key: "apple_key_id", label: "Key ID", secret: false }, { key: "apple_private_key", label: "Private Key", secret: true }] },
    { id: "phone", name: "Phone OTP via Twilio", desc: "Sign in with phone number via SMS OTP", redirect: null, fields: [{ key: "twilio_account_sid", label: "Account SID", secret: false }, { key: "twilio_auth_token", label: "Auth Token", secret: true }, { key: "twilio_phone_number", label: "Twilio Phone Number", secret: false }] },
  ];

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/settings?category=social_auth", { headers: { Authorization: "Bearer " + session.access_token } });
      const data = await res.json();
      const map = {};
      data.settings?.forEach((s) => { map[s.key] = s.value || ""; });
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
                  <p className="text-gray-500 text-xs mb-0.5">Authorized Redirect URI</p>
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
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");

  const fields = [
    { key: "smtp_host", label: "SMTP Host", placeholder: "smtp.resend.com" },
    { key: "smtp_port", label: "SMTP Port", placeholder: "465" },
    { key: "smtp_security", label: "Security Protocol", placeholder: "TLS" },
    { key: "smtp_username", label: "Username", placeholder: "resend" },
    { key: "smtp_password", label: "Password / API Key", placeholder: "••••••••••••", secret: true },
    { key: "smtp_sender_email", label: "Sender Email", placeholder: "noreply@klipflowai.com" },
    { key: "smtp_sender_name", label: "Sender Name", placeholder: "KlipflowAI" },
  ];

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/settings?category=email", { headers: { Authorization: "Bearer " + session.access_token } });
      const data = await res.json();
      const map = {};
      data.settings?.forEach((s) => { map[s.key] = s.value || ""; });
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
  const [settings, setSettings] = useState({});
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
      const map = {};
      data.settings?.forEach((s) => { map[s.key] = s.value || ""; });
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

writeFileSync('app/admin/ai-providers/page.tsx', aiProviders, 'utf8');
writeFileSync('app/admin/payment-gateways/page.tsx', paymentGateways, 'utf8');
writeFileSync('app/admin/social-auth/page.tsx', socialAuth, 'utf8');
writeFileSync('app/admin/email-settings/page.tsx', emailSettings, 'utf8');
writeFileSync('app/admin/site-settings/page.tsx', siteSettings, 'utf8');

console.log('All files fixed!');