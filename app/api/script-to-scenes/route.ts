import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getSetting(key: string): Promise<string> {
  const { data } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", key)
    .single();
  return data?.value ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { script, aspect_ratio = "9:16", model_description, scene_styles } = await req.json();
    if (!script) return NextResponse.json({ error: "Script is required" }, { status: 400 });

    const claudeKey = await getSetting("claude_api_key");
    if (!claudeKey) return NextResponse.json({ error: "Claude API key not configured." }, { status: 503 });

    // Build model description context
    const modelContext = model_description
      ? `The creator/model for ALL scenes is: ${model_description}. Use this exact person description consistently across every scene.`
      : `Create a consistent character that fits the topic. Use the same person description across all scenes for continuity.`;

    // Build scene style context
    const styleContext = scene_styles && Object.keys(scene_styles).length > 0
      ? `Some scenes have specific style overrides that MUST be applied:\n${Object.entries(scene_styles).map(([k, v]) => `Scene ${k}: ${v}`).join("\n")}`
      : "";

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1500,
        system: `You are an expert AI video director creating viral social media content. You break scripts into scenes and write prompts that make AI video models generate videos where a REAL PERSON speaks dialogue out loud with clear speech.

${modelContext}

${styleContext}

CRITICAL RULES:
1. EVERY scene must feature a person speaking directly to camera. No exceptions.
2. The exact dialogue from the script MUST appear in quotes: saying: "[exact words]"
3. The person can hold/interact with relevant props while speaking.
4. Camera: close-up to medium shot, authentic UGC style, natural lighting.
5. Format: ${aspect_ratio} vertical video.
6. Split into exactly 3-5 scenes based on natural breaks in the script.
7. If a scene has a style override, apply it to that scene's description.
8. Keep the person's core appearance consistent across scenes unless overridden.

PROMPT STRUCTURE:
"[Person description with any style overrides] speaking directly to camera, saying: '[exact dialogue]', [what they hold/do], [setting], close-up shot, authentic UGC style, natural lighting, ${aspect_ratio} vertical format, high quality, realistic"

Output ONLY valid JSON, no other text:
{
  "scenes": [
    {
      "scene_number": 1,
      "narration": "The exact dialogue from the script for this scene",
      "visual_prompt": "Full detailed prompt"
    }
  ]
}`,
        messages: [
          {
            role: "user",
            content: `Break this script into 3-5 scenes. Each scene MUST have the person speaking the dialogue:\n\n${script}`,
          },
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.error?.message ?? "Claude request failed" }, { status: 400 });

    const text = data.content?.[0]?.text?.trim();
    if (!text) return NextResponse.json({ error: "No response from Claude" }, { status: 500 });

    let parsed;
    try {
      const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      return NextResponse.json({ error: "Failed to parse scene breakdown. Please try again." }, { status: 500 });
    }

    if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
      return NextResponse.json({ error: "Invalid scene format returned." }, { status: 500 });
    }

    return NextResponse.json({ success: true, scenes: parsed.scenes });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}