"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminIntegrations() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const integrations = [
    {
      name: "Ayrshare",
      desc: "Auto-posting to TikTok, Instagram, YouTube, Facebook and X",
      docs: "https://www.ayrshare.com/",
      fields: [
        { key: "ayrshare_api_key", label: "API Key", secret: true },
      ],
    },
    {
      name: "Meta Ads Library",
      desc: "Facebook Ad Spy - search winning ads via Meta Ads Library API",
      docs: "https://developers.facebook.com/docs/marketing-api/reference/ads-archive/",
      fields: [
        { key: "meta_ads_api_token", label: "Access Token", secret: true },
      ],
    },
    {
      name: "Meta Ads Manager",
      desc: "One-click ad launcher - launch campaigns directly to Facebook Ads",
      docs: "https://developers.facebook.com/docs/marketing-apis/",
      fields: [
        { key: "meta_ads_manager_token", label: "Access Token", secret: true },
        { key: "meta_ads_account_id", label: "Ad Account ID", secret: false },
      ],
    },
  ];

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/settings?category=integrations", {
        headers: { Authorization: "Bearer " + session.access_token },
      });
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
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
      body: JSON.stringify({ settings: Object.entries(settings).map(([key, value]) => ({ key, value })) }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold mb-1">Platform Integrations</h1>
          <p className="text-gray-400 text-sm">Configure third-party platform connections</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition text-sm"
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : (
        <div className="space-y-4">
          {integrations.map((integration, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold">{integration.name}</h3>
                  <p className="text-gray-500 text-xs">{integration.desc}</p>
                </div>
                <button
                  onClick={() => window.open(integration.docs, "_blank")}
                  className="text-purple-400 hover:text-white text-xs transition shrink-0 ml-4"
                >
                  View Docs
                </button>
              </div>
              <div className="space-y-3">
                {integration.fields.map((field) => (
                  <div key={field.key}>
                    <label className="text-gray-400 text-xs mb-1 block">{field.label}</label>
                    <input
                      type={field.secret ? "password" : "text"}
                      value={settings[field.key] || ""}
                      onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                      placeholder={"Enter " + field.label}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm"
                    />
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
