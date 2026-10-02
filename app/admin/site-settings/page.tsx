"use client";
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
        <div><h1 className="text-2xl font-semibold tracking-tight mb-1">Site Settings</h1><p className="text-ink-muted text-sm">Configure your platform settings</p></div>
        <button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 px-6 rounded-xl transition text-sm">{saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}</button>
      </div>
      {loading ? <p className="text-ink-muted">Loading...</p> : (
        <div className="bg-surface border border-line rounded-2xl p-6 space-y-4">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="text-ink-muted text-xs mb-1 block">{field.label}</label>
              <input type="text" value={settings[field.key] || ""} onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })} placeholder={field.placeholder} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-4 py-2.5 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}