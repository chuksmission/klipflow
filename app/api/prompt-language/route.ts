import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { structured } from "../../lib/llm";
import { ACTOR_SWAP_LANGUAGES } from "../../lib/actor-swap";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getSetting(key: string): Promise<string> {
  const { data } = await supabase.from("admin_settings").select("value").eq("key", key).single();
  return data?.value ?? "";
}

const CODES = new Set(ACTOR_SWAP_LANGUAGES.map((l) => l.code));

// Cheapest possible call: a fast model, a 10-token reply with just the code
async function detectCode(text: string): Promise<string | null> {
  const [claudeKey, openaiKey] = await Promise.all([getSetting("claude_api_key"), getSetting("openai_api_key")]);
  const system = "Identify the language of the user's text. Reply with only its ISO 639-1 code in lowercase, nothing else.";
  let reply = "";
  if (claudeKey) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": claudeKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 10, system, messages: [{ role: "user", content: text }] }),
    });
    const data = await res.json().catch(() => ({}));
    reply = (data.content ?? []).find((b: { type: string }) => b.type === "text")?.text ?? "";
  }
  if (!reply && openaiKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 10, messages: [{ role: "system", content: system }, { role: "user", content: text }] }),
    });
    const data = await res.json().catch(() => ({}));
    reply = data.choices?.[0]?.message?.content ?? "";
  }
  const code = reply.trim().toLowerCase().replace(/[^a-z]/g, "").slice(0, 2);
  return code.length === 2 ? code : null;
}

const TRANSLATE_SCHEMA = {
  type: "object",
  properties: { text: { type: "string", description: "The translated prompt" } },
  required: ["text"],
  additionalProperties: false,
};

/**
 * POST { action: "detect", text } → { language: code | null }
 * POST { action: "translate", text, language, accent } → { text }
 * Signed-in users only; prompts are capped at 2000 characters.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as { action?: string; text?: string; language?: string; accent?: string };
    const text = (body.text ?? "").trim().slice(0, 2000);
    if (!text) return NextResponse.json({ error: "Text is required" }, { status: 400 });

    if (body.action === "detect") {
      return NextResponse.json({ language: await detectCode(text.slice(0, 400)) });
    }

    if (body.action === "translate") {
      if (!body.language || !CODES.has(body.language)) return NextResponse.json({ error: "Choose an output language." }, { status: 400 });
      const lang = ACTOR_SWAP_LANGUAGES.find((l) => l.code === body.language)!;
      const accent = (body.accent ?? "").slice(0, 60);
      const [claude, openai] = await Promise.all([getSetting("claude_api_key"), getSetting("openai_api_key")]);
      const out = await structured<{ text: string }>({ claude, openai }, {
        name: "prompt_translation",
        schema: TRANSLATE_SCHEMA,
        effort: "low",
        system: `You translate prompts for AI video and image generation into ${lang.name}${accent ? `, using natural word choice for a ${accent} audience` : ""}.
Rules:
- Keep every visual detail, camera direction, style term and the order of ideas.
- Keep brand names, product names and anything in quotes that is meant to stay as written.
- Spoken lines are translated naturally, the way a native ${accent || lang.name} speaker would say them.
- Return only the translated prompt, with no notes.`,
        text,
      });
      return NextResponse.json({ text: out.text });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Prompt language error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong" }, { status: 500 });
  }
}
