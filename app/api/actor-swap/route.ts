import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { attachTask, claimCharge, getTokenPrice, refundCharge, releaseClaim } from "../../lib/charges";
import { getTaskStatus } from "../../lib/task-status";
import { transcribeVideoUrl } from "../../lib/whisper";
import { speak } from "../../lib/elevenlabs";
import { mediaSeconds } from "../../lib/server-ffmpeg";
import {
  ACTOR_SWAP_LANGUAGES, ACTOR_SWAP_MAX_SECONDS, BACKGROUND_PRESETS, actorSwapCost, chunkCount, voicePortion,
  type ActorSwapChoices, type ActorSwapRates, type BackgroundMode, type VoiceGender,
} from "../../lib/actor-swap";

// Each "advance" tick does at most one slow step (Whisper, Claude or ElevenLabs)
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STORAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/generation-inputs/`;
const RUNWAY_BASE = "https://api.dev.runwayml.com/v1";
const JOB_TIMEOUT_MS = 40 * 60 * 1000;

// ---------------------------------------------------------------- types

interface Options {
  source_url: string;
  source_seconds: number;
  width: number;
  height: number;
  chunk_urls: string[];
  audio_url: string | null;
  change_face: boolean;
  change_voice: boolean;
  reference_url: string | null;
  background: { mode: BackgroundMode; preset_id?: string; description?: string; image_url?: string };
  language_code: string | null;
  accent: string | null;
  gender: VoiceGender;
}

type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";
interface Chunk { src: string; status: StepStatus; task_id?: string; output?: string; stored?: string; error?: string }
interface State {
  compose: { status: StepStatus; task_id?: string; url?: string };
  face: { status: StepStatus; chunks: Chunk[] };
  voice: { status: StepStatus; step?: "transcribe" | "translate" | "tts"; transcript?: string; script?: string; audio_url?: string; error?: string };
  stitch: { status: "pending" | "needed" | "done" | "skipped"; purpose?: "lipsync" | "final"; with_audio?: boolean; clips?: string[]; url?: string };
  lipsync: { status: StepStatus; task_id?: string; url?: string; error?: string };
}
interface Job {
  id: string;
  user_id: string;
  charge_id: string;
  status: "running" | "needs_stitch" | "done" | "partial" | "failed";
  options: Options;
  state: State;
  cost: number;
  refunded: number;
  result_url: string | null;
  error: string | null;
  created_at: string;
}

// ---------------------------------------------------------------- helpers

async function getSetting(key: string): Promise<string> {
  const { data } = await supabase.from("admin_settings").select("value").eq("key", key).single();
  return data?.value ?? "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider responses are untyped
async function safeJson(res: Response): Promise<any> {
  try { const t = await res.text(); return t ? JSON.parse(t) : {}; } catch { return {}; }
}

async function getRates(): Promise<ActorSwapRates> {
  const [language, face, full, background] = await Promise.all([
    getTokenPrice("actor_swap_language", 30), getTokenPrice("actor_swap_face", 50),
    getTokenPrice("actor_swap_full", 80), getTokenPrice("actor_swap_background", 20),
  ]);
  return { language, face, full, background };
}

const choicesOf = (o: Options): ActorSwapChoices => ({ changeFace: o.change_face, changeVoice: o.change_voice, background: o.background.mode });
const ours = (u: unknown): u is string => typeof u === "string" && u.startsWith(STORAGE_PREFIX);
const actRatio = (w: number, h: number) => (w > h * 1.2 ? "1280:720" : h > w * 1.2 ? "720:1280" : "960:960");
const imageAspect = (w: number, h: number) => (w > h * 1.2 ? "3:2" : h > w * 1.2 ? "2:3" : "1:1");

async function saveJob(job: Job, patch: Partial<Job>) {
  Object.assign(job, patch);
  await supabase.from("actor_swap_jobs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", job.id);
}

async function copyToStorage(url: string, path: string, contentType: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't download generated media (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const { error } = await supabase.storage.from("generation-inputs").upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return supabase.storage.from("generation-inputs").getPublicUrl(path).data.publicUrl;
}

async function cancelRunwayTasks(job: Job) {
  const key = await getSetting("runway_api_key");
  if (!key) return;
  await Promise.all(job.state.face.chunks.filter((c) => c.status === "running" && c.task_id).map((c) =>
    fetch(`${RUNWAY_BASE}/tasks/${c.task_id}`, { method: "DELETE", headers: { Authorization: `Bearer ${key}`, "X-Runway-Version": "2024-11-06" } }).catch(() => null)));
}

// Full refund of whatever remains on the charge, job marked failed
async function failJob(job: Job, message: string) {
  await cancelRunwayTasks(job);
  const refund = await refundCharge(job.charge_id, job.user_id);
  await saveJob(job, { status: "failed", error: message, refunded: job.refunded + (refund.refunded ?? 0) });
}

// Face delivered, voice part failed: refund only the voice portion
async function finishPartial(job: Job, url: string) {
  const amount = voicePortion(choicesOf(job.options), await getRates(), job.options.source_seconds);
  let refunded = 0;
  if (amount > 0) {
    const r = await refundCharge(job.charge_id, job.user_id, Math.min(amount, job.cost - job.refunded));
    refunded = r.refunded ?? 0;
  }
  await saveJob(job, { status: "partial", result_url: url, refunded: job.refunded + refunded, error: job.state.voice.error ?? job.state.lipsync.error ?? "Voice step failed" });
}

// ---------------------------------------------------------------- steps

async function stepCompose(job: Job) {
  const s = job.state.compose;
  const o = job.options;
  if (s.status === "pending") {
    const key = await getSetting("kie_api_key");
    if (!key) throw new Error("Image editing isn't configured.");
    const keep = "Keep the person's face, identity, hair, skin tone, body and clothing exactly the same. Photorealistic, natural lighting that matches the new setting. Medium shot, facing the camera, face clearly visible.";
    const preset = BACKGROUND_PRESETS.find((p) => p.id === o.background.preset_id);
    const prompt = o.background.mode === "upload"
      ? `Place the person from the first image into the scene shown in the second image. ${keep}`
      : `Place the person from the image into ${o.background.mode === "preset" ? preset?.prompt ?? "a clean studio" : o.background.description}. ${keep}`;
    const input_urls = o.background.mode === "upload" && o.background.image_url ? [o.reference_url, o.background.image_url] : [o.reference_url];
    const res = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "gpt-image/1.5-image-to-image", input: { prompt, input_urls, aspect_ratio: imageAspect(o.width, o.height), quality: "medium" } }),
    });
    const data = await safeJson(res);
    const taskId = data.data?.taskId ?? data.data?.task_id;
    if (data.code !== 200 || !taskId) throw new Error(data.msg ?? "Couldn't start the background edit.");
    s.status = "running"; s.task_id = taskId;
    return;
  }
  if (s.status === "running" && s.task_id) {
    const st = await getTaskStatus(s.task_id, "kie");
    if (st.completed && st.video_url) { s.status = "done"; s.url = st.video_url; }
    else if (st.failed) throw new Error(st.fail_reason ?? "Background edit failed.");
  }
}

async function stepFace(job: Job) {
  const f = job.state.face;
  const o = job.options;
  const key = await getSetting("runway_api_key");
  if (!key) throw new Error("Face swap isn't configured.");
  const character = job.state.compose.url ?? o.reference_url!;

  for (let i = 0; i < f.chunks.length; i++) {
    const c = f.chunks[i];
    if (c.status === "pending") {
      const res = await fetch(`${RUNWAY_BASE}/character_performance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Runway-Version": "2024-11-06" },
        body: JSON.stringify({
          model: "act_two",
          character: { type: "image", uri: character },
          reference: { type: "video", uri: c.src },
          ratio: actRatio(o.width, o.height),
          bodyControl: true,
          expressionIntensity: 3,
        }),
      });
      const data = await safeJson(res);
      if (res.status === 429) continue;            // concurrency limit: retry next tick
      if (!res.ok || !data.id) throw new Error(data.error ?? `Face swap couldn't start (${res.status}).`);
      c.status = "running"; c.task_id = data.id;
    } else if (c.status === "running" && c.task_id) {
      const st = await getTaskStatus(c.task_id, "runway");
      if (st.completed && st.video_url) { c.status = "done"; c.output = st.video_url; }
      else if (st.failed) throw new Error(st.fail_reason ?? `Face swap failed on part ${i + 1}.`);
    }
  }

  // Copy one finished chunk per tick into our storage so the browser can join them
  const toCopy = f.chunks.findIndex((c) => c.status === "done" && !c.stored);
  if (toCopy >= 0) {
    f.chunks[toCopy].stored = await copyToStorage(f.chunks[toCopy].output!, `actor-swap/${job.id}/face-${toCopy}.mp4`, "video/mp4");
  }
  if (f.chunks.every((c) => c.status === "done" && c.stored)) f.status = "done";
  else f.status = "running";
}

