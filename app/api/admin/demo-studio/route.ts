import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { STUDIO_MODULES } from "../../../components/catalog";
import { structured } from "../../../lib/llm";
import { speakWithTimestamps, type SpeechAlignment } from "../../../lib/elevenlabs";
import { ACTOR_SWAP_LANGUAGES, type VoiceGender } from "../../../lib/actor-swap";
import { getTaskStatus } from "../../../lib/task-status";
import { download, mediaSeconds, runFfmpeg, workspace } from "../../../lib/server-ffmpeg";
import { recordWalkthrough } from "../../../lib/demo-recorder";
import { captionsEvenly, captionsFromAlignment, renderDemo } from "../../../lib/demo-render";
import {
  DEMO_FEATURES, DEMO_PRICING, MAX_RECORD_SECONDS, MUSIC_PRESETS, STEP_ACTIONS, demoSizes, estimateSeconds,
  type DemoAspect, type DemoStep, type Resolution,
} from "../../../lib/demo-studio";

// Recording holds a live browser session; rendering runs FFmpeg (Fluid compute allows 300s on every plan)
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BALANCE_KEY = "admin_token_balance";
const STORAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/generation-inputs/`;
const SUPABASE_UPLOAD_LIMIT = 45 * 1024 * 1024;

// ---------------------------------------------------------------- helpers

async function checkAdmin(token: string) {
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await supabase.from("user_profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin ? user : null;
}

async function getSetting(key: string): Promise<string> {
  const { data } = await supabase.from("admin_settings").select("value").eq("key", key).single();
  return data?.value ?? "";
}

async function setSetting(key: string, value: string, isSecret = false) {
  await supabase.from("admin_settings").upsert(
    { key, value, category: "demo_studio", is_secret: isSecret, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider responses are untyped
async function safeJson(res: Response): Promise<any> {
  try { const t = await res.text(); return t ? JSON.parse(t) : {}; } catch { return {}; }
}

async function price(p: { key: string; fallback: number }): Promise<number> {
  const { data } = await supabase.from("token_pricing").select("tokens").eq("action", p.key).maybeSingle();
  return typeof data?.tokens === "number" ? data.tokens : p.fallback;
}

// Admin tools spend the separate showcase balance (same as Showcase Studio)
async function getBalance(): Promise<number> {
  const v = parseInt(await getSetting(BALANCE_KEY), 10);
  return Number.isFinite(v) ? v : 0;
}
async function setBalance(v: number) {
  await supabase.from("admin_settings").upsert({ key: BALANCE_KEY, value: String(v), category: "showcase", updated_at: new Date().toISOString() }, { onConflict: "key" });
}
async function charge(amount: number): Promise<string | null> {
  const balance = await getBalance();
  if (balance < amount) return `Not enough showcase tokens: this costs ${amount}, balance is ${balance}. Top up in Showcase Studio.`;
  await setBalance(balance - amount);
  return null;
}
async function refund(amount: number) { await setBalance((await getBalance()) + amount); }

async function upload(path: string, body: Buffer | Uint8Array, contentType: string): Promise<string> {
  const { error } = await supabase.storage.from("generation-inputs").upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return supabase.storage.from("generation-inputs").getPublicUrl(path).data.publicUrl;
}

interface DemoRow {
  id: string;
  title: string;
  feature: string;
  description: string;
  steps: DemoStep[];
  aspect: DemoAspect;
  resolution: Resolution;
  status: string;
  recording_url: string | null;
  recording_seconds: number | null;
  voice_script: string | null;
  voiceover_url: string | null;
  voiceover_seconds: number | null;
  voice_alignment: SpeechAlignment | null;
  presenter_task: string | null;
  music_preset: string | null;
  final_url: string | null;
  generation_id: string | null;
  cost: number;
}

async function loadDemo(id: unknown): Promise<DemoRow | null> {
  if (typeof id !== "string") return null;
  const { data } = await supabase.from("demo_videos").select("*").eq("id", id).maybeSingle();
  return data as DemoRow | null;
}

async function updateDemo(id: string, patch: Record<string, unknown>) {
  const { data } = await supabase.from("demo_videos").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  return data;
}

function cleanSteps(raw: unknown): DemoStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 60).map((s: Record<string, unknown>) => ({
    action: (STEP_ACTIONS as readonly string[]).includes(String(s.action)) ? s.action as DemoStep["action"] : "wait",
    target: String(s.target ?? "").slice(0, 200),
    value: String(s.value ?? "").slice(0, 500),
    seconds: Math.min(90, Math.max(0, Number(s.seconds) || 0)),
    note: String(s.note ?? "").slice(0, 200),
  }));
}

// ---------------------------------------------------------------- planner

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string", enum: [...STEP_ACTIONS] },
          target: { type: "string", description: "Visible text, label or placeholder of the element; a path for goto; 'up'/'down' for scroll" },
          value: { type: "string", description: "Text to type, key to press, option to select, 'video'/'image' for upload, pixels for scroll" },
          seconds: { type: "number", description: "For wait / wait_for_text only" },
          note: { type: "string", description: "What the viewer sees at this step" },
        },
        required: ["action", "target", "value", "seconds", "note"],
        additionalProperties: false,
      },
    },
    voiceover_script: { type: "string" },
  },
  required: ["title", "steps", "voiceover_script"],
  additionalProperties: false,
};

const SITE_MAP = `KlipflowAI (klipflowai.com) site map. The browser is already signed in to a demo account and starts on /dashboard.
Pages:
- /dashboard: overview. /dashboard/studio: grid of Studio tools (click a tool's title to open it). /dashboard/studio?module=<id>: opens a tool directly.
- /dashboard/gallery, /dashboard/billing, /dashboard/settings, /dashboard/help.
Studio tools (id: title): ${STUDIO_MODULES.map((m) => `${m.id}: ${m.title}`).join("; ")}.
Common controls inside tools:
- Prompt-based tools (text_to_video, image_to_video, ugc_ad, ai_actor, voice, image_ad, text_to_image): a textarea labelled "Describe your video" (Image Ad: "Describe your ad", UGC: "Describe the UGC ad scenario"); "Upload Image" / "Use URL" buttons; AI model cards by model name; "Duration" select; "Output Language & Accent" with selects labelled "Language" and "Accent"; a generate button starting with "Generate".
- Prompt Expander: textarea "Your simple idea", button "Expand Prompt". Script Writer: textarea "Video Topic", button starting "Write".
- AI Video Translator: video upload, source/target language selects, a translate button.
- Video Remix: mode cards "Restyle", "Recreate", "Actor Swap"; button "Remix video".
- AI Actor Swap: cards "New person" and "New language and voice"; selects "1. Language" and "2. Accent"; "Female"/"Male"; permission toggle; button "Swap".
- Series Cloner: cards "Single video" and "Video series"; button starting "Analyse"; after analysis the "Series formula" card and "Make it yours" section.
- Faceless Reels: cards "Viral template", "Create your own series" and "One-off reel"; template cards by name with category chips; button "Design my characters"; then "Approve characters", "Create series bible", "Write the script" and "Render".
Uploads: use action "upload" with value "video" or "image" (the demo account's sample file is used).`;

const PLAN_SYSTEM = `You turn a plain-English description of a product walkthrough into browser automation steps for a screen-recorded demo video.

${SITE_MAP}

Rules:
- Only these actions: goto (target = path), click (target = visible text or label), type (target = field label or placeholder, value = text), press (value = key), select (target = select label, value = option text), upload (value = video|image), scroll (target = up|down, value = pixels), hover (target), wait (seconds), wait_for_text (target = text to wait for, seconds = max wait).
- Prefer goto /dashboard/studio?module=<id> to open a tool, unless the description asks to show navigating there.
- Use exact visible labels from the site map. Keep targets short.
- Add short waits (1-2 seconds) after key moments so viewers can follow.
- Results that take minutes (video generation, analysis) cannot be waited for: end on the click with a 2-3 second wait, unless the description says otherwise. Note in that step that a result isn't waited for.
- Generate buttons spend the demo account's tokens; only click them when the description asks.
- Keep the whole demo under ${MAX_RECORD_SECONDS} seconds.
- voiceover_script: a friendly narration for the demo, about 2.3 words per second of the expected length, in plain spoken English.`;

// ---------------------------------------------------------------- handler

export async function GET(req: NextRequest) {
  const admin = await checkAdmin((req.headers.get("authorization") ?? "").replace("Bearer ", ""));
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const keys = ["browserless_api_key", "browserless_enabled", "demo_account_email", "demo_account_password", "demo_sample_video_url", "demo_sample_image_url", "elevenlabs_api_key", "heygen_api_key", "claude_api_key", "openai_api_key", ...MUSIC_PRESETS.map((p) => `demo_music_${p.id}`)];
  const { data: rows } = await supabase.from("admin_settings").select("key, value").in("key", keys);
  const s = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value ?? ""]));
  const [{ data: demos }, balance, prices] = await Promise.all([
    supabase.from("demo_videos").select("id, title, feature, status, final_url, created_at").order("created_at", { ascending: false }).limit(20),
    getBalance(),
    Promise.all(Object.values(DEMO_PRICING).map(price)),
  ]);
  return NextResponse.json({
    balance,
    prices: Object.fromEntries(Object.keys(DEMO_PRICING).map((k, i) => [k, prices[i]])),
    config: {
      browserless: !!s.browserless_api_key && s.browserless_enabled !== "false",
      demo_email: s.demo_account_email ?? "",
      demo_password_set: !!s.demo_account_password,   // the password itself never leaves the server
      sample_video_url: s.demo_sample_video_url ?? "",
      sample_image_url: s.demo_sample_image_url ?? "",
      elevenlabs: !!s.elevenlabs_api_key,
      heygen: !!s.heygen_api_key,
      ai: !!(s.claude_api_key || s.openai_api_key),
    },
    music: Object.fromEntries(MUSIC_PRESETS.map((p) => [p.id, s[`demo_music_${p.id}`] || null])),
    demos: demos ?? [],
  });
}

