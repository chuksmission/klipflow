import { writeFileSync, mkdirSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jcovsxvbrakofybchvbc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjb3ZzeHZicmFrb2Z5YmNodmJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA0MTk1MywiZXhwIjoyMDYyNjE3OTUzfQ.6SRznMlGOUqbfnLTdXoNlgRe0xMfun8QUTJMWWrMRLA'
);

// Save Higgsfield keys to admin_settings
async function saveHiggsfield() {
  await supabase.from('admin_settings').upsert([
    { key: 'higgsfield_key_id', value: 'db3d2fd5-6738-47de-9a9c-cc35592833ed', category: 'ai_providers', is_secret: true },
    { key: 'higgsfield_key_secret', value: '0a6542fc6e02817cda317927bc16b4a50ceb725e64b3aa2fb06017e4c1ff7e9c', category: 'ai_providers', is_secret: true },
    { key: 'higgsfield_enabled', value: 'true', category: 'ai_providers', is_secret: false },
  ], { onConflict: 'key' });
  console.log('Saved Higgsfield keys to admin_settings');
}

await saveHiggsfield();

// ============================================
// 1. GENERATE VIDEO API
// ============================================
writeFileSync('app/api/generate-video/route.ts', `import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAdminSetting(key: string): Promise<string> {
  const { data } = await supabase.from("admin_settings").select("value").eq("key", key).single();
  return data?.value ?? "";
}

async function generateKlingToken(): Promise<string> {
  const accessKey = process.env.KLING_ACCESS_KEY ?? await getAdminSetting("kling_access_key");
  const secretKey = process.env.KLING_SECRET_KEY ?? await getAdminSetting("kling_secret_key");
  if (!accessKey || !secretKey) throw new Error("Kling API keys not configured");
  const secret = new TextEncoder().encode(secretKey);
  return new jose.SignJWT({
    iss: accessKey,
    exp: Math.floor(Date.now() / 1000) + 1800,
    nbf: Math.floor(Date.now() / 1000) - 5,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .sign(secret);
}

async function refundTokens(userId: string, amount: number) {
  try {
    const { data } = await supabase.from("user_tokens").select("balance, total_used").eq("user_id", userId).single();
    if (data) {
      await supabase.from("user_tokens").update({
        balance: data.balance + amount,
        total_used: Math.max(0, data.total_used - amount),
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);
    }
  } catch (err) { console.error("Refund error:", err); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      prompt: string;
      mode?: string;
      image_url?: string;
      duration?: string;
      aspect_ratio?: string;
      model?: string;
      with_audio?: boolean;
      user_id?: string;
      tokens_used?: number;
    };

    const {
      prompt,
      mode = "text_to_video",
      image_url,
      duration = "5",
      aspect_ratio = "16:9",
      model = "kling-v1-6-pro",
      with_audio = false,
      user_id,
      tokens_used = 15,
    } = body;

    if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

    // ---- HIGGSFIELD ----
    if (model === "higgsfield-ugc") {
      const keyId = await getAdminSetting("higgsfield_key_id");
      const keySecret = await getAdminSetting("higgsfield_key_secret");
      if (!keyId || !keySecret) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        return NextResponse.json({ error: "Higgsfield not configured in admin settings.", refunded: true }, { status: 503 });
      }

      const credentials = keyId + ":" + keySecret;
      const higgsBody: Record<string, unknown> = {
        prompt,
        aspect_ratio,
        duration: parseInt(duration),
      };
      if (image_url) higgsBody.image_url = image_url;

      const endpoint = image_url
        ? "https://cloud.higgsfield.ai/v1/video/image-to-video"
        : "https://cloud.higgsfield.ai/v1/video/text-to-video";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Key " + credentials,
        },
        body: JSON.stringify(higgsBody),
      });

      const data = await response.json() as { id?: string; status?: string; error?: string; message?: string };
      if (!response.ok) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        return NextResponse.json({ error: data.error ?? data.message ?? "Higgsfield API error", refunded: true }, { status: response.status });
      }
      return NextResponse.json({ success: true, task_id: data.id, status: data.status, provider: "higgsfield" });
    }

    // ---- KLING ----
    const klingToken = await generateKlingToken();

    // Official Kling API model names
    const modelMap: Record<string, { model_name: string; mode: string; sound: boolean }> = {
      "kling-v1-6-std":  { model_name: "kling-v1-6",      mode: "std", sound: false },
      "kling-v1-6-pro":  { model_name: "kling-v1-6",      mode: "pro", sound: false },
      "kling-v2-master": { model_name: "kling-v2-master",  mode: "pro", sound: false },
      "kling-v3-std":    { model_name: "kling-v3",         mode: "std", sound: true  },
      "kling-v3-pro":    { model_name: "kling-v3",         mode: "pro", sound: true  },
    };

    const cfg = modelMap[model] ?? { model_name: "kling-v1-6", mode: "std", sound: false };
    const useAudio = with_audio || cfg.sound;

    const requestBody: Record<string, unknown> = {
      model_name: cfg.model_name,
      prompt,
      duration,
      aspect_ratio,
      cfg_scale: 0.5,
      mode: cfg.mode,
    };

    if (useAudio) requestBody.with_audio = true;
    if (mode === "image_to_video" && image_url) requestBody.image_url = image_url;

    const endpoint = mode === "image_to_video"
      ? "https://api.klingai.com/v1/videos/image2video"
      : "https://api.klingai.com/v1/videos/text2video";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + klingToken },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json() as {
      data?: { task_id?: string; task_status?: string };
      message?: string;
    };

    if (!response.ok) {
      if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
      return NextResponse.json({ error: data.message ?? "Kling API error", refunded: true }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      task_id: data.data?.task_id,
      status: data.data?.task_status,
      provider: "kling",
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Video generation error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
`, 'utf8');
console.log('Fixed generate-video API');

