"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

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

  const MODEL_COSTS: Record<string, number> = {
    "kling-v1-6-std":  0.007,
    "kling-v1-6-pro":  0.014,
    "kling-v2-master": 0.025,
    "kling-v3-std":    0.040,
    "kling-v3-pro":    0.063,
    "higgsfield-ugc":  0.060,
  };

  const providers = [
    {
      id: "kie",
      name: "Kie.ai",
      desc: "Unified API — Kling 1.6, 2.1, 3.0 (with audio), Veo 3, Seedance 2.0, and more",
      docsUrl: "https://docs.kie.ai",
      enabledKey: "kie_enabled",
      fields: [
        { key: "kie_api_key", label: "API Key", secret: true },
      ],
      models: [
        { key: "kling_v1_6_enabled", label: "Kling 1.6 (Standard + Pro)" },
        { key: "kling_v2_master_enabled", label: "Kling 2.1 Master" },
        { key: "kling_v3_enabled", label: "Kling 3.0 (Standard + Pro) — With Audio" },
      ],
    },
    {
      id: "higgsfield",
      name: "Higgsfield AI",
      desc: "Realistic UGC and ad video generation — image to video with Seedance",
      docsUrl: "https://docs.higgsfield.ai",
      enabledKey: "higgsfield_enabled",
      fields: [
        { key: "higgsfield_key_id", label: "API Key ID", secret: false },
        { key: "higgsfield_key_secret", label: "API Key Secret", secret: true },
      ],
      models: [
        { key: "higgsfield_enabled", label: "Higgsfield UGC Mode" },
      ],
    },
    {
      id: "openai",
      name: "OpenAI",
      desc: "GPT-4 for scripts and prompt expansion",
      docsUrl: "https://platform.openai.com",
      enabledKey: "openai_enabled",
      fields: [
        { key: "openai_api_key", label: "API Key", secret: true },
      ],
      models: [],
    },
    {
      id: "elevenlabs",
      name: "ElevenLabs",
      desc: "AI voice generation for video voiceovers",
      docsUrl: "https://elevenlabs.io",
      enabledKey: "elevenlabs_enabled",
      fields: [
        { key: "elevenlabs_api_key", label: "API Key", secret: true },
      ],
      models: [],
    },
  ];

  useEffect(() => {
    fetchSettings();
    fetchStats();
  }, []);

  const fetchSettings = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/admin/settings?category=ai_providers", {
      headers: { Authorization: "Bearer " + session.access_token },
    });
    const data = await res.json();
    const map: Record<string, string> = {};
    data.settings?.forEach((s: any) => { map[s.key] = s.value || ""; });
    setSettings(map);
    setLoading(false);
  };

  const fetchStats = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/admin/generations", {
      headers: { Authorization: "Bearer " + session.access_token },
    });
    const data = await res.json();
    const generations = data.generations || [];
    const byModel: Record<string, { count: number; cost: number }> = {};
    let totalCost = 0;
    generations.forEach((g: any) => {
      const model = g.model || "kling-v1-6-std";
      const cost = MODEL_COSTS[model] || 0.014;
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
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
      body: JSON.stringify({
        settings: Object.entries(settings).map(([key, value]) => ({ key, value })),
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const toggleEnabled = (key: string) => {
    setSettings({ ...settings, [key]: settings[key] === "true" ? "false" : "true" });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold mb-1">AI Providers</h1>
          <p className="text-gray-400 text-sm">Manage API keys and enable AI models</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition text-sm">
          {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-2xl p-4">
          <div className="text-yellow-400 text-xs font-bold uppercase mb-1">Total API Cost</div>
          <div className="text-2xl font-extrabold">${stats.totalCost.toFixed(3)}</div>
          <div className="text-gray-500 text-xs">All time estimated</div>
        </div>
        <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-4">
          <div className="text-purple-400 text-xs font-bold uppercase mb-1">Total Generations</div>
          <div className="text-2xl font-extrabold">{stats.totalGenerations}</div>
          <div className="text-gray-500 text-xs">Videos generated</div>
        </div>
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-2xl p-4">
          <div className="text-blue-400 text-xs font-bold uppercase mb-1">Avg Cost Per Video</div>
          <div className="text-2xl font-extrabold">
            ${stats.totalGenerations > 0 ? (stats.totalCost / stats.totalGenerations).toFixed(3) : "0.000"}
          </div>
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
                  <div className="text-sm font-semibold">{model}</div>
                  <div className="text-gray-500 text-xs">{data.count} generations</div>
                </div>
                <div className="text-yellow-400 font-bold text-sm">${data.cost.toFixed(3)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? <p className="text-gray-400">Loading...</p> : (
        <div className="space-y-4">
          {providers.map((provider) => (
            <div key={provider.id} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold">{provider.name}</h3>
                  <p className="text-gray-500 text-xs mt-0.5">{provider.desc}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => window.open(provider.docsUrl, "_blank")} className="text-purple-400 hover:text-white text-xs transition">
                    Docs
                  </button>
                  <button
                    onClick={() => toggleEnabled(provider.enabledKey)}
                    className={"relative w-12 h-6 rounded-full transition-colors " + (settings[provider.enabledKey] === "true" ? "bg-purple-600" : "bg-white/20")}
                  >
                    <div className={"absolute top-1 w-4 h-4 bg-white rounded-full transition-all " + (settings[provider.enabledKey] === "true" ? "left-7" : "left-1")} />
                  </button>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                {provider.fields.map((field) => (
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

              {provider.models.length > 0 && (
                <div>
                  <p className="text-gray-400 text-xs font-semibold mb-2">Enable Models</p>
                  <div className="space-y-2">
                    {provider.models.map((model) => (
                      <div key={model.key} className="flex items-center justify-between bg-black/20 rounded-xl px-4 py-2.5">
                        <span className="text-sm">{model.label}</span>
                        <button
                          onClick={() => toggleEnabled(model.key)}
                          className={"relative w-10 h-5 rounded-full transition-colors " + (settings[model.key] !== "false" ? "bg-purple-600" : "bg-white/20")}
                        >
                          <div className={"absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all " + (settings[model.key] !== "false" ? "left-5" : "left-0.5")} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