export async function POST(req: NextRequest) {
  let refundOnError = 0;
  try {
    const admin = await checkAdmin((req.headers.get("authorization") ?? "").replace("Bearer ", ""));
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- validated field by field below
    const body = await req.json() as Record<string, any>;
    const action = String(body.action ?? "");

    // ---- settings: demo account + sample files ----
    if (action === "save_settings") {
      if (typeof body.email === "string") await setSetting("demo_account_email", body.email.trim().slice(0, 200));
      if (typeof body.password === "string" && body.password) await setSetting("demo_account_password", body.password.slice(0, 200), true);
      for (const k of ["sample_video_url", "sample_image_url"] as const) {
        if (typeof body[k] === "string" && (body[k] === "" || body[k].startsWith(STORAGE_PREFIX))) await setSetting(`demo_${k}`, body[k]);
      }
      return NextResponse.json({ ok: true });
    }

    // ---- 1-4: plan steps from the walkthrough description ----
    if (action === "plan") {
      const description = String(body.description ?? "").trim().slice(0, 3000);
      const feature = DEMO_FEATURES.find((f) => f.id === body.feature);
      if (!description) return NextResponse.json({ error: "Describe the walkthrough first." }, { status: 400 });
      if (!feature?.available) return NextResponse.json({ error: "Choose a feature that's live." }, { status: 400 });
      const aspect: DemoAspect = body.aspect === "9:16" ? "9:16" : "16:9";
      const resolution: Resolution = body.resolution === "720p" ? "720p" : "1080p";
      const [claude, openai] = await Promise.all([getSetting("claude_api_key"), getSetting("openai_api_key")]);
      const plan = await structured<{ title: string; steps: DemoStep[]; voiceover_script: string }>({ claude, openai }, {
        name: "demo_plan", schema: PLAN_SCHEMA, system: PLAN_SYSTEM, effort: "medium",
        text: `Feature: ${feature.title} (module id ${feature.id})\nScreen: ${aspect === "9:16" ? "phone (mobile layout)" : "desktop"}\n\nWalkthrough:\n${description}`,
      });
      const steps = cleanSteps(plan.steps);
      const { data, error } = await supabase.from("demo_videos").insert({
        admin_id: admin.id, title: plan.title.slice(0, 120), feature: feature.id, description, steps, aspect, resolution,
        voice_script: plan.voiceover_script.slice(0, 4000),
      }).select("*").single();
      if (error) return NextResponse.json({ error: "Couldn't save the plan. Run supabase/demo_studio.sql first." }, { status: 500 });
      return NextResponse.json({ demo: data, estimate: estimateSeconds(steps) });
    }

    if (action === "get") {
      const demo = await loadDemo(body.demo_id);
      return demo ? NextResponse.json({ demo }) : NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (action === "update") {
      const demo = await loadDemo(body.demo_id);
      if (!demo) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const patch: Record<string, unknown> = {};
      if (Array.isArray(body.steps)) patch.steps = cleanSteps(body.steps);
      if (typeof body.title === "string") patch.title = body.title.slice(0, 120);
      if (typeof body.voice_script === "string") patch.voice_script = body.voice_script.slice(0, 4000);
      if (body.aspect === "16:9" || body.aspect === "9:16") patch.aspect = body.aspect;
      if (body.resolution === "1080p" || body.resolution === "720p") patch.resolution = body.resolution;
      return NextResponse.json({ demo: await updateDemo(demo.id, patch) });
    }

    // ---- 4: record ----
    if (action === "record") {
      const demo = await loadDemo(body.demo_id);
      if (!demo) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (!demo.steps.length) return NextResponse.json({ error: "Add at least one step." }, { status: 400 });
      const [key, enabled, email, password, sampleVideo, sampleImage, endpoint] = await Promise.all(
        ["browserless_api_key", "browserless_enabled", "demo_account_email", "demo_account_password", "demo_sample_video_url", "demo_sample_image_url", "browserless_endpoint"].map(getSetting));
      if (!key || enabled === "false") return NextResponse.json({ error: "Add a Browserless API key in Admin → AI Providers." }, { status: 503 });
      if (!email || !password) return NextResponse.json({ error: "Add the demo account email and password in Demo Studio settings." }, { status: 400 });

      const cost = await price(DEMO_PRICING.recording);
      const err = await charge(cost);
      if (err) return NextResponse.json({ error: err }, { status: 402 });
      refundOnError = cost;

      const { viewport } = demoSizes(demo.resolution, demo.aspect);
      const out = await recordWalkthrough({ apiKey: key, email, password, steps: demo.steps, viewport, samples: { video: sampleVideo || undefined, image: sampleImage || undefined }, endpoint: endpoint || undefined });

      // Keep the raw WebM when it fits storage; otherwise compress it to MP4 first
      let url: string;
      if (out.video.length <= SUPABASE_UPLOAD_LIMIT) {
        url = await upload(`demo-studio/${demo.id}/recording.webm`, out.video, "video/webm");
      } else {
        const ws = await workspace("demo-rec");
        try {
          await (await import("node:fs/promises")).writeFile(ws.file("rec.webm"), out.video);
          await runFfmpeg(["-i", ws.file("rec.webm"), "-c:v", "libx264", "-preset", "ultrafast", "-crf", "30", "-pix_fmt", "yuv420p", "-an", ws.file("rec.mp4")], 120_000);
          url = await upload(`demo-studio/${demo.id}/recording.mp4`, await readFile(ws.file("rec.mp4")), "video/mp4");
        } finally { await ws.cleanup(); }
      }
      refundOnError = 0;
      const failed = out.log.filter((l) => !l.ok).length;
      const saved = await updateDemo(demo.id, { recording_url: url, recording_seconds: Math.round(out.seconds * 10) / 10, step_log: out.log, status: "recorded", final_url: null, cost: demo.cost + cost, error: failed ? `${failed} step(s) didn't run` : null });
      return NextResponse.json({ demo: saved });
    }

    // ---- 5: polish ----
    if (action === "voiceover") {
      const demo = await loadDemo(body.demo_id);
      if (!demo) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const script = String(body.script ?? demo.voice_script ?? "").trim().slice(0, 4000);
      if (!script) return NextResponse.json({ error: "Write the voiceover script first." }, { status: 400 });
      const elKey = await getSetting("elevenlabs_api_key");
      if (!elKey) return NextResponse.json({ error: "Add an ElevenLabs API key in Admin → AI Providers." }, { status: 503 });
      const lang = ACTOR_SWAP_LANGUAGES.some((l) => l.code === body.language) ? String(body.language) : "en";
      const gender: VoiceGender = body.gender === "male" ? "male" : "female";
      const cost = await price(DEMO_PRICING.voiceover);
      const err = await charge(cost);
      if (err) return NextResponse.json({ error: err }, { status: 402 });
      refundOnError = cost;
      const { audio, alignment } = await speakWithTimestamps(elKey, script, lang, typeof body.accent === "string" ? body.accent.slice(0, 60) : null, gender);
      const url = await upload(`demo-studio/${demo.id}/voice-${Date.now()}.mp3`, audio, "audio/mpeg");
      const seconds = alignment?.ends.length ? alignment.ends[alignment.ends.length - 1] : 0;
      refundOnError = 0;
      const saved = await updateDemo(demo.id, { voice_script: script, voiceover_url: url, voiceover_seconds: seconds, voice_alignment: alignment, presenter_task: null, final_url: null, cost: demo.cost + cost });
      return NextResponse.json({ demo: saved });
    }

    if (action === "music") {
      const preset = MUSIC_PRESETS.find((p) => p.id === body.preset);
      if (!preset) return NextResponse.json({ error: "Choose a music preset." }, { status: 400 });
      const cached = await getSetting(`demo_music_${preset.id}`);
      if (cached) return NextResponse.json({ url: cached });
      const elKey = await getSetting("elevenlabs_api_key");
      if (!elKey) return NextResponse.json({ error: "Add an ElevenLabs API key in Admin → AI Providers." }, { status: 503 });
      const cost = await price(DEMO_PRICING.music);
      const err = await charge(cost);
      if (err) return NextResponse.json({ error: err }, { status: 402 });
      refundOnError = cost;
      // Generated once per preset and reused for every demo after that
      const res = await fetch("https://api.elevenlabs.io/v1/music", {
        method: "POST",
        headers: { "xi-api-key": elKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ prompt: preset.prompt, music_length_ms: 120_000, force_instrumental: true }),
      });
      if (!res.ok) { const e = await safeJson(res); throw new Error(e.detail?.message ?? (typeof e.detail === "string" ? e.detail : `ElevenLabs Music failed (${res.status})`)); }
      const url = await upload(`demo-studio/music/${preset.id}.mp3`, new Uint8Array(await res.arrayBuffer()), "audio/mpeg");
      await setSetting(`demo_music_${preset.id}`, url);
      refundOnError = 0;
      return NextResponse.json({ url });
    }

    if (action === "presenter") {
      const demo = await loadDemo(body.demo_id);
      if (!demo) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (!demo.voiceover_url) return NextResponse.json({ error: "Create the voiceover first: the presenter speaks it." }, { status: 400 });
      if (typeof body.avatar_id !== "string" || !body.avatar_id) return NextResponse.json({ error: "Choose a presenter." }, { status: 400 });
      const hgKey = await getSetting("heygen_api_key");
      if (!hgKey) return NextResponse.json({ error: "Add a HeyGen API key in Admin → AI Providers." }, { status: 503 });
      const cost = await price(DEMO_PRICING.presenter);
      const err = await charge(cost);
      if (err) return NextResponse.json({ error: err }, { status: 402 });
      refundOnError = cost;
      const res = await fetch("https://api.heygen.com/v3/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": hgKey, Accept: "application/json" },
        body: JSON.stringify({ type: "avatar", avatar_id: body.avatar_id, audio_url: demo.voiceover_url, aspect_ratio: "1:1", resolution: "720p", title: `KlipflowAI demo presenter ${demo.id}` }),
      });
      const data = await safeJson(res);
      const videoId = data.data?.video_id ?? data.video_id;
      if (!res.ok || !videoId) { const e = data.error; throw new Error((typeof e === "string" ? e : e?.message) ?? data.message ?? `HeyGen error (${res.status})`); }
      refundOnError = 0;
      const saved = await updateDemo(demo.id, { presenter_task: videoId, final_url: null, cost: demo.cost + cost });
      return NextResponse.json({ demo: saved, task_id: videoId, provider: "heygen_v3" });
    }

    if (action === "presenter_failed") {
      // HeyGen confirmed the presenter failed: give the tokens back once
      const demo = await loadDemo(body.demo_id);
      if (!demo?.presenter_task) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const st = await getTaskStatus(demo.presenter_task, "heygen_v3").catch(() => null);
      if (!st?.failed) return NextResponse.json({ error: "The presenter hasn't failed." }, { status: 409 });
      const cost = await price(DEMO_PRICING.presenter);
      await refund(cost);
      return NextResponse.json({ demo: await updateDemo(demo.id, { presenter_task: null, cost: Math.max(0, demo.cost - cost) }) });
    }

    // ---- render the final video ----
    if (action === "render") {
      const demo = await loadDemo(body.demo_id);
      if (!demo?.recording_url) return NextResponse.json({ error: "Record the walkthrough first." }, { status: 400 });
      const musicPreset = MUSIC_PRESETS.find((p) => p.id === body.music_preset);
      const musicUrl = musicPreset ? await getSetting(`demo_music_${musicPreset.id}`) : "";
      if (musicPreset && !musicUrl) return NextResponse.json({ error: "Prepare the music preset first." }, { status: 400 });
      let presenterUrl = "";
      if (body.presenter === true) {
        if (!demo.presenter_task) return NextResponse.json({ error: "Create the presenter first." }, { status: 400 });
        const st = await getTaskStatus(demo.presenter_task, "heygen_v3");
        if (!st.completed || !st.video_url) return NextResponse.json({ error: "The presenter is still rendering." }, { status: 409 });
        presenterUrl = st.video_url;
      }
      const useVoice = body.voiceover !== false && !!demo.voiceover_url;

      const ws = await workspace("demo-render");
      try {
        const ext = demo.recording_url.endsWith(".mp4") ? "mp4" : "webm";
        const rec = ws.file(`rec.${ext}`);
        await download(demo.recording_url, rec);
        const voice = useVoice ? ws.file("voice.mp3") : undefined;
        if (voice) await download(demo.voiceover_url!, voice);
        const music = musicUrl ? ws.file("music.mp3") : undefined;
        if (music) await download(musicUrl, music);
        const presenter = presenterUrl ? ws.file("presenter.mp4") : undefined;
        if (presenter) await download(presenterUrl, presenter);

        // WebM from the recorder often has no stored duration: use the measured length
        const recSeconds = demo.recording_seconds || (await mediaSeconds(rec)) || 30;
        const seconds = Math.min(300, Math.max(recSeconds, useVoice ? (demo.voiceover_seconds ?? 0) + 1 : 0));
        const captions = body.captions === true
          ? (useVoice && demo.voice_alignment ? captionsFromAlignment(demo.voice_alignment) : captionsEvenly(demo.voice_script ?? "", seconds))
          : [];
        const { output } = demoSizes(demo.resolution, demo.aspect);
        const final = ws.file("final.mp4");
        await renderDemo({ recording: rec, output: final, workdir: ws.file, width: output.width, height: output.height, seconds, voice, music, presenter, captions });
        const url = await upload(`demo-studio/${demo.id}/final-${Date.now()}.mp4`, await readFile(final), "video/mp4");
        const saved = await updateDemo(demo.id, { final_url: url, status: "rendered", music_preset: musicPreset?.id ?? null });
        return NextResponse.json({ demo: saved });
      } finally {
        await ws.cleanup();
      }
    }

    // ---- 6: save to the gallery (featuring uses /api/admin/generations, like Showcase Studio) ----
    if (action === "save") {
      const demo = await loadDemo(body.demo_id);
      if (!demo?.final_url) return NextResponse.json({ error: "Render the video first." }, { status: 400 });
      const feature = DEMO_FEATURES.find((f) => f.id === demo.feature);
      const { output } = demoSizes(demo.resolution, demo.aspect);
      const { data, error } = await supabase.from("generations").insert({
        user_id: admin.id,
        type: "demo_video",
        prompt: demo.title,
        video_url: demo.final_url,
        output_type: "video",
        status: "completed",
        tokens_used: demo.cost,
        duration: String(Math.round(demo.recording_seconds ?? 0)),
        aspect_ratio: demo.aspect,
        // "Use this" on the homepage reads the tool from this label
        model: `Demo Studio · ${feature?.title ?? demo.feature}`,
        provider: "demo_studio",
        created_at: new Date().toISOString(),
      }).select("id").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const saved = await updateDemo(demo.id, { generation_id: String(data.id) });
      return NextResponse.json({ demo: saved, generation_id: data.id, size: output });
    }

    if (action === "delete") {
      if (typeof body.demo_id !== "string") return NextResponse.json({ error: "Not found" }, { status: 404 });
      await supabase.from("demo_videos").delete().eq("id", body.demo_id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    if (refundOnError) await refund(refundOnError).catch(() => {});
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Demo studio error:", error);
    return NextResponse.json({ error: message + (refundOnError ? " Tokens refunded." : "") }, { status: 500 });
  }
}
