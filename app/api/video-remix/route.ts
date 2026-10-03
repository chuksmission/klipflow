import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TranscriptionError, transcribeVideoUrl } from "../../lib/whisper";
import { readFile } from "node:fs/promises";
import { attachTask, claimCharge, getCharge, getTokenPrice, isChargeId, refundCharge, releaseClaim } from "../../lib/charges";
import { perSecondCost } from "../../lib/duration-pricing";
import { download, mediaSeconds, probeMedia, runFfmpeg, workspace } from "../../lib/server-ffmpeg";
import { getTaskStatus } from "../../lib/task-status";
import { aspectForSize, nanoBananaTask } from "../../lib/kie-image";
import { getPrediction, modelInfo, outputUrl, startPrediction, uriField } from "../../lib/replicate";

// Transcription and the rewrite call take 10-40s; the background composite
// (Actor Swap with the original background) renders up to 30s of video
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RUNWAY_BASE = "https://api.dev.runwayml.com/v1";
const RUNWAY_VERSION = "2024-11-06";
// Only videos uploaded to our own storage are fetched server-side (no arbitrary URLs)
const STORAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/generation-inputs/`;

async function getSetting(key: string): Promise<string> {
  const { data } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", key)
    .single();
  return data?.value ?? "";
}

async function safeJson(response: Response): Promise<any> {
  try {
    const text = await response.text();
    if (!text || text.trim() === "") return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}

const MODE_TOGGLES: Record<string, string> = {
  restyle: "video_remix_restyle_enabled",
  transcribe: "video_remix_recreate_enabled",
  rewrite: "video_remix_recreate_enabled",
  actor_swap: "video_remix_actor_swap_enabled",
  actor_swap_start: "video_remix_actor_swap_enabled",
  bg_restore: "video_remix_actor_swap_enabled",
};

async function modeEnabled(action: string): Promise<boolean> {
  const toggle = MODE_TOGGLES[action];
  if (!toggle) return true;
  const [moduleOn, modeOn] = await Promise.all([getSetting("video_remix_enabled"), getSetting(toggle)]);
  return moduleOn === "true" && modeOn === "true";
}

function runwayHeaders(key: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Runway-Version": RUNWAY_VERSION };
}

function runwayError(data: any, status: number) {
  const issue = Array.isArray(data.issues) && data.issues[0]?.message ? `: ${data.issues[0].message}` : "";
  return (data.error ?? `Runway error (${status})`) + issue;
}

// ---------------------------------------------------------------- recreate (rewrite)

const REWRITE_SCHEMA = {
  type: "object",
  properties: {
    original: {
      type: "object",
      properties: {
        hook: { type: "string", description: "What the first 3 seconds do" },
        structure: { type: "array", items: { type: "string" }, description: "The beats of the video in order, one short line each" },
        style: { type: "string", description: "Visual style, pacing and tone" },
      },
      required: ["hook", "structure", "style"],
      additionalProperties: false,
    },
    title: { type: "string" },
    script: { type: "string", description: "Full spoken script for the new video, in order" },
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          visual_prompt: { type: "string", description: "Self-contained AI video prompt, 30-80 words" },
          voiceover: { type: "string" },
        },
        required: ["visual_prompt", "voiceover"],
        additionalProperties: false,
      },
    },
    main_visual_prompt: { type: "string", description: "The single best prompt to generate one clip that captures the new video, 40-90 words" },
  },
  required: ["original", "title", "script", "scenes", "main_visual_prompt"],
  additionalProperties: false,
};

const REWRITE_SYSTEM = `You help creators make an original video inspired by an existing one. You study the source video's structure, then write a brand-new video with the same structure and pacing but completely new words, story and visuals.

Rules:
- Keep the structural beats and rhythm of the source; change everything else.
- Never reuse distinctive phrases, names, brands, products or characters from the source.
- If the creator gives a topic or product, the new video is about that. Otherwise pick a fresh topic in the same niche.
- Sound natural and human, never robotic.
- Never invent statistics, testimonials or claims about real people or companies.
- All people in the new video are original and fictional. Never describe or imitate real or identifiable people, including the people in the source.
- Each visual_prompt stands alone as an AI video prompt (subject, action, setting, lighting, camera), with no on-screen text or logos.
- Match the source length: roughly the same number of scenes and spoken words.`;

type Frame = { time: number; data_url: string };

async function rewriteWithClaude(apiKey: string, userText: string, frames: Frame[]) {
  const images = frames.map((f) => {
    const [meta, b64] = f.data_url.split(",");
    const media_type = meta.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
    return { type: "image", source: { type: "base64", media_type, data: b64 } };
  });
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "server-side-fallback-2026-07-01",
    },
    body: JSON.stringify({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium", format: { type: "json_schema", schema: REWRITE_SCHEMA } },
      fallbacks: "default",
      system: REWRITE_SYSTEM,
      messages: [{ role: "user", content: [...images, { type: "text", text: userText }] }],
    }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error?.message ?? `Claude request failed (${res.status})`);
  if (data.stop_reason === "refusal") throw new Error("This video couldn't be remixed. Try a different video.");
  const text = (data.content ?? []).find((b: { type: string }) => b.type === "text")?.text;
  if (!text) throw new Error("No response from Claude");
  return JSON.parse(text);
}

async function rewriteWithOpenAI(apiKey: string, userText: string, frames: Frame[]) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: { type: "json_schema", json_schema: { name: "video_recreate", strict: true, schema: REWRITE_SCHEMA } },
      messages: [
        { role: "system", content: REWRITE_SYSTEM },
        { role: "user", content: [{ type: "text", text: userText }, ...frames.map((f) => ({ type: "image_url", image_url: { url: f.data_url, detail: "low" } }))] },
      ],
    }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error?.message ?? `OpenAI request failed (${res.status})`);
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(data.choices?.[0]?.message?.refusal ?? "No response from OpenAI");
  return JSON.parse(text);
}

// ---------------------------------------------------------------- actor swap: original background

// Places the uploaded performer into the source video's opening frame
const PLACE_PROMPT = `Image 1 is the opening frame of a video. Image 2 is a photo of a different person. Replace the person in image 1 with the person from image 2: their face, hair, skin tone, body and clothing come from image 2, in exactly the same position, pose, framing, scale and camera angle as the person in image 1. Keep everything else from image 1 exactly as it is: the background, room, props, objects, food, lighting and colours. Photorealistic, seamless, no added text.`;

const REPLICATE_MATTE = "arielreplicate/robust_video_matting";
const REPLICATE_INPAINT = "jd7h/propainter";
// Matting, inpainting and the composite together must finish in this window
const RESTORE_MAX_MS = 9 * 60 * 1000;

interface BgState {
  started_at?: number;
  src_mask?: string; src_mask_url?: string;
  new_mask?: string; new_mask_url?: string;
  clean?: string; clean_url?: string;
}

async function bgPreserveAvailable(): Promise<boolean> {
  const [on, kie] = await Promise.all([getSetting("remix_bg_preserve_enabled"), getSetting("kie_api_key")]);
  return on === "true" && !!kie;
}

async function copyToStorage(url: string, path: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const { error } = await supabase.storage.from("generation-inputs").upload(path, bytes, { contentType: res.headers.get("content-type") ?? "application/octet-stream", upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return supabase.storage.from("generation-inputs").getPublicUrl(path).data.publicUrl;
}

/** First clear frame of a stored video, saved as a PNG in our storage. */
async function openingFrame(videoUrl: string, id: string): Promise<string> {
  const ws = await workspace("remix-frame");
  try {
    const out = ws.file("frame.png");
    await runFfmpeg(["-ss", "0.15", "-i", videoUrl, "-frames:v", "1", out], 45_000);
    const { error } = await supabase.storage.from("generation-inputs").upload(`video-remix/${id}-frame.png`, await readFile(out), { contentType: "image/png", upsert: true });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    return supabase.storage.from("generation-inputs").getPublicUrl(`video-remix/${id}-frame.png`).data.publicUrl;
  } finally {
    await ws.cleanup();
  }
}

async function startActTwo(key: string, characterUrl: string, body: { character_type?: string; video_url?: string; ratio?: string; body_control?: boolean; expression_intensity?: number }, forceImage = false): Promise<{ id: string } | { error: string }> {
  const ratio = ["1280:720", "720:1280", "960:960", "1104:832", "832:1104", "1584:672"].includes(body.ratio ?? "") ? body.ratio : "1280:720";
  const res = await fetch(`${RUNWAY_BASE}/character_performance`, {
    method: "POST",
    headers: runwayHeaders(key),
    body: JSON.stringify({
      model: "act_two",
      // The new performer (or the source frame with them placed in it)...
      character: { type: body.character_type === "video" && !forceImage ? "video" : "image", uri: characterUrl },
      // ...performs what the person in the source video does
      reference: { type: "video", uri: body.video_url },
      ratio,
      bodyControl: body.body_control !== false,
      expressionIntensity: Math.min(5, Math.max(1, Math.round(body.expression_intensity ?? 3))),
    }),
  });
  const data = await safeJson(res);
  console.log("Runway character_performance:", res.status, JSON.stringify(data));
  if (!res.ok || !data.id) return { error: runwayError(data, res.status) };
  return { id: data.id };
}

async function matteInput(key: string, video: string) {
  const info = await modelInfo(key, REPLICATE_MATTE);
  const field = uriField(info, /video/i) ?? "input_video";
  const input: Record<string, unknown> = { [field]: video };
  // Ask for the alpha matte (white = person) rather than a green-screen render
  for (const [name, values] of Object.entries(info.enums)) {
    const alpha = values.find((v) => typeof v === "string" && /alpha/i.test(v));
    if (alpha) input[name] = alpha;
  }
  return { version: info.version, input };
}

async function inpaintInput(key: string, video: string, mask: string) {
  const info = await modelInfo(key, REPLICATE_INPAINT);
  const videoField = uriField(info, /video/i, /mask/i);
  const maskField = uriField(info, /mask/i);
  if (!videoField || !maskField) throw new Error("The inpainting model's inputs changed.");
  const input: Record<string, unknown> = { [videoField]: video, [maskField]: mask };
  if (info.input.fp16?.type === "boolean") input.fp16 = true;
  if (info.input.resize_ratio?.type === "number") input.resize_ratio = 0.5;
  return { version: info.version, input };
}

/** Polls one prediction; returns its output URL once it has one. */
async function predictionUrl(key: string, id: string): Promise<string | null> {
  const p = await getPrediction(key, id);
  if (p.status === "failed" || p.status === "canceled") throw new Error(p.error ?? "Prediction failed");
  return p.status === "succeeded" ? outputUrl(p.output, /alpha|mask|\.mp4/i) : null;
}

// One step of: matte the original actor and the new one, inpaint the original
// actor out of the source (a clean plate), then composite.
async function advanceRestore(key: string, sourceUrl: string, resultUrl: string, prev: BgState, id: string) {
  const s: BgState = { ...prev, started_at: prev.started_at ?? Date.now() };
  if (Date.now() - s.started_at! > RESTORE_MAX_MS) return { done: true, url: resultUrl, restored: false };

  if (!s.src_mask) { const m = await matteInput(key, sourceUrl); s.src_mask = (await startPrediction(key, m.version, m.input)).id; }
  if (!s.new_mask) { const m = await matteInput(key, resultUrl); s.new_mask = (await startPrediction(key, m.version, m.input)).id; }
  if (!s.src_mask_url) s.src_mask_url = (await predictionUrl(key, s.src_mask)) ?? undefined;
  if (!s.new_mask_url) s.new_mask_url = (await predictionUrl(key, s.new_mask)) ?? undefined;
  if (s.src_mask_url && !s.clean) { const p = await inpaintInput(key, sourceUrl, s.src_mask_url); s.clean = (await startPrediction(key, p.version, p.input)).id; }
  if (s.clean && !s.clean_url) s.clean_url = (await predictionUrl(key, s.clean)) ?? undefined;

  if (!(s.clean_url && s.new_mask_url && s.src_mask_url)) return { done: false, bg_state: s };
  const url = await compositeOver(sourceUrl, s.clean_url, s.src_mask_url, resultUrl, s.new_mask_url, id);
  return { done: true, url, restored: true };
}

/**
 * Final picture: the source video, with the original actor's area filled from
 * the clean plate, and the new performer (cut out with their matte) on top.
 * Keeps the source's real, moving background at full resolution.
 */
async function compositeOver(source: string, clean: string, srcMask: string, result: string, newMask: string, id: string): Promise<string> {
  const ws = await workspace("remix-bg");
  try {
    const files = { source: ws.file("source.mp4"), clean: ws.file("clean.mp4"), srcMask: ws.file("srcmask.mp4"), result: ws.file("result.mp4"), newMask: ws.file("newmask.mp4") };
    await Promise.all([download(source, files.source), download(clean, files.clean), download(srcMask, files.srcMask), download(result, files.result), download(newMask, files.newMask)]);
    const src = await probeMedia(files.source);
    const res = await probeMedia(files.result);
    const W = src.width - (src.width % 2) || 720;
    const H = src.height - (src.height % 2) || 1280;
    const fit = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;
    const out = ws.file("out.mp4");
    await runFfmpeg([
      "-i", files.source, "-i", files.clean, "-i", files.srcMask, "-i", files.result, "-i", files.newMask,
      "-filter_complex", [
        `[0:v]${fit},format=rgba[src]`,
        `[1:v]${fit},format=rgba[clean]`,
        // Grow the original actor's matte a little so no edge of them survives
        `[2:v]${fit},format=gray,dilation,dilation,dilation,boxblur=6[holes]`,
        `[clean][holes]alphamerge[fill]`,
        `[src][fill]overlay=shortest=1[bg]`,
        `[3:v]${fit},format=rgba[fg]`,
        `[4:v]${fit},format=gray[fgmask]`,
        `[fg][fgmask]alphamerge[actor]`,
        `[bg][actor]overlay=shortest=1,format=yuv420p[v]`,
      ].join(";"),
      "-map", "[v]",
      // Act-Two's own audio if it has any, otherwise the source's
      "-map", res.hasAudio ? "3:a?" : "0:a?",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-shortest", "-movflags", "+faststart", out,
    ], 200_000);
    const path = `video-remix/${id}-final.mp4`;
    const { error } = await supabase.storage.from("generation-inputs").upload(path, await readFile(out), { contentType: "video/mp4", upsert: true });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    return supabase.storage.from("generation-inputs").getPublicUrl(path).data.publicUrl;
  } finally {
    await ws.cleanup();
  }
}

// ---------------------------------------------------------------- handler

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as {
      action?: "restyle" | "transcribe" | "rewrite" | "actor_swap" | "actor_swap_start" | "bg_restore" | "cancel";
      video_url?: string;
      prompt?: string;
      transcript?: string;
      segments?: { start: number; end: number; text: string }[];
      frames?: Frame[];
      duration?: number;
      topic?: string;
      character_url?: string;
      character_type?: "image" | "video";
      ratio?: string;
      body_control?: boolean;
      expression_intensity?: number;
      task_id?: string;
      charge_id?: string;
      preserve_background?: boolean;
      bg_price?: number;
      width?: number;
      height?: number;
      result_url?: string;
      bg_state?: BgState;
    };
    const action = body.action ?? "";

    if (!(await modeEnabled(action))) {
      return NextResponse.json({ error: "This remix mode isn't available right now." }, { status: 403 });
    }

    // Payment: Runway modes claim a paid, unused charge covering the clip's
    // per-second price (15s minimum, max 30s). The duration is measured here for
    // our own uploads; pasted links use the browser's reading. Recreate's AI
    // steps need an open, unused Recreate charge.
    let chargeId: string | null = null;
    let extraPrice = 0;
    const claimFor = async (pricingKey: string, fallback: number, extra?: { key: string; fallback: number }) => {
      const claimed = Math.min(30, Math.max(0, Number(body.duration) || 0));
      const measured = body.video_url?.startsWith(STORAGE_PREFIX) ? await mediaSeconds(body.video_url).catch(() => 0) : 0;
      if (measured > 30.5) return "Runway supports clips up to 30 seconds.";
      // Small differences between browser and server readings are ignored
      const seconds = measured > claimed + 1 ? measured : (claimed || measured || 30);
      // Add-ons are priced per minute on top; the total is billed from the combined
      // rate (as the Studio shows it), and the add-on's own share is what a fallback refunds
      const extraRate = extra ? await getTokenPrice(extra.key, extra.fallback) : 0;
      extraPrice = extra ? perSecondCost(extraRate, seconds) : 0;
      const price = perSecondCost((await getTokenPrice(pricingKey, fallback)) + extraRate, seconds);
      const claim = await claimCharge(body.charge_id, price, user.id);
      if (claim.error) return claim.error;
      chargeId = body.charge_id!;
      return null;
    };
    const release = async () => { if (chargeId) await releaseClaim(chargeId); };
    if (action === "transcribe" || action === "rewrite") {
      const charge = isChargeId(body.charge_id) ? await getCharge(body.charge_id) : null;
      const minimum = await getTokenPrice("video_remix_recreate", 60);
      if (!charge || charge.user_id !== user.id || charge.status !== "charged" || charge.task_id || charge.amount < minimum) {
        return NextResponse.json({ error: "Payment required" }, { status: 402 });
      }
    }

    // ---- Mode A: Restyle (Runway Aleph) ----
    if (action === "restyle") {
      if (!body.video_url?.startsWith("https://")) return NextResponse.json({ error: "A video is required." }, { status: 400 });
      if (!body.prompt?.trim()) return NextResponse.json({ error: "Describe the new style." }, { status: 400 });
      const key = await getSetting("runway_api_key");
      if (!key) return NextResponse.json({ error: "Restyle isn't configured yet." }, { status: 503 });
      const restyleErr = await claimFor("video_remix_restyle", 80);
      if (restyleErr) return NextResponse.json({ error: restyleErr }, { status: 402 });

      const res = await fetch(`${RUNWAY_BASE}/video_to_video`, {
        method: "POST",
        headers: runwayHeaders(key),
        body: JSON.stringify({ model: "aleph2", videoUri: body.video_url, promptText: body.prompt.trim().slice(0, 1000) }),
      });
      const data = await safeJson(res);
      console.log("Runway video_to_video:", res.status, JSON.stringify(data));
      if (!res.ok || !data.id) { await release(); return NextResponse.json({ error: runwayError(data, res.status) }, { status: 400 }); }
      if (chargeId) await attachTask(chargeId, data.id, "runway");
      return NextResponse.json({ success: true, task_id: data.id, provider: "runway" });
    }

    // ---- Mode C: Actor Swap (Runway Act-Two) ----
    // With "preserve background" the new performer is first placed into the
    // source video's own opening frame (Nano Banana Pro edit), so Act-Two
    // animates them in the original setting at the original actor's position.
    // Afterwards bg_restore puts the source's real, moving background back.
    if (action === "actor_swap") {
      if (!body.video_url?.startsWith("https://")) return NextResponse.json({ error: "A source video is required." }, { status: 400 });
      if (!body.character_url?.startsWith("https://")) return NextResponse.json({ error: "Upload the new performer." }, { status: 400 });
      const key = await getSetting("runway_api_key");
      if (!key) return NextResponse.json({ error: "Actor Swap isn't configured yet." }, { status: 503 });
      const preserve = body.preserve_background === true && (await bgPreserveAvailable())
        && body.video_url.startsWith(STORAGE_PREFIX) && body.character_url.startsWith(STORAGE_PREFIX) && body.character_type !== "video";
      const swapErr = await claimFor("video_remix_actor_swap", 50, preserve ? { key: "video_remix_bg_preserve", fallback: 20 } : undefined);
      if (swapErr) return NextResponse.json({ error: swapErr }, { status: 402 });

      if (preserve) {
        try {
          const frame = await openingFrame(body.video_url, chargeId!);
          const aspect = aspectForSize(Number(body.width) || 720, Number(body.height) || 1280);
          const taskId = await nanoBananaTask(await getSetting("kie_api_key"), PLACE_PROMPT, [frame, body.character_url], aspect);
          await attachTask(chargeId!, taskId, "kie");
          return NextResponse.json({ success: true, stage: "placing", task_id: taskId, provider: "kie", bg_price: extraPrice });
        } catch (err) {
          // Couldn't even start: drop the background add-on and run the plain swap
          console.error("Background placement start:", err);
          const r = await refundCharge(chargeId!, user.id, extraPrice).catch(() => ({ refunded: 0 }));
          const started = await startActTwo(key, body.character_url, body);
          if ("error" in started) { await release(); return NextResponse.json({ error: started.error }, { status: 400 }); }
          await attachTask(chargeId!, started.id, "runway");
          return NextResponse.json({ success: true, task_id: started.id, provider: "runway", preserved: false, bg_refunded: r.refunded ?? 0 });
        }
      }

      const started = await startActTwo(key, body.character_url, body);
      if ("error" in started) { await release(); return NextResponse.json({ error: started.error }, { status: 400 }); }
      if (chargeId) await attachTask(chargeId, started.id, "runway");
      return NextResponse.json({ success: true, task_id: started.id, provider: "runway", preserved: false });
    }

    // Step 2 of a background-preserving swap: start Act-Two from the composed
    // frame, or fall back to the performer's own photo (refunding the add-on)
    if (action === "actor_swap_start") {
      const charge = isChargeId(body.charge_id) ? await getCharge(body.charge_id) : null;
      if (!charge || charge.user_id !== user.id || charge.status !== "charged" || !body.task_id || charge.task_id !== body.task_id) {
        return NextResponse.json({ error: "Payment required" }, { status: 402 });
      }
      if (!body.video_url?.startsWith(STORAGE_PREFIX) || !body.character_url?.startsWith(STORAGE_PREFIX)) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
      const key = await getSetting("runway_api_key");
      if (!key) return NextResponse.json({ error: "Actor Swap isn't configured yet." }, { status: 503 });
      const st = await getTaskStatus(body.task_id, "kie").catch(() => null);
      const giveUp = body.preserve_background === false;
      if (st && !st.completed && !st.failed && !giveUp) return NextResponse.json({ error: "Still placing the performer." }, { status: 409 });

      let characterUrl = body.character_url;
      let preserved = false;
      let refunded = 0;
      if (st?.completed && st.video_url) {
        characterUrl = await copyToStorage(st.video_url, `video-remix/${charge.id}-placed.png`).catch(() => st.video_url!);
        preserved = true;
      } else {
        // The add-on price was returned by the first step; never more than the add-on
        const bgPrice = Math.min(Math.max(0, Math.round(Number(body.bg_price) || 0)), Math.floor(charge.amount / 2));
        if (bgPrice > 0) refunded = (await refundCharge(charge.id, user.id, bgPrice).catch(() => ({ refunded: 0 }))).refunded ?? 0;
      }
      const started = await startActTwo(key, characterUrl, body, preserved);
      if ("error" in started) return NextResponse.json({ error: started.error }, { status: 400 });
      await attachTask(charge.id, started.id, "runway");
      return NextResponse.json({ success: true, task_id: started.id, provider: "runway", preserved, bg_refunded: refunded });
    }

    // Step 3: restore the source's moving background behind the new performer.
    // Called repeatedly; each call advances the state and returns it.
    if (action === "bg_restore") {
      const charge = isChargeId(body.charge_id) ? await getCharge(body.charge_id) : null;
      if (!charge || charge.user_id !== user.id || !charge.task_id) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (!body.video_url?.startsWith(STORAGE_PREFIX) || !body.result_url?.startsWith("https://")) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
      // The result must be the Runway task this charge paid for
      const rw = await getTaskStatus(charge.task_id, "runway").catch(() => null);
      if (!rw?.completed || rw.video_url !== body.result_url) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const replicateKey = await getSetting("replicate_api_key");
      if (!replicateKey) return NextResponse.json({ done: true, url: body.result_url, restored: false });
      try {
        return NextResponse.json(await advanceRestore(replicateKey, body.video_url, body.result_url, body.bg_state ?? {}, charge.id));
      } catch (err) {
        console.error("Background restore:", err);
        return NextResponse.json({ done: true, url: body.result_url, restored: false });
      }
    }

    // ---- Mode B step 1: transcribe ----
    if (action === "transcribe") {
      if (!body.video_url?.startsWith(STORAGE_PREFIX)) return NextResponse.json({ error: "Upload the video to transcribe it." }, { status: 400 });
      const openaiKey = await getSetting("openai_api_key");
      if (!openaiKey) return NextResponse.json({ error: "Recreate isn't configured yet." }, { status: 503 });
      try {
        return NextResponse.json(await transcribeVideoUrl(openaiKey, body.video_url));
      } catch (err) {
        if (err instanceof TranscriptionError) return NextResponse.json({ error: err.message }, { status: 400 });
        throw err;
      }
    }

    // ---- Mode B step 2: rewrite with the same structure ----
    if (action === "rewrite") {
      const frames = (body.frames ?? []).filter((f) => typeof f.data_url === "string" && f.data_url.startsWith("data:image/")).slice(0, 6);
      const timeline = (body.segments ?? []).length
        ? body.segments!.map((s) => `[${s.start.toFixed(1)}s-${s.end.toFixed(1)}s] ${s.text}`).join("\n")
        : (body.transcript?.trim() || "(no speech detected)");
      const userText = [
        `Source video, ${Math.round(body.duration ?? 0)} seconds long.`,
        frames.length ? `Frames attached at: ${frames.map((f) => `${f.time.toFixed(1)}s`).join(", ")}.` : "No frames attached.",
        `Timestamped transcript:\n${timeline}`,
        body.topic?.trim() ? `The creator's topic or product for the new video: ${body.topic.trim().slice(0, 500)}` : "No topic given: choose a fresh topic in the same niche.",
        "Write the new video.",
      ].join("\n\n");

      const [claudeKey, openaiKey] = await Promise.all([getSetting("claude_api_key"), getSetting("openai_api_key")]);
      if (!claudeKey && !openaiKey) return NextResponse.json({ error: "Recreate isn't configured yet." }, { status: 503 });
      let result;
      try {
        result = claudeKey ? await rewriteWithClaude(claudeKey, userText, frames) : await rewriteWithOpenAI(openaiKey, userText, frames);
      } catch (err) {
        if (claudeKey && openaiKey) result = await rewriteWithOpenAI(openaiKey, userText, frames);
        else throw err;
      }
      return NextResponse.json({ result });
    }

    // ---- Cancel a running Runway task ----
    if (action === "cancel") {
      if (!body.task_id || !/^[0-9a-f-]{36}$/i.test(body.task_id)) return NextResponse.json({ error: "Invalid task" }, { status: 400 });
      const owned = isChargeId(body.charge_id) ? await getCharge(body.charge_id) : null;
      if (!owned || owned.user_id !== user.id || owned.task_id !== body.task_id) return NextResponse.json({ error: "Task not found" }, { status: 404 });
      const key = await getSetting("runway_api_key");
      if (!key) return NextResponse.json({ error: "Not configured" }, { status: 503 });
      const res = await fetch(`${RUNWAY_BASE}/tasks/${body.task_id}`, { method: "DELETE", headers: runwayHeaders(key) });
      return NextResponse.json({ success: res.ok || res.status === 404 });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Video remix error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
