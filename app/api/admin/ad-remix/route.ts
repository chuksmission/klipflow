import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Whisper and the analysis call can each take 10-40s
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WHISPER_MAX_BYTES = 25 * 1024 * 1024; // OpenAI transcription upload limit

async function checkAdmin(token: string) {
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  return profile?.is_admin ? user : null;
}

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

// ---------------------------------------------------------------- analysis

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    hook: {
      type: "object",
      properties: {
        first_3_seconds: { type: "string", description: "What is seen and said in the first 3 seconds" },
        technique: { type: "string", description: "The hook technique, e.g. pattern interrupt, bold claim, question, relatable pain" },
        why_it_works: { type: "string" },
      },
      required: ["first_3_seconds", "technique", "why_it_works"],
      additionalProperties: false,
    },
    pain_point: { type: "string" },
    target_audience: { type: "string" },
    flow: {
      type: "array",
      items: {
        type: "object",
        properties: {
          stage: { type: "string", enum: ["hook", "problem", "agitation", "solution", "demo", "proof", "offer", "cta"] },
          summary: { type: "string" },
        },
        required: ["stage", "summary"],
        additionalProperties: false,
      },
    },
    visual_style: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["ugc", "polished", "screen_demo", "testimonial", "talking_head", "animation", "mixed"] },
        description: { type: "string" },
      },
      required: ["format", "description"],
      additionalProperties: false,
    },
    pacing: { type: "string" },
    energy: { type: "string" },
    text_overlays: { type: "string", description: "Style, placement and frequency of on-screen text" },
    rewrite: {
      type: "object",
      properties: {
        hook: { type: "string" },
        script: { type: "string", description: "Full voiceover script for the KlipflowAI version, in spoken order" },
        scenes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              visual_prompt: { type: "string", description: "Self-contained AI video prompt for this scene, 30-80 words" },
              voiceover: { type: "string" },
              on_screen_text: { type: "string" },
            },
            required: ["visual_prompt", "voiceover", "on_screen_text"],
            additionalProperties: false,
          },
        },
        cta: { type: "string" },
        recommended_output: { type: "string", enum: ["ugc", "cinematic", "talking_head"] },
      },
      required: ["hook", "script", "scenes", "cta", "recommended_output"],
      additionalProperties: false,
    },
  },
  required: ["hook", "pain_point", "target_audience", "flow", "visual_style", "pacing", "energy", "text_overlays", "rewrite"],
  additionalProperties: false,
};

const ANALYSIS_SYSTEM = `You are a senior direct-response creative strategist. You study a competitor's video ad, explain why it works, then rewrite it as an original ad for KlipflowAI.

About KlipflowAI (the only facts you may claim):
- An AI video platform at klipflowai.com for creators and e-commerce brands
- Generates videos from text or images with models like Kling, Veo, Sora and Seedance: UGC-style ads, product videos, AI presenters, faceless reels, script-to-video and video translation
- New users get 25 free tokens, no credit card required

Analysis: describe what the ad actually does, using the transcript and the frames (frames are in time order; the first three cover the opening seconds). Be specific and practical.

Rewrite rules:
- Keep the same structural flow and pacing as the original, but use completely new words. Never reuse the competitor's distinctive phrases, product names or brand.
- The new hook must be about creating videos or ads with AI.
- Sound like a real person talking, natural and culturally fluent for the audience, never robotic or salesy.
- The call to action points to klipflowai.com.
- Never invent statistics, revenue figures, user counts, ratings, testimonials or named customers. Describe benefits instead.
- People in scenes are original and fictional. Never describe or imitate the people in the original ad, celebrities or real individuals.
- Each scene's visual_prompt must stand alone as an AI video prompt (subject, action, setting, lighting, camera) with no on-screen text or logos in the image.
- Match the original length: roughly the same number of scenes and spoken words.`;

type Frame = { time: number; data_url: string };

async function analyzeWithOpenAI(apiKey: string, userText: string, frames: Frame[]) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: { type: "json_schema", json_schema: { name: "ad_remix", strict: true, schema: ANALYSIS_SCHEMA } },
      messages: [
        { role: "system", content: ANALYSIS_SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            ...frames.map((f) => ({ type: "image_url", image_url: { url: f.data_url, detail: "low" } })),
          ],
        },
      ],
    }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error?.message ?? `OpenAI analysis failed (${res.status})`);
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(data.choices?.[0]?.message?.refusal ?? "No analysis returned by OpenAI");
  return JSON.parse(text);
}

