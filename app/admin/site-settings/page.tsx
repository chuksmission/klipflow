"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { SOCIAL_PLATFORMS, cleanSocialUrl } from "../../lib/social-links";
import SocialIcon from "../../components/home/SocialIcon";

const inputClass = "w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-4 py-2.5 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm";

export default function AdminSiteSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

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
      (data.settings as { key: string; value: string | null }[] | undefined)?.forEach((s) => { map[s.key] = s.value || ""; });
      setSettings(map);
      setLoading(false);
    };
    fetchSettings();
  }, []);

  // A social URL is either empty (icon hidden) or a full http(s) link
  const badSocial = SOCIAL_PLATFORMS.filter((p) => (settings[p.key] ?? "").trim() && !cleanSocialUrl(settings[p.key]));

  const handleSave = async () => {
    if (badSocial.length) { setError(`Check the ${badSocial.map((p) => p.label).join(", ")} link: use a full URL starting with https://`); return; }
    setError("");
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaving(false); return; }
    const keys = [...fields.map((f) => f.key), ...SOCIAL_PLATFORMS.map((p) => p.key)];
    const payload = keys.filter((key) => key in settings).map((key) => ({
      key,
      value: key.startsWith("social_") ? (cleanSocialUrl(settings[key]) ?? "") : settings[key],
      category: "general",
    }));
    const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ settings: payload }) });
    setSaving(false);
    if (!res.ok) { setError("Couldn't save. Please try again."); return; }
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
        <>
          <div className="bg-surface border border-line rounded-2xl p-6 space-y-4">
            {fields.map((field) => (
              <div key={field.key}>
                <label htmlFor={field.key} className="text-ink-muted text-xs mb-1 block">{field.label}</label>
                <input id={field.key} type="text" value={settings[field.key] || ""} onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })} placeholder={field.placeholder} className={inputClass} />
              </div>
            ))}
          </div>

          <div className="bg-surface border border-line rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="font-semibold">Social media</h2>
              <p className="text-ink-muted text-sm mt-0.5">Shown as icons in the homepage footer. Leave a field empty to hide that icon.</p>
            </div>
            {SOCIAL_PLATFORMS.map((p) => {
              const value = settings[p.key] || "";
              const invalid = value.trim() !== "" && !cleanSocialUrl(value);
              return (
                <div key={p.key}>
                  <label htmlFor={p.key} className="text-ink-muted text-xs mb-1 block">
                    {p.label} URL{"optional" in p && p.optional ? <span className="text-ink-subtle"> (optional, for future use)</span> : null}
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-canvas text-ink-muted" aria-hidden>
                      <SocialIcon id={p.id} size={17} />
                    </span>
                    <input id={p.key} type="url" inputMode="url" value={value} onChange={(e) => setSettings({ ...settings, [p.key]: e.target.value })}
                      placeholder={p.placeholder} aria-invalid={invalid} className={`${inputClass} ${invalid ? "border-red-500/70" : ""}`} />
                  </div>
                  {invalid && <p className="mt-1 text-xs text-red-400">Use a full link starting with https://</p>}
                </div>
              );
            })}
          </div>

          {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
          <div className="flex justify-end">
            <button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 px-6 rounded-xl transition text-sm">{saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}</button>
          </div>
        </>
      )}
    </div>
  );
}