const TRANSLATE_SCHEMA = {
  type: "object",
  properties: { script: { type: "string", description: "The spoken script in the target language and accent" } },
  required: ["script"],
  additionalProperties: false,
};

async function translateScript(transcript: string, o: Options): Promise<string> {
  const lang = ACTOR_SWAP_LANGUAGES.find((l) => l.code === o.language_code)?.name ?? "English";
  const words = Math.max(8, Math.round((o.source_seconds / 60) * 140));
  const system = `You adapt spoken video scripts into another language and accent for AI voiceover.
Rules:
- Keep the meaning, tone and energy of the original. Adapt idioms and references so they sound natural to a native speaker, never a word-for-word translation.
- Reflect the requested accent through natural word choice and phrasing used by people from that region, not caricature or phonetic spelling.
- About ${words} words, so it fits a ${Math.round(o.source_seconds)}-second video.
- Output only the words to be spoken: no stage directions, labels or emojis.`;
  const user = `Target language: ${lang}\nAccent / region: ${o.accent ?? "standard"}\nSpeaker: ${o.gender}\n\nOriginal transcript:\n${transcript || "(no clear speech; write a short, friendly line that fits a person talking to camera)"}`;

  const [claudeKey, openaiKey] = await Promise.all([getSetting("claude_api_key"), getSetting("openai_api_key")]);
  if (claudeKey) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": claudeKey, "anthropic-version": "2023-06-01", "anthropic-beta": "server-side-fallback-2026-07-01" },
      body: JSON.stringify({
        model: "claude-opus-5-5", max_tokens: 16000, fallbacks: "default",
        output_config: { effort: "low", format: { type: "json_schema", schema: TRANSLATE_SCHEMA } },
        system, messages: [{ role: "user", content: user }],
      }),
    });
    const data = await safeJson(res);
    const text = res.ok && data.stop_reason !== "refusal" ? (data.content ?? []).find((b: { type: string }) => b.type === "text")?.text : null;
    if (text) return JSON.parse(text).script;
    if (!openaiKey) throw new Error(data.error?.message ?? "Translation failed.");
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: { type: "json_schema", json_schema: { name: "voice_script", strict: true, schema: TRANSLATE_SCHEMA } },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  const data = await safeJson(res);
  const text = data.choices?.[0]?.message?.content;
  if (!res.ok || !text) throw new Error(data.error?.message ?? "Translation failed.");
  return JSON.parse(text).script;
}