async function analyzeWithClaude(apiKey: string, userText: string, frames: Frame[]) {
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
      output_config: { effort: "medium", format: { type: "json_schema", schema: ANALYSIS_SCHEMA } },
      fallbacks: "default",
      system: ANALYSIS_SYSTEM,
      messages: [{ role: "user", content: [...images, { type: "text", text: userText }] }],
    }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error?.message ?? `Claude analysis failed (${res.status})`);
  if (data.stop_reason === "refusal") throw new Error("Claude declined to analyse this ad.");
  const text = (data.content ?? []).find((b: { type: string }) => b.type === "text")?.text;
  if (!text) throw new Error("No analysis returned by Claude");
  return JSON.parse(text);
}

// ---------------------------------------------------------------- heygen avatars

const HEYGEN_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
  "1:1": { width: 720, height: 720 },
};

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const admin = await checkAdmin(authHeader.replace("Bearer ", ""));
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json() as {
      action?: "transcribe" | "analyze" | "heygen_options" | "heygen_generate";
      video_url?: string;
      transcript?: string;
      segments?: { start: number; end: number; text: string }[];
      frames?: Frame[];
      duration?: number;
      notes?: string;
      script?: string;
      avatar_id?: string;
      voice_id?: string;
      aspect_ratio?: string;
    };

    // ---- 1. Whisper transcription ----
    if (body.action === "transcribe") {
      if (!body.video_url) return NextResponse.json({ error: "video_url is required" }, { status: 400 });
      const openaiKey = await getSetting("openai_api_key");
      if (!openaiKey) return NextResponse.json({ error: "Add an OpenAI API key in Admin → AI Providers to transcribe." }, { status: 503 });

      const fileRes = await fetch(body.video_url);
      if (!fileRes.ok) return NextResponse.json({ error: "Couldn't download the uploaded video for transcription." }, { status: 400 });
      const blob = await fileRes.blob();
      if (blob.size > WHISPER_MAX_BYTES) {
        return NextResponse.json({ error: "Video is over 25MB, the transcription limit. Compress it or trim it and try again." }, { status: 400 });
      }
      const ext = (body.video_url.split("?")[0].split(".").pop() ?? "mp4").toLowerCase();

      const form = new FormData();
      form.append("file", blob, `ad.${ext}`);
      form.append("model", "whisper-1");
      form.append("response_format", "verbose_json");

      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: form,
      });
      const data = await safeJson(res);
      if (!res.ok) return NextResponse.json({ error: data.error?.message ?? `Whisper failed (${res.status})` }, { status: 400 });
      return NextResponse.json({
        text: data.text ?? "",
        language: data.language ?? null,
        duration: data.duration ?? null,
        segments: (data.segments ?? []).map((s: { start: number; end: number; text: string }) => ({ start: s.start, end: s.end, text: s.text?.trim() ?? "" })),
      });
    }

    // ---- 2. Analysis + KlipflowAI rewrite ----
    if (body.action === "analyze") {
      const frames = (body.frames ?? []).filter((f) => typeof f.data_url === "string" && f.data_url.startsWith("data:image/")).slice(0, 8);
      const timeline = (body.segments ?? []).length
        ? body.segments!.map((s) => `[${s.start.toFixed(1)}s-${s.end.toFixed(1)}s] ${s.text}`).join("\n")
        : (body.transcript?.trim() || "(no speech detected: the ad may be music or text only)");
      const userText = [
        `Competitor ad, ${Math.round(body.duration ?? 0)} seconds long.`,
        `Frames attached at: ${frames.map((f) => `${f.time.toFixed(1)}s`).join(", ") || "none"}.`,
        `Timestamped transcript:\n${timeline}`,
        body.notes?.trim() ? `Notes from the admin: ${body.notes.trim()}` : "",
        "Analyse this ad, then rewrite it for KlipflowAI following the rules.",
      ].filter(Boolean).join("\n\n");

      const [openaiKey, claudeKey] = await Promise.all([getSetting("openai_api_key"), getSetting("claude_api_key")]);
      if (!openaiKey && !claudeKey) return NextResponse.json({ error: "Add an OpenAI or Claude API key in Admin → AI Providers." }, { status: 503 });

      let analysis;
      let provider = "openai";
      try {
        analysis = openaiKey ? await analyzeWithOpenAI(openaiKey, userText, frames) : await analyzeWithClaude(claudeKey, userText, frames);
        if (!openaiKey) provider = "claude";
      } catch (err) {
        // GPT-4o failed: fall back to Claude when it's configured
        if (openaiKey && claudeKey) { analysis = await analyzeWithClaude(claudeKey, userText, frames); provider = "claude"; }
        else throw err;
      }
      return NextResponse.json({ analysis, provider });
    }

    // ---- 3. HeyGen avatars and voices ----
    if (body.action === "heygen_options") {
      const heygenKey = await getSetting("heygen_api_key");
      if (!heygenKey) return NextResponse.json({ error: "Add a HeyGen API key in Admin → AI Providers." }, { status: 503 });
      const headers = { "X-Api-Key": heygenKey, Accept: "application/json" };
      const [aRes, vRes] = await Promise.all([
        fetch("https://api.heygen.com/v2/avatars", { headers }),
        fetch("https://api.heygen.com/v2/voices", { headers }),
      ]);
      const [aData, vData] = await Promise.all([safeJson(aRes), safeJson(vRes)]);
      if (!aRes.ok || !vRes.ok) {
        return NextResponse.json({ error: aData.error?.message ?? vData.error?.message ?? "Couldn't load HeyGen avatars and voices." }, { status: 400 });
      }
      const avatars = (aData.data?.avatars ?? []).map((a: Record<string, string>) => ({
        id: a.avatar_id, name: a.avatar_name ?? a.avatar_id, gender: a.gender ?? "", preview: a.preview_image_url ?? "",
      })).filter((a: { id?: string }) => a.id).slice(0, 400);
      const voices = (vData.data?.voices ?? []).map((v: Record<string, string>) => ({
        id: v.voice_id, name: v.name ?? v.voice_id, language: v.language ?? "", gender: v.gender ?? "",
      })).filter((v: { id?: string }) => v.id)
        // English voices first
        .sort((x: { language: string }, y: { language: string }) => Number(!/english/i.test(x.language)) - Number(!/english/i.test(y.language)))
        .slice(0, 600);
      return NextResponse.json({ avatars, voices });
    }

    // ---- 4. HeyGen talking-head video ----
    if (body.action === "heygen_generate") {
      if (!body.script?.trim()) return NextResponse.json({ error: "Script is required" }, { status: 400 });
      if (!body.avatar_id) return NextResponse.json({ error: "Choose an avatar" }, { status: 400 });
      const heygenKey = await getSetting("heygen_api_key");
      if (!heygenKey) return NextResponse.json({ error: "Add a HeyGen API key in Admin → AI Providers." }, { status: 503 });

      const voice: Record<string, string> = { type: "text", input_text: body.script.trim().slice(0, 4900) };
      if (body.voice_id) voice.voice_id = body.voice_id;

      const res = await fetch("https://api.heygen.com/v2/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": heygenKey, Accept: "application/json" },
        body: JSON.stringify({
          video_inputs: [{
            character: { type: "avatar", avatar_id: body.avatar_id, avatar_style: "normal" },
            voice,
          }],
          dimension: HEYGEN_DIMENSIONS[body.aspect_ratio ?? "9:16"] ?? HEYGEN_DIMENSIONS["9:16"],
        }),
      });
      const data = await safeJson(res);
      console.log("HeyGen avatar generate:", res.status, JSON.stringify(data));
      const videoId = data.data?.video_id ?? data.video_id;
      if (!res.ok || data.error || !videoId) {
        const err = data.error;
        return NextResponse.json({ error: (typeof err === "string" ? err : err?.message) ?? data.message ?? `HeyGen error (${res.status})` }, { status: 400 });
      }
      return NextResponse.json({ success: true, task_id: videoId, provider: "heygen_avatar" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Ad remix error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