// ============================================
// 2. VIDEO STATUS API
// ============================================
writeFileSync('app/api/video-status/route.ts', `import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAdminSetting(key: string): Promise<string> {
  const { data } = await supabase.from("admin_settings").select("value").eq("key", key).single();
  return data?.value ?? "";
}

async function generateKlingToken(): Promise<string> {
  const accessKey = process.env.KLING_ACCESS_KEY ?? await getAdminSetting("kling_access_key");
  const secretKey = process.env.KLING_SECRET_KEY ?? await getAdminSetting("kling_secret_key");
  if (!accessKey || !secretKey) throw new Error("Kling API keys not configured");
  const secret = new TextEncoder().encode(secretKey);
  return new jose.SignJWT({
    iss: accessKey,
    exp: Math.floor(Date.now() / 1000) + 1800,
    nbf: Math.floor(Date.now() / 1000) - 5,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .sign(secret);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const task_id = searchParams.get("task_id");
    const mode = searchParams.get("mode") ?? "text_to_video";
    const provider = searchParams.get("provider") ?? "kling";

    if (!task_id) return NextResponse.json({ error: "task_id is required" }, { status: 400 });

    // Higgsfield status
    if (provider === "higgsfield") {
      const keyId = await getAdminSetting("higgsfield_key_id");
      const keySecret = await getAdminSetting("higgsfield_key_secret");
      if (!keyId || !keySecret) return NextResponse.json({ error: "Higgsfield not configured" }, { status: 503 });

      const credentials = keyId + ":" + keySecret;
      const response = await fetch("https://cloud.higgsfield.ai/v1/video/" + task_id, {
        headers: { "Authorization": "Key " + credentials },
      });

      const data = await response.json() as {
        status?: string;
        output?: { url?: string } | Array<{ url?: string }>;
        error?: string;
      };

      const videoUrl = Array.isArray(data.output)
        ? data.output[0]?.url
        : (data.output as { url?: string } | undefined)?.url;

      const isDone = data.status === "succeeded" || data.status === "completed";
      const isFailed = data.status === "failed" || data.status === "error";

      return NextResponse.json({
        success: true,
        status: data.status,
        video_url: videoUrl ?? null,
        completed: isDone,
        failed: isFailed,
        progress: data.status ?? "",
      });
    }

    // Kling status
    const token = await generateKlingToken();
    const endpoint = mode === "image_to_video"
      ? \`https://api.klingai.com/v1/videos/image2video/\${task_id}\`
      : \`https://api.klingai.com/v1/videos/text2video/\${task_id}\`;

    const response = await fetch(endpoint, {
      headers: { Authorization: "Bearer " + token },
    });

    const data = await response.json() as {
      data?: {
        task_status?: string;
        task_status_msg?: string;
        task_result?: { videos?: Array<{ url: string }> };
      };
      message?: string;
    };

    if (!response.ok) {
      return NextResponse.json({ error: data.message ?? "Status check failed" }, { status: response.status });
    }

    const taskData = data.data;
    const status = taskData?.task_status;
    const videoUrl = taskData?.task_result?.videos?.[0]?.url;

    return NextResponse.json({
      success: true,
      status,
      video_url: videoUrl ?? null,
      completed: status === "succeed",
      failed: status === "failed",
      progress: taskData?.task_status_msg ?? "",
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Status check error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
`, 'utf8');
console.log('Fixed video-status API');

