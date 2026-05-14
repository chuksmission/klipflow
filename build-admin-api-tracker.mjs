import { writeFileSync } from 'fs';

writeFileSync('app/admin/ai-providers/page.tsx', `"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

const API_COSTS = {
  "kling-v1": 0.014,
  "kling-v2": 0.028,
  "kling-v3": 0.05,
};

export default function AdminAIProviders() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState({
    totalGenerations: 0,
    totalCost: 0,
    byModel: {} as Record<string, { count: number; cost: number }>,
  });

  const providers = [
    { name: "Kling AI", desc: "Video generation — Kling v1, v2, v3", note: "Manage credits at app.klingai.com", fields: [{ key: "kling_access_key", label: "Access Key", secret: true }, { key: "kling_secret_key", label: "Secret Key", secret: true }] },
    { name: "OpenAI", desc: "GPT-4 for scripts, prompt expansion and Sora for video", note: "Manage credits at platform.openai.com", fields: [{ key: "openai_api_key", label: "API Key", secret: true }] },
    { name: "ElevenLabs", desc: "AI voice generation", note: "Manage credits at elevenlabs.io", fields: [{ key: "elevenlabs_api_key", label: "API Key", secret: true }] },
    { name: "Runway", desc: "Runway Gen-4 video generation", note: "Manage credits at runwayml.com", fields: [{ key: "runway_api_key", label: "API Key", secret: true }] },
  ];

  useEffect(() => {
    fetchSettings();
    fetchStats();
  }, []);

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

  const fetchStats = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/admin/generations", { headers: { Authorization: "Bearer " + session.access_token } });
    const data = await res.json();
    const generations = data.generations || [];
    const byModel: Record<string, { count: number; cost: number }> = {};
    let totalCost = 0;
    generations.forEach((g: any) => {
      const model = g.model || "kling-v1";
      const cost = API_COSTS[model as keyof typeof API_COSTS] || 0.014;
      if (!byModel[model]) byModel[model] = { count: 0, cost: 0 };
      byModel[model].count++;
      byModel[model].cost += cost;
      totalCost += cost;
    });
    setStats({ totalGenerations: generations.length, totalCost, byModel });
  };

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
        <div><h1 className="text-2xl font-extrabold mb-1">AI Providers</h1><p className="text-gray-400 text-sm">Manage API keys and monitor usage costs</p></div>
        <button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition text-sm">{saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-2xl p-4">
          <div className="text-yellow-400 text-xs font-bold uppercase mb-1">Total API Cost</div>
          <div className="text-2xl font-extrabold text-white">\${stats.totalCost.toFixed(3)}</div>
          <div className="text-gray-500 text-xs">All time estimated</div>
        </div>
        <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-4">
          <div className="text-purple-400 text-xs font-bold uppercase mb-1">Total Generations</div>
          <div className="text-2xl font-extrabold text-white">{stats.totalGenerations}</div>
          <div className="text-gray-500 text-xs">Videos generated</div>
        </div>
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-2xl p-4">
          <div className="text-blue-400 text-xs font-bold uppercase mb-1">Avg Cost/Video</div>
          <div className="text-2xl font-extrabold text-white">\${stats.totalGenerations > 0 ? (stats.totalCost / stats.totalGenerations).toFixed(3) : "0.000"}</div>
          <div className="text-gray-500 text-xs">Per generation</div>
        </div>
      </div>

      {Object.keys(stats.byModel).length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="font-bold text-sm mb-4">Usage by Model</h3>
          <div className="space-y-3">
            {Object.entries(stats.byModel).map(([model, data]) => (
              <div key={model} className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold capitalize">{model.replace(/-/g, " ")}</div>
                  <div className="text-gray-500 text-xs">{data.count} generations</div>
                </div>
                <div className="text-right">
                  <div className="text-yellow-400 font-bold text-sm">\${data.cost.toFixed(3)}</div>
                  <div className="text-gray-500 text-xs">estimated cost</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? <p className="text-gray-400">Loading...</p> : (
        <div className="space-y-4">
          {providers.map((provider, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold">{provider.name}</h3>
                  <p className="text-gray-500 text-xs">{provider.desc}</p>
                </div>
                <a href={provider.note.split("at ")[1] ? "https://" + provider.note.split("at ")[1] : "#"} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-white text-xs transition shrink-0 ml-4">
                  View Credits
                </a>
              </div>
              <div className="space-y-3">
                {provider.fields.map((field) => (
                  <div key={field.key}>
                    <label className="text-gray-400 text-xs mb-1 block">{field.label}</label>
                    <input type={field.secret ? "password" : "text"} value={settings[field.key] || ""} onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })} placeholder={"Enter " + field.label} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
                  </div>
                ))}
              </div>
              <p className="text-gray-600 text-xs mt-3">{provider.note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
`, 'utf8');

console.log('Updated AI Providers page with cost tracker!');