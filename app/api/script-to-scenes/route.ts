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

    const orientation = aspect_ratio === "9:16" ? "vertical 9:16 portrait for TikTok/Reels" :
      aspect_ratio === "1:1" ? "square 1:1" : "horizontal 16:9 widescreen";

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1200,
        system: `You are an expert video director and AI prompt engineer. Your job is to break a video script into 3-5 visual scenes and write a cinematic AI video prompt for each scene.

For each scene:
- Write what should be VISUALLY shown on screen (not the dialogue)
- Make prompts vivid, specific, and cinematic
- Each prompt should work as a standalone AI video generation prompt
- Include: subject, action, environment, lighting, camera angle, mood
- Optimize for ${orientation} format
- Each scene should be 5-8 seconds of content

Output ONLY valid JSON in this exact format, no other text:
{
  "scenes": [
    {
      "scene_number": 1,
      "narration": "The dialogue/text for this scene from the script",
      "visual_prompt": "Detailed cinematic visual prompt for AI video generation"
    }
  ]
}`,
        messages: [
          {
            role: "user",
            content: `Break this script into 3-5 visual scenes with AI video prompts:\n\n${script}`,
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

    // Parse JSON response
    let parsed;
    try {
      // Strip any markdown code blocks if present
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