// ============================================
// 3. TOKEN REFUND API
// ============================================
mkdirSync('app/api/tokens/refund', { recursive: true });
writeFileSync('app/api/tokens/refund/route.ts', `import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { amount } = await req.json() as { amount: number };
    if (!amount || amount <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

    const { data: tokenData } = await supabase.from("user_tokens").select("balance, total_used").eq("user_id", user.id).single();
    if (!tokenData) return NextResponse.json({ error: "Token record not found" }, { status: 404 });

    const { data: updated } = await supabase.from("user_tokens").update({
      balance: tokenData.balance + amount,
      total_used: Math.max(0, tokenData.total_used - amount),
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id).select().single();

    return NextResponse.json({ balance: updated?.balance, refunded: amount });
  } catch (error) {
    console.error("Refund error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
`, 'utf8');
console.log('Created token refund API');

// ============================================
// 4. ADMIN AI PROVIDERS PAGE
// ============================================
writeFileSync('app/admin/ai-providers/page.tsx', `"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminAIProviders() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState({ totalGenerations: 0, totalCost: 0, byModel: {} as Record<string, { count: number; cost: number }> });

  const MODEL_COSTS: Record<string, number> = {
    "kling-v1-6-std": 0.014,
    "kling-v1-6-pro": 0.028,
    "kling-v2-master": 0.05,
    "kling-v3-std": 0.084,
    "kling-v3-pro": 0.14,
    "higgsfield-ugc": 0.06,
  };

  const providers = [
    {
      id: "kling",
      name: "Kling AI",
      desc: "Video generation — Kling 1.6, 2 Master, 3.0",
      docsUrl: "https://app.klingai.com/global/dev",
      enabledKey: "kling_v1_6_enabled",
      fields: [
        { key: "kling_access_key", label: "Access Key", secret: true },
        { key: "kling_secret_key", label: "Secret Key", secret: true },
      ],
      models: [
        { key: "kling_v1_6_enabled", label: "Kling 1.6 (Standard + Pro)" },
        { key: "kling_v2_master_enabled", label: "Kling 2 Master" },
        { key: "kling_v3_enabled", label: "Kling 3.0 (Standard + Pro) — Native Audio" },
      ],
    },
    {
      id: "higgsfield",
      name: "Higgsfield AI",
      desc: "Realistic UGC and ad video generation — Soul Mode, DoP",
      docsUrl: "https://cloud.higgsfield.ai",
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
      desc: "GPT-4 for scripts and prompt expansion. Sora coming soon.",
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
      body: JSON.stringify({ settings: Object.entries(settings).map(([key, value]) => ({ key, value })) }),
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
          <div className="text-2xl font-extrabold">\${stats.totalCost.toFixed(3)}</div>
          <div className="text-gray-500 text-xs">All time estimated</div>
        </div>
        <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-4">
          <div className="text-purple-400 text-xs font-bold uppercase mb-1">Total Generations</div>
          <div className="text-2xl font-extrabold">{stats.totalGenerations}</div>
          <div className="text-gray-500 text-xs">Videos generated</div>
        </div>
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-2xl p-4">
          <div className="text-blue-400 text-xs font-bold uppercase mb-1">Avg Cost Per Video</div>
          <div className="text-2xl font-extrabold">\${stats.totalGenerations > 0 ? (stats.totalCost / stats.totalGenerations).toFixed(3) : "0.000"}</div>
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
                <div className="text-yellow-400 font-bold text-sm">\${data.cost.toFixed(3)}</div>
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
                  <p className="text-gray-500 text-xs">{provider.desc}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => window.open(provider.docsUrl, "_blank")} className="text-purple-400 hover:text-white text-xs transition">View Docs</button>
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
                          className={"relative w-10 h-5 rounded-full transition-colors " + (settings[model.key] === "true" || settings[model.key] === undefined ? "bg-purple-600" : "bg-white/20")}
                        >
                          <div className={"absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all " + (settings[model.key] === "true" || settings[model.key] === undefined ? "left-5" : "left-0.5")} />
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
`, 'utf8');
console.log('Updated AI Providers admin page');

