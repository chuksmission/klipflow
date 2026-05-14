"use client";
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
}