async function stepVoice(job: Job) {
  const v = job.state.voice;
  const o = job.options;
  if (v.status === "pending") v.status = "running";
  if (!v.step || v.step === "transcribe") {
    const key = await getSetting("openai_api_key");
    if (!key) throw new Error("Transcription isn't configured.");
    const t = await transcribeVideoUrl(key, o.audio_url!);
    v.transcript = t.text; v.step = "translate";
    return;
  }
  if (v.step === "translate") {
    v.script = await translateScript(v.transcript ?? "", o);
    v.step = "tts";
    return;
  }
  if (v.step === "tts") {
    const key = await getSetting("elevenlabs_api_key");
    if (!key) throw new Error("Voice generation isn't configured.");
    const bytes = await speak(key, v.script!, o.language_code ?? "en", o.accent, o.gender);
    const path = `actor-swap/${job.id}/voice.mp3`;
    const { error } = await supabase.storage.from("generation-inputs").upload(path, bytes, { contentType: "audio/mpeg", upsert: true });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    v.audio_url = supabase.storage.from("generation-inputs").getPublicUrl(path).data.publicUrl;
    v.status = "done";
  }
}

// HeyGen Lipsync (same API key as Video Translation): re-times the mouth on
// the video to the new ElevenLabs voice
async function stepLipsync(job: Job, videoUrl: string) {
  const l = job.state.lipsync;
  const key = await getSetting("heygen_api_key");
  if (!key) throw new Error("Lip sync isn't configured.");
  const headers = { "Content-Type": "application/json", "x-api-key": key, Accept: "application/json" };
  if (l.status === "pending") {
    const res = await fetch("https://api.heygen.com/v3/lipsyncs", {
      method: "POST",
      headers,
      body: JSON.stringify({
        video: { type: "url", url: videoUrl },
        audio: { type: "url", url: job.state.voice.audio_url },
        mode: "speed",
        title: `KlipflowAI actor swap ${job.id}`,
      }),
    });
    const data = await safeJson(res);
    if (res.status === 429) return;            // rate limited: retry next tick
    const id = data.data?.lipsync_id ?? data.lipsync_id;
    if (!res.ok || !id) {
      const err = data.error;
      throw new Error((typeof err === "string" ? err : err?.message) ?? data.message ?? `Lip sync couldn't start (${res.status}).`);
    }
    l.status = "running"; l.task_id = id;
    return;
  }
  if (l.status === "running" && l.task_id) {
    const res = await fetch(`https://api.heygen.com/v3/lipsyncs/${l.task_id}`, { headers });
    const raw = await safeJson(res);
    const data = raw.data ?? raw;
    if (data.status === "completed" && data.video_url) { l.status = "done"; l.url = data.video_url; }
    else if (data.status === "failed") throw new Error(data.failure_message ?? "Lip sync failed.");
  }
}

// ---------------------------------------------------------------- orchestration

async function advance(job: Job) {
  if (job.status !== "running") return;
  if (Date.now() - new Date(job.created_at).getTime() > JOB_TIMEOUT_MS) { await failJob(job, "This took too long, so it was stopped."); return; }
  const s = job.state;
  const o = job.options;

  // 1. Background, then face (fast polling work)
  try {
    if (s.compose.status === "pending" || s.compose.status === "running") await stepCompose(job);
    else if (s.face.status === "pending" || s.face.status === "running") await stepFace(job);
  } catch (e) {
    await failJob(job, e instanceof Error ? e.message : "Face swap failed.");
    return;
  }

  // 2. One voice step (the slow ones)
  if (s.voice.status === "pending" || s.voice.status === "running") {
    try { await stepVoice(job); }
    catch (e) {
      s.voice.status = "failed"; s.voice.error = e instanceof Error ? e.message : "Voice step failed.";
      if (!o.change_face) { await saveJob(job, { state: s }); await failJob(job, s.voice.error); return; }
    }
  }

  const faceReady = !o.change_face || s.face.status === "done";
  if (!faceReady) { await saveJob(job, { state: s }); return; }

  // 3. Face done: decide whether the browser needs to join clips
  const clips = s.face.chunks.map((c) => c.stored!).filter(Boolean);
  if (o.change_face && s.stitch.status === "pending") {
    if (!o.change_voice || s.voice.status === "failed") {
      s.stitch = { status: "needed", purpose: "final", with_audio: true, clips };
    } else if (clips.length > 1) {
      s.stitch = { status: "needed", purpose: "lipsync", with_audio: false, clips };
    } else {
      s.stitch = { status: "skipped", url: clips[0] };
    }
    if (s.stitch.status === "needed") { await saveJob(job, { state: s, status: "needs_stitch" }); return; }
  }

  // 4. Lip sync once the voice and the video to sync are ready
  if (o.change_voice && s.voice.status === "done") {
    const videoUrl = o.change_face ? s.stitch.url! : o.source_url;
    try {
      await stepLipsync(job, videoUrl);
      if (s.lipsync.status === "done") {
        const final = await copyToStorage(s.lipsync.url!, `actor-swap/${job.id}/final.mp4`, "video/mp4").catch(() => s.lipsync.url!);
        await saveJob(job, { state: s, status: "done", result_url: final });
        return;
      }
    } catch (e) {
      s.lipsync.status = "failed"; s.lipsync.error = e instanceof Error ? e.message : "Lip sync failed.";
      if (!o.change_face) { await saveJob(job, { state: s }); await failJob(job, s.lipsync.error); return; }
      // Face still delivered, with its original voice
      s.stitch = { status: "needed", purpose: "final", with_audio: true, clips };
      await saveJob(job, { state: s, status: "needs_stitch" });
      return;
    }
  }
  await saveJob(job, { state: s });
}

function publicView(job: Job) {
  const s = job.state;
  return {
    id: job.id,
    status: job.status,
    cost: job.cost,
    refunded: job.refunded,
    result_url: job.result_url,
    error: job.error,
    steps: {
      compose: s.compose.status,
      face: s.face.status,
      face_done: s.face.chunks.filter((c) => c.status === "done").length,
      face_total: s.face.chunks.length,
      voice: s.voice.status,
      voice_step: s.voice.step ?? null,
      stitch: s.stitch.status,
      lipsync: s.lipsync.status,
    },
    stitch: job.status === "needs_stitch" ? { clips: s.stitch.clips ?? [], with_audio: !!s.stitch.with_audio, audio_from: job.options.source_url } : null,
    script: s.voice.script ?? null,
  };
}

// ---------------------------------------------------------------- handler

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- validated field by field below
    const body = await req.json() as Record<string, any>;
    const action = body.action as string;

    if ((await getSetting("ai_actor_swap_enabled")) !== "true") {
      return NextResponse.json({ error: "AI Actor Swap isn't available right now." }, { status: 403 });
    }

    // ---- start a job (requires a paid charge covering the server-side price) ----
    if (action === "start") {
      let seconds = Number(body.source_seconds);
      const changeFace = body.change_face === true;
      const changeVoice = body.change_voice === true;
      const bgMode: BackgroundMode = ["model", "upload", "preset", "describe"].includes(body.background?.mode) ? body.background.mode : "model";
      if (!changeFace && !changeVoice) return NextResponse.json({ error: "Choose what to change." }, { status: 400 });
      if (!Number.isFinite(seconds) || seconds <= 0 || seconds > ACTOR_SWAP_MAX_SECONDS + 0.5) return NextResponse.json({ error: "Video must be 2 minutes or shorter." }, { status: 400 });
      if (!ours(body.source_url)) return NextResponse.json({ error: "Upload the source video." }, { status: 400 });
      // Bill on the duration the server measures (never less than the browser reported)
      const measured = await mediaSeconds(body.source_url).catch(() => 0);
      if (measured > ACTOR_SWAP_MAX_SECONDS + 1) return NextResponse.json({ error: "Video must be 2 minutes or shorter." }, { status: 400 });
      const chunks: string[] = Array.isArray(body.chunk_urls) ? body.chunk_urls : [];
      if (changeFace) {
        if (!ours(body.reference_url)) return NextResponse.json({ error: "Upload a photo of the new person." }, { status: 400 });
        if (chunks.length !== chunkCount(seconds) || !chunks.every(ours)) return NextResponse.json({ error: "Video parts are missing. Please try again." }, { status: 400 });
        if (bgMode === "upload" && !ours(body.background?.image_url)) return NextResponse.json({ error: "Upload the background image." }, { status: 400 });
        if (bgMode === "describe" && !String(body.background?.description ?? "").trim()) return NextResponse.json({ error: "Describe the background." }, { status: 400 });
      }
      if (changeVoice) {
        if (!ours(body.audio_url)) return NextResponse.json({ error: "Audio is missing. Please try again." }, { status: 400 });
        if (!ACTOR_SWAP_LANGUAGES.some((l) => l.code === body.language_code)) return NextResponse.json({ error: "Choose a language." }, { status: 400 });
      }
      const needs = [changeFace && "runway_api_key", changeVoice && "elevenlabs_api_key", changeVoice && "heygen_api_key", changeVoice && "openai_api_key"].filter(Boolean) as string[];
      for (const k of needs) if (!(await getSetting(k))) return NextResponse.json({ error: "This option isn't configured yet." }, { status: 503 });

      if (measured > seconds + 1) seconds = measured;
      const options: Options = {
        source_url: body.source_url, source_seconds: seconds, width: Number(body.width) || 1280, height: Number(body.height) || 720,
        chunk_urls: changeFace ? chunks : [], audio_url: changeVoice ? body.audio_url : null,
        change_face: changeFace, change_voice: changeVoice, reference_url: changeFace ? body.reference_url : null,
        background: {
          mode: changeFace ? bgMode : "model",
          preset_id: typeof body.background?.preset_id === "string" ? body.background.preset_id : undefined,
          description: typeof body.background?.description === "string" ? body.background.description.slice(0, 400) : undefined,
          image_url: ours(body.background?.image_url) ? body.background.image_url : undefined,
        },
        language_code: changeVoice ? body.language_code : null,
        accent: changeVoice && typeof body.accent === "string" ? body.accent.slice(0, 60) : null,
        gender: body.gender === "male" ? "male" : "female",
      };
      const cost = actorSwapCost(choicesOf(options), await getRates(), seconds);
      const claim = await claimCharge(body.charge_id, cost, user.id);
      if (claim.error) return NextResponse.json({ error: claim.error }, { status: 402 });

      const state: State = {
        compose: { status: changeFace && options.background.mode !== "model" ? "pending" : "skipped" },
        face: { status: changeFace ? "pending" : "skipped", chunks: options.chunk_urls.map((src) => ({ src, status: "pending" as StepStatus })) },
        voice: { status: changeVoice ? "pending" : "skipped" },
        stitch: { status: changeFace ? "pending" : "skipped" },
        lipsync: { status: changeVoice ? "pending" : "skipped" },
      };
      const { data: row, error } = await supabase.from("actor_swap_jobs")
        .insert({ user_id: user.id, charge_id: body.charge_id, options, state, cost })
        .select("*").single();
      if (error || !row) {
        console.error("actor_swap_jobs insert:", error);
        await releaseClaim(body.charge_id);
        return NextResponse.json({ error: "Couldn't start the job. Run supabase/actor_swap.sql if this persists." }, { status: 500 });
      }
      await attachTask(body.charge_id, `job:${row.id}`, "actor_swap");
      return NextResponse.json({ job: publicView(row as Job) });
    }

    // ---- everything else acts on an existing job owned by the caller ----
    if (typeof body.job_id !== "string") return NextResponse.json({ error: "job_id is required" }, { status: 400 });
    const { data } = await supabase.from("actor_swap_jobs").select("*").eq("id", body.job_id).eq("user_id", user.id).maybeSingle();
    if (!data) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    const job = data as Job;

    if (action === "advance") {
      await advance(job);
      return NextResponse.json({ job: publicView(job) });
    }

    if (action === "stitched") {
      if (job.status !== "needs_stitch") return NextResponse.json({ job: publicView(job) });
      if (!ours(body.url)) return NextResponse.json({ error: "Invalid video" }, { status: 400 });
      const s = job.state;
      if (s.stitch.purpose === "lipsync") {
        s.stitch = { ...s.stitch, status: "done", url: body.url };
        await saveJob(job, { state: s, status: "running" });
      } else if (job.options.change_voice) {
        s.stitch = { ...s.stitch, status: "done", url: body.url };
        job.state = s;
        await finishPartial(job, body.url);
      } else {
        s.stitch = { ...s.stitch, status: "done", url: body.url };
        await saveJob(job, { state: s, status: "done", result_url: body.url });
      }
      return NextResponse.json({ job: publicView(job) });
    }

    if (action === "stitch_failed" || action === "abort") {
      if (job.status === "running" || job.status === "needs_stitch") {
        await failJob(job, action === "abort" ? "Cancelled." : "Couldn't join the video parts in your browser.");
      }
      return NextResponse.json({ job: publicView(job) });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Actor swap error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