// ============================================
// 5. STUDIO PAGE — all models from admin
// ============================================
writeFileSync('app/dashboard/studio/page.tsx', `"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";

interface Model {
  id: string;
  name: string;
  desc: string;
  tokens: number;
  badge: string;
  available: boolean;
  provider: string;
  hasSound: boolean;
}

interface Module {
  id: string;
  title: string;
  desc: string;
  badge: string;
}

export default function Studio() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>("");
  const [duration, setDuration] = useState<string>("5");
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [loading, setLoading] = useState<boolean>(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [imageUrlInput, setImageUrlInput] = useState<string>("");
  const [useUrl, setUseUrl] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [tokenBalance, setTokenBalance] = useState<number>(25);
  const [selectedModel, setSelectedModel] = useState<string>("kling-v1-6-pro");
  const [enabledModels, setEnabledModels] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const tokenCostRef = useRef<number>(15);
  const selectedModelRef = useRef<string>("kling-v1-6-pro");
  const activeModuleRef = useRef<string | null>(null);
  const providerRef = useRef<string>("kling");

  useEffect(() => { selectedModelRef.current = selectedModel; }, [selectedModel]);
  useEffect(() => { activeModuleRef.current = activeModule; }, [activeModule]);

  const ALL_MODELS: Model[] = [
    { id: "kling-v1-6-std",  name: "Kling 1.6 Standard", desc: "Fast, great for drafts",                tokens: 10, badge: "",              available: true, provider: "kling",       hasSound: false },
    { id: "kling-v1-6-pro",  name: "Kling 1.6 Pro",      desc: "High quality, smooth motion",            tokens: 15, badge: "Recommended",   available: true, provider: "kling",       hasSound: false },
    { id: "kling-v2-master", name: "Kling 2 Master",      desc: "Best realism and motion",                tokens: 20, badge: "Best Quality",  available: true, provider: "kling",       hasSound: false },
    { id: "kling-v3-std",    name: "Kling 3.0 Standard",  desc: "Cinematic, native audio, up to 15s",    tokens: 25, badge: "With Audio",     available: true, provider: "kling",       hasSound: true  },
    { id: "kling-v3-pro",    name: "Kling 3.0 Pro",       desc: "1080p, native audio, multi-shot",       tokens: 35, badge: "Premium",        available: true, provider: "kling",       hasSound: true  },
    { id: "higgsfield-ugc",  name: "Higgsfield UGC",      desc: "Most realistic UGC and ad videos",      tokens: 20, badge: "Best for Ads",   available: true, provider: "higgsfield",  hasSound: false },
    { id: "runway-gen4",     name: "Runway Gen-4",         desc: "Professional cinematic quality",         tokens: 30, badge: "Coming Soon",   available: false, provider: "runway",     hasSound: false },
  ];

  const modules: Module[] = [
    { id: "text_to_video", title: "Text to Video",   desc: "Generate cinematic videos from text descriptions", badge: "Most Popular" },
    { id: "image_to_video", title: "Image to Video", desc: "Animate any still image into a stunning video",    badge: "" },
    { id: "ugc_ad",   title: "UGC Ad Creator",        desc: "AI avatar testimonial and product review videos",  badge: "Best for Ads" },
    { id: "ai_actor", title: "AI Actor",              desc: "Create photorealistic AI human avatars",           badge: "" },
    { id: "voice",    title: "Voice Generation",      desc: "Natural AI voiceovers for videos",                 badge: "" },
    { id: "image_ad", title: "Image Ad",              desc: "Scroll-stopping image advertisements",             badge: "Cheapest" },
    { id: "prompt",   title: "Prompt Expander",       desc: "Transform ideas into cinematic prompts",           badge: "" },
    { id: "script",   title: "Script Writer",         desc: "Generate viral video scripts",                     badge: "" },
  ];

  // Determine available models based on admin settings
  const availableModels = ALL_MODELS.filter((m) => {
    if (!m.available) return false;
    if (m.provider === "higgsfield") return enabledModels["higgsfield_enabled"] !== false;
    if (m.id.startsWith("kling-v1-6")) return enabledModels["kling_v1_6_enabled"] !== false;
    if (m.id.startsWith("kling-v2"))   return enabledModels["kling_v2_master_enabled"] !== false;
    if (m.id.startsWith("kling-v3"))   return enabledModels["kling_v3_enabled"] !== false;
    return true;
  });

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (loading) {
      setElapsedTime(0);
      setProgress(0);
      timer = setInterval(() => {
        setElapsedTime((prev: number) => {
          const t = prev + 1;
          setProgress(Math.min(90, (t / 180) * 100));
          return t;
        });
      }, 1000);
    } else if (videoUrl) setProgress(100);
    return () => { if (timer) clearInterval(timer); };
  }, [loading, videoUrl]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      // Fetch token balance
      const res = await fetch("/api/tokens", { headers: { Authorization: "Bearer " + session.access_token } });
      const data = await res.json();
      if (data.balance !== undefined) setTokenBalance(data.balance);
      // Fetch enabled models from admin settings
      const settingsRes = await fetch("/api/admin/settings?category=ai_providers", {
        headers: { Authorization: "Bearer " + session.access_token },
      });
      const settingsData = await settingsRes.json();
      const map: Record<string, boolean> = {};
      settingsData.settings?.forEach((s: any) => {
        if (s.key.includes("_enabled")) map[s.key] = s.value === "true";
      });
      setEnabledModels(map);
    };
    init();
  }, []);

  useEffect(() => {
    if (activeModule === "ugc_ad") setSelectedModel("higgsfield-ugc");
    else if (selectedModel === "higgsfield-ugc") setSelectedModel("kling-v1-6-pro");
  }, [activeModule]);

  const formatTime = (s: number): string => {
    const m = Math.floor(s / 60);
    return m > 0 ? m + "m " + (s % 60) + "s" : s + "s";
  };

  const getStatusMsg = (e: number): string => {
    if (e < 10) return "Initializing AI models...";
    if (e < 30) return "Analyzing your prompt...";
    if (e < 60) return "Generating video frames...";
    if (e < 120) return "Rendering cinematic details...";
    return "Almost ready, finalizing...";
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev: ProgressEvent<FileReader>) => {
      if (ev.target?.result) setImagePreview(ev.target.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const ext = file.name.split(".").pop() ?? "jpg";
    const filename = session.user.id + "-" + Date.now() + "." + ext;
    const { error } = await supabase.storage.from("generation-inputs").upload(filename, file, { contentType: file.type });
    if (error) { console.error("Upload error:", error); return null; }
    const { data: { publicUrl } } = supabase.storage.from("generation-inputs").getPublicUrl(filename);
    return publicUrl;
  };

  const handleGenerate = async () => {
    if (!prompt) { setError("Please enter a prompt."); return; }
    const needsImage = activeModule === "image_to_video" || activeModule === "ugc_ad";
    if (needsImage && !imageFile && !imageUrlInput) { setError("Please upload an image or enter an image URL."); return; }

    setLoading(true); setError(""); setVideoUrl(null); setProgress(0);

    const modelData = availableModels.find((m) => m.id === selectedModel);
    const tokenCost = modelData?.tokens ?? 15;
    const provider = modelData?.provider ?? "kling";
    tokenCostRef.current = tokenCost;
    providerRef.current = provider;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Please sign in."); setLoading(false); return; }

      const tokenRes = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ amount: tokenCost }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) { setError(tokenData.error ?? "Insufficient tokens."); setLoading(false); return; }
      setTokenBalance(tokenData.balance);

      let imageUrl = imageUrlInput;
      if (needsImage && imageFile && !useUrl) {
        const uploaded = await uploadImage(imageFile);
        if (!uploaded) { setError("Image upload failed. Try URL instead."); setLoading(false); return; }
        imageUrl = uploaded;
      }

      const capturedModule = activeModuleRef.current;
      const capturedModel = selectedModelRef.current;
      const capturedCost = tokenCostRef.current;
      const capturedProvider = providerRef.current;
      const capturedMode = needsImage ? "image_to_video" : "text_to_video";
      const useAudio = modelData?.hasSound === true;

      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt, mode: capturedMode,
          image_url: imageUrl || undefined,
          duration, aspect_ratio: aspectRatio,
          model: selectedModel, with_audio: useAudio,
          user_id: session.user.id, tokens_used: tokenCost,
        }),
      });

      const data = await res.json() as { task_id?: string; error?: string; refunded?: boolean; provider?: string };
      if (!res.ok) {
        setError((data.error ?? "Generation failed.") + (data.refunded ? " Tokens refunded." : ""));
        setLoading(false);
        if (data.refunded) setTokenBalance((p) => p + tokenCost);
        return;
      }

      const genProvider = data.provider ?? capturedProvider;

      const poll = setInterval(async () => {
        try {
          const sr = await fetch("/api/video-status?task_id=" + data.task_id + "&mode=" + capturedMode + "&provider=" + genProvider);
          const sd = await sr.json() as { completed?: boolean; failed?: boolean; video_url?: string };

          if (sd.completed && sd.video_url) {
            setVideoUrl(sd.video_url); setProgress(100); setLoading(false); clearInterval(poll);
            try {
              const { data: { session: fs } } = await supabase.auth.getSession();
              if (fs) {
                await fetch("/api/generations", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: "Bearer " + fs.access_token },
                  body: JSON.stringify({ type: capturedModule, prompt, video_url: sd.video_url, status: "completed", tokens_used: capturedCost, duration, aspect_ratio: aspectRatio, model: capturedModel }),
                });
              }
            } catch (e) { console.error("Save error:", e); }

          } else if (sd.failed) {
            setError("Generation failed. Tokens refunded."); setLoading(false); clearInterval(poll);
            try {
              const { data: { session: rs } } = await supabase.auth.getSession();
              if (rs) {
                const rr = await fetch("/api/tokens/refund", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: "Bearer " + rs.access_token },
                  body: JSON.stringify({ amount: capturedCost }),
                });
                const rd = await rr.json();
                if (rd.balance !== undefined) setTokenBalance(rd.balance);
              }
            } catch (e) { console.error("Refund error:", e); }
          }
        } catch (e) { console.error("Poll error:", e); }
      }, 5000);

      setTimeout(() => { clearInterval(poll); setLoading(false); }, 300000);

    } catch (e) { setError("Something went wrong."); setLoading(false); }
  };

  const handleDownload = async (url: string): Promise<void> => {
    try {
      const r = await fetch(url);
      const b = await r.blob();
      const bu = window.URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = bu; a.download = "klipflowai-" + Date.now() + ".mp4";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(bu);
    } catch { window.open(url, "_blank"); }
  };

  const resetForm = () => {
    setActiveModule(null); setPrompt(""); setError(""); setVideoUrl(null);
    setImageFile(null); setImagePreview(""); setImageUrlInput(""); setUseUrl(false);
    setProgress(0); setElapsedTime(0); setSelectedModel("kling-v1-6-pro");
  };

  const currentModel = availableModels.find((m) => m.id === selectedModel);
  const tokenCost = currentModel?.tokens ?? 15;
  const needsImage = activeModule === "image_to_video" || activeModule === "ugc_ad";
  const showModels = activeModule === "text_to_video" || activeModule === "image_to_video" || activeModule === "ugc_ad";
  const visibleModels = activeModule === "ugc_ad"
    ? availableModels
    : availableModels.filter((m) => m.id !== "higgsfield-ugc");

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-extrabold mb-0.5">Video Studio</h1>
        <p className="text-gray-400 text-xs">8 AI modules — all plans include all features</p>
      </div>

      <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-3 flex items-center justify-between">
        <div>
          <p className="text-purple-300 font-semibold text-sm">{tokenBalance} tokens remaining</p>
          <p className="text-gray-500 text-xs">{currentModel?.name ?? "Select a module"} — {tokenCost} tokens</p>
        </div>
        <a href="/dashboard/billing" className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-1.5 px-3 rounded-full transition">Top Up</a>
      </div>

      {!activeModule && (
        <div className="grid grid-cols-2 gap-3">
          {modules.map((mod) => (
            <div key={mod.id} onClick={() => setActiveModule(mod.id)} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-purple-500/50 transition cursor-pointer">
              {mod.badge && <div className="inline-block bg-purple-900/40 text-purple-300 text-xs font-bold px-2 py-0.5 rounded-full mb-2">{mod.badge}</div>}
              <h3 className="font-bold text-sm mb-1">{mod.title}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{mod.desc}</p>
            </div>
          ))}
        </div>
      )}

      {activeModule && !loading && !videoUrl && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={resetForm} className="text-gray-400 hover:text-white text-sm transition">Back</button>
            <h2 className="font-bold text-sm">{modules.find((m) => m.id === activeModule)?.title}</h2>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">

            {needsImage && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => setUseUrl(false)} className={"px-3 py-1.5 rounded-full text-xs font-bold transition " + (!useUrl ? "bg-purple-600 text-white" : "bg-white/10 text-gray-400")}>Upload Image</button>
                  <button onClick={() => setUseUrl(true)} className={"px-3 py-1.5 rounded-full text-xs font-bold transition " + (useUrl ? "bg-purple-600 text-white" : "bg-white/10 text-gray-400")}>Use URL</button>
                </div>
                {!useUrl ? (
                  <div>
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageFile} className="hidden" />
                    <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-white/20 hover:border-purple-500/50 rounded-xl p-6 text-center cursor-pointer transition">
                      {imagePreview
                        ? <img src={imagePreview} alt="Preview" className="max-h-40 mx-auto rounded-lg object-contain" />
                        : <div><p className="text-gray-400 text-sm font-semibold mb-1">Click to upload image</p><p className="text-gray-600 text-xs">JPG, PNG, WebP up to 10MB</p></div>
                      }
                    </div>
                    {imageFile && <p className="text-green-400 text-xs">{imageFile.name} ready</p>}
                  </div>
                ) : (
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Image URL</label>
                    <input type="url" placeholder="https://example.com/image.jpg" value={imageUrlInput} onChange={(e) => setImageUrlInput(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm" />
                  </div>
                )}
              </div>
            )}

            {activeModule === "ugc_ad" && (
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-3">
                <p className="text-purple-300 text-xs font-semibold mb-1">Higgsfield UGC Mode</p>
                <p className="text-gray-400 text-xs">Upload a photo of your avatar for the most realistic AI UGC ads.</p>
              </div>
            )}

            <div>
              <label className="text-gray-400 text-xs mb-1 block">
                {activeModule === "ugc_ad" ? "Describe the UGC ad scenario" : activeModule === "script" ? "Describe your video topic" : activeModule === "prompt" ? "Simple idea to expand" : "Describe your video"}
              </label>
              <textarea
                placeholder={activeModule === "ugc_ad" ? "Woman in kitchen holding product, smiling, authentic testimonial style, natural lighting..." : "A luxury watch rotating slowly on a marble surface, golden hour lighting, cinematic 4K..."}
                value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm resize-none"
              />
            </div>

            {showModels && (
              <>
                <div>
                  <label className="text-gray-400 text-xs mb-2 block">AI Model</label>
                  <div className="grid grid-cols-2 gap-2">
                    {visibleModels.map((model) => (
                      <button key={model.id} onClick={() => model.available && setSelectedModel(model.id)} disabled={!model.available}
                        className={"p-3 rounded-xl border text-left transition " + (selectedModel === model.id ? "border-purple-500 bg-purple-900/30" : model.available ? "border-white/10 bg-white/5 hover:border-purple-500/50" : "border-white/5 opacity-40 cursor-not-allowed")}
                      >
                        {model.badge && <div className={"text-xs font-bold px-1.5 py-0.5 rounded-full mb-1 inline-block " + (model.available ? "bg-purple-900/40 text-purple-300" : "bg-gray-900/40 text-gray-500")}>{model.badge}</div>}
                        <div className="font-bold text-xs mb-0.5">{model.name}</div>
                        <div className="text-gray-500 text-xs">{model.tokens} tokens — {model.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Duration</label>
                    <select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm">
                      <option value="5">5 seconds</option>
                      <option value="10">10 seconds</option>
                      {(selectedModel === "kling-v3-std" || selectedModel === "kling-v3-pro") && <option value="15">15 seconds</option>}
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Aspect Ratio</label>
                    <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm">
                      <option value="16:9">16:9 YouTube</option>
                      <option value="9:16">9:16 TikTok / Reels</option>
                      <option value="1:1">1:1 Feed</option>
                    </select>
                  </div>
                </div>

                {currentModel?.hasSound && (
                  <div className="bg-green-900/20 border border-green-500/20 rounded-xl px-4 py-3">
                    <p className="text-green-400 text-xs font-semibold">Native audio included with {currentModel.name}</p>
                    <p className="text-gray-500 text-xs">Sound, dialogue and ambient audio generated automatically</p>
                  </div>
                )}
              </>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button onClick={handleGenerate} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition">
              Generate — {tokenCost} tokens
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
          <div className="text-center">
            <h3 className="font-bold mb-1">Generating Your Video</h3>
            <p className="text-gray-400 text-sm">{getStatusMsg(elapsedTime)}</p>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span>{Math.round(progress)}% complete</span>
              <span>{formatTime(elapsedTime)} elapsed</span>
            </div>
            <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-600 to-pink-500 rounded-full transition-all duration-1000" style={{ width: progress + "%" }} />
            </div>
          </div>
          <div className="space-y-2">
            {[
              { label: "AI models initialized", done: elapsedTime >= 10 },
              { label: "Prompt analyzed", done: elapsedTime >= 30 },
              { label: "Video frames generated", done: elapsedTime >= 60 },
              { label: "Cinematic details rendered", done: elapsedTime >= 120 },
              { label: "Video finalized", done: !!videoUrl },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={step.done ? "text-green-400" : "text-gray-600"}>{step.done ? "v" : "o"}</span>
                <span className={step.done ? "text-gray-300" : "text-gray-600"}>{step.label}</span>
              </div>
            ))}
          </div>
          <p className="text-gray-500 text-xs text-center">Keep this page open. Average: 1-3 minutes.</p>
        </div>
      )}

      {videoUrl && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-green-400 font-bold">Done!</span>
            <h3 className="font-bold">Your Video is Ready</h3>
          </div>
          <video src={videoUrl} controls playsInline className="w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => handleDownload(videoUrl)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition text-sm">Save Video</button>
            <button onClick={resetForm} className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition text-sm">Generate Another</button>
          </div>
          <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-3">
            <p className="text-blue-300 text-xs font-semibold mb-1">iPhone users</p>
            <p className="text-gray-400 text-xs">Tap and hold the video, then select Save to Photos.</p>
          </div>
        </div>
      )}
    </div>
  );
}
`, 'utf8');
console.log('Updated studio page with all models');

console.log('\nAll done! Push now.');