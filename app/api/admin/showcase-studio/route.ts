import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BALANCE_KEY = "admin_token_balance";

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

async function getBalance(): Promise<number> {
  const value = parseInt(await getSetting(BALANCE_KEY), 10);
  return Number.isFinite(value) ? value : 0;
}

async function setBalance(balance: number) {
  await supabase
    .from("admin_settings")
    .upsert(
      { key: BALANCE_KEY, value: String(balance), category: "showcase", updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
}

// What each feature demonstrates, so the prompt writer knows what a great demo looks like.
const FEATURE_BRIEFS: Record<string, string> = {
  text_to_video: "Text to Video: a single cinematic shot generated purely from a text prompt.",
  image_to_video: "Image to Video: an uploaded still photo brought to life. Prompts describe the motion, camera move and atmosphere to add to the existing image, not a new scene.",
  ugc_ad: "UGC Generator: authentic user-generated-content style ads. A relatable person speaking to a phone camera, holding or using a product, natural light, handheld feel, genuine reaction.",
  ai_actor: "AI Actor: a photorealistic AI presenter or spokesperson, close-up or medium shot, expressive face, professional or lifestyle setting.",
  voice: "Voice Generation: a scene that shows off natural spoken audio, such as a narrator, presenter or character speaking clearly, with mouth movement and ambient sound.",
  image_ad: "Image Ad: a single scroll-stopping static ad image. Product hero shot, bold composition, clean background, premium lighting, room for text.",
  video_translator: "AI Video Translator: a person speaking directly to camera, clearly framed face, ideal source material to be translated and lip-synced into another language.",
  prompt: "Prompt Expander: show how a simple idea becomes a richly detailed cinematic prompt. Each prompt should read like an expert director's shot description.",
  script: "Script Writer: a hook-driven short-form video moment, the kind of opening shot that goes with a viral script (faceless reel, storytelling, educational).",
  video_remix: "Video Remix: a stylised reinterpretation of a familiar scene, such as the same motion in a bold new visual style (anime, claymation, neon noir, watercolour).",
  series_cloner: "Series Cloner: an episode from a recurring short-form series with a consistent, distinctive original character and setting. Never reference real people.",
  actor_swap: "AI Actor Swap: a presenter speaking to camera in a polished setting, the kind of footage where the performer could be swapped for a different AI actor. Never reference real people.",
};

const SYSTEM_PROMPT = `You write demo prompts for KlipflowAI, an AI video platform used by creators and e-commerce brands. It generates videos with models such as Kling, Veo, Sora and Seedance.

The prompts you write are used to generate showcase videos for KlipflowAI's homepage gallery, so each one must produce a visually stunning, professional result that makes a visitor want to try the feature.

Each prompt must:
- Describe one continuous shot (5 to 10 seconds) with a clear subject, action, setting, lighting, camera movement and mood
- Be specific and vivid, 40 to 90 words
- Suit the requested aspect ratio
- Feature only original, fictional people. Never name or imitate real people, celebrities, brands or copyrighted characters
- Avoid on-screen text, logos and watermarks

The three prompts must be clearly different from each other in subject, setting and style.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    prompts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short card title, 2 to 5 words" },
          prompt: { type: "string" },
        },
        required: ["title", "prompt"],
        additionalProperties: false,
      },
    },
  },
  required: ["prompts"],
  additionalProperties: false,
};

type Suggestion = { title: string; prompt: string };

async function promptsFromClaude(apiKey: string, userMessage: string): Promise<Suggestion[]> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      // Server-side fallback if the request is declined by a safety classifier
      "anthropic-beta": "server-side-fallback-2026-07-01",
    },
    body: JSON.stringify({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "low", format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? `Claude request failed (${res.status})`);
  if (data.stop_reason === "refusal") throw new Error("Claude declined to write prompts for this request. Try again or adjust the feature.");
  const text = (data.content ?? []).find((b: { type: string }) => b.type === "text")?.text;
  if (!text) throw new Error("No response from Claude");
  return JSON.parse(text).prompts ?? [];
}

async function promptsFromOpenAI(apiKey: string, userMessage: string): Promise<Suggestion[]> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: { type: "json_schema", json_schema: { name: "showcase_prompts", strict: true, schema: RESPONSE_SCHEMA } },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? `OpenAI request failed (${res.status})`);
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("No response from OpenAI");
  return JSON.parse(text).prompts ?? [];
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await checkAdmin(authHeader.replace("Bearer ", ""));
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [balance, claudeKey, openaiKey] = await Promise.all([getBalance(), getSetting("claude_api_key"), getSetting("openai_api_key")]);
  return NextResponse.json({ balance, prompt_provider: claudeKey ? "claude" : openaiKey ? "openai" : null });
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const admin = await checkAdmin(authHeader.replace("Bearer ", ""));
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json() as {
      action?: "prompts" | "charge" | "refund" | "set_balance";
      feature?: string;
      aspect_ratio?: string;
      amount?: number;
      balance?: number;
    };

    // ---- Generate 3 demo prompts for a feature ----
    if (body.action === "prompts") {
      const brief = FEATURE_BRIEFS[body.feature ?? ""];
      if (!brief) return NextResponse.json({ error: "Unknown feature" }, { status: 400 });

      const orientation = body.aspect_ratio === "9:16" ? "vertical 9:16 (TikTok / Reels)" : body.aspect_ratio === "1:1" ? "square 1:1" : "horizontal 16:9 widescreen";
      const userMessage = `Feature to showcase: ${brief}\nAspect ratio: ${orientation}\n\nWrite 3 demo prompts for this feature.`;

      const [claudeKey, openaiKey] = await Promise.all([getSetting("claude_api_key"), getSetting("openai_api_key")]);
      if (!claudeKey && !openaiKey) {
        return NextResponse.json({ error: "Add a Claude or OpenAI API key in Admin → AI Providers first." }, { status: 503 });
      }

      let prompts: Suggestion[] = [];
      try {
        prompts = claudeKey ? await promptsFromClaude(claudeKey, userMessage) : await promptsFromOpenAI(openaiKey, userMessage);
      } catch (err) {
        // Claude failed: fall back to OpenAI when it's configured
        if (claudeKey && openaiKey) prompts = await promptsFromOpenAI(openaiKey, userMessage);
        else throw err;
      }
      return NextResponse.json({ prompts: prompts.filter((p) => p.prompt?.trim()).slice(0, 3) });
    }

    // ---- Admin token balance ----
    if (body.action === "charge" || body.action === "refund") {
      const amount = Math.round(Number(body.amount));
      if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
      const balance = await getBalance();
      if (body.action === "charge" && balance < amount) {
        return NextResponse.json({ error: `Not enough showcase tokens: this costs ${amount}, balance is ${balance}. Top up the balance above.`, balance }, { status: 400 });
      }
      const next = body.action === "charge" ? balance - amount : balance + amount;
      await setBalance(next);
      return NextResponse.json({ balance: next });
    }

    if (body.action === "set_balance") {
      const next = Math.round(Number(body.balance));
      if (!Number.isFinite(next) || next < 0) return NextResponse.json({ error: "Invalid balance" }, { status: 400 });
      await setBalance(next);
      return NextResponse.json({ balance: next });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Showcase studio error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
