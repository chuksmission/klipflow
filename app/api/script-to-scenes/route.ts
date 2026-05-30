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

    const { script, aspect_ratio = "9:16" } = await req.json();
    if (!script) return NextResponse.json({ error: "Script is required" }, { status: 400 });

    const claudeKey = await getSetting("claude_api_key");
    if (!claudeKey) return NextResponse.json({ error: "Claude API key not configured." }, { status: 503 });

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
        system: `You are an expert AI video director who creates viral social media content. You break scripts into scenes and write prompts that make AI video models generate videos where a REAL PERSON speaks the dialogue out loud with clear speech audio.

CRITICAL RULES — follow these exactly:

1. EVERY scene must feature a PERSON speaking directly to camera. No exceptions. Even if the topic is watermelon, gut health, or hair — a person must be on screen speaking.

2. The person must be described specifically: their age, appearance, clothing, setting. Be very specific so the AI generates a consistent character.

3. The exact dialogue from the script MUST appear in quotes in the prompt using this format:
   Person saying: "[exact words from the script for this scene]"

4. The person can hold or interact with relevant props/items while speaking (e.g. holding a watermelon, pointing at their skin, holding a bottle).

5. Camera style: close-up to medium shot, authentic UGC style, shot on phone, natural lighting.

6. Format: ${aspect_ratio} vertical video.

7. Split into exactly 3-5 scenes based on natural breaks in the script.

PROMPT STRUCTURE FOR EACH SCENE:
"[Specific person description] speaking directly to camera, saying: '[exact dialogue]', [what they are doing/holding/showing], [setting], close-up shot, authentic UGC style, natural lighting, ${aspect_ratio} vertical format, high quality, realistic"

EXAMPLE — for a script about watermelon:
"Young African woman in casual clothes, speaking directly to camera with enthusiasm, saying: 'Did you know eating watermelon every day can completely transform your body in just 30 days?', holding a slice of watermelon, bright kitchen background, close-up shot, authentic UGC style, natural lighting, 9:16 vertical format"

Output ONLY valid JSON, no other text:
{
  "scenes": [
    {
      "scene_number": 1,
      "narration": "The exact dialogue from the script for this scene",
      "visual_prompt": "Full detailed prompt following the structure above"
    }
  ]
}`,
        messages: [
          {
            role: "user",
            content: `Break this script into 3-5 scenes. Each scene MUST have a person speaking the dialogue out loud:\n\n${script}`,
          },
        ],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Claude error:", data);
      return NextResponse.json({ error: data.error?.message ?? "Claude request failed" }, { status: 400 });
    }

    const text = data.content?.[0]?.text?.trim();
    if (!text) return NextResponse.json({ error: "No response from Claude" }, { status: 500 });

    let parsed;
    try {
      const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      console.error("Failed to parse Claude response:", text);
      return NextResponse.json({ error: "Failed to parse scene breakdown. Please try again." }, { status: 500 });
    }

    if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
      return NextResponse.json({ error: "Invalid scene format returned." }, { status: 500 });
    }

    return NextResponse.json({ success: true, scenes: parsed.scenes });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Script to scenes error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}