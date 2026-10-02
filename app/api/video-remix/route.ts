import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TranscriptionError, transcribeVideoUrl } from "../../lib/whisper";
import { attachTask, claimCharge, getCharge, getTokenPrice, isChargeId, releaseClaim } from "../../lib/charges";

// Transcription and the rewrite call can each take 10-40s
export const maxDuration = 60;

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

// ---------------------------------------------------------------- handler

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as {
      action?: "restyle" | "transcribe" | "rewrite" | "actor_swap" | "cancel";
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
    };
    const action = body.action ?? "";

    if (!(await modeEnabled(action))) {
      return NextResponse.json({ error: "This remix mode isn't available right now." }, { status: 403 });
    }

    // Payment: Runway modes claim a paid, unused charge covering at least one
    // minute's worth. Recreate's AI steps need an open, unused Recreate charge.
    let chargeId: string | null = null;
    const claimFor = async (pricingKey: string, fallback: number) => {
      const claim = await claimCharge(body.charge_id, await getTokenPrice(pricingKey, fallback), user.id);
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
    if (action === "actor_swap") {
      if (!body.video_url?.startsWith("https://")) return NextResponse.json({ error: "A source video is required." }, { status: 400 });
      if (!body.character_url?.startsWith("https://")) return NextResponse.json({ error: "Upload the new performer." }, { status: 400 });
      const key = await getSetting("runway_api_key");
      if (!key) return NextResponse.json({ error: "Actor Swap isn't configured yet." }, { status: 503 });
      const swapErr = await claimFor("video_remix_actor_swap", 50);
      if (swapErr) return NextResponse.json({ error: swapErr }, { status: 402 });

      const ratio = ["1280:720", "720:1280", "960:960", "1104:832", "832:1104", "1584:672"].includes(body.ratio ?? "") ? body.ratio : "1280:720";
      const res = await fetch(`${RUNWAY_BASE}/character_performance`, {
        method: "POST",
        headers: runwayHeaders(key),
        body: JSON.stringify({
          model: "act_two",
          // The new performer...
          character: { type: body.character_type === "video" ? "video" : "image", uri: body.character_url },
          // ...performs what the person in the source video does
          reference: { type: "video", uri: body.video_url },
          ratio,
          bodyControl: body.body_control !== false,
          expressionIntensity: Math.min(5, Math.max(1, Math.round(body.expression_intensity ?? 3))),
        }),
      });
      const data = await safeJson(res);
      console.log("Runway character_performance:", res.status, JSON.stringify(data));
      if (!res.ok || !data.id) { await release(); return NextResponse.json({ error: runwayError(data, res.status) }, { status: 400 }); }
      if (chargeId) await attachTask(chargeId, data.id, "runway");
      return NextResponse.json({ success: true, task_id: data.id, provider: "runway" });
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
