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

    const { idea, aspect_ratio } = await req.json();
    if (!idea) return NextResponse.json({ error: "Idea is required" }, { status: 400 });

    const claudeKey = await getSetting("claude_api_key");
    if (!claudeKey) return NextResponse.json({ error: "Claude API key not configured. Please add it in Admin → AI Providers." }, { status: 503 });

    const orientation = aspect_ratio === "9:16" ? "vertical portrait, TikTok/Reels style" :
      aspect_ratio === "1:1" ? "square format" : "horizontal widescreen, cinematic";

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 400,
        system: `You are a world-class AI video prompt engineer. Transform simple ideas into detailed, cinematic video generation prompts that produce stunning results with AI video models like Kling, Veo, and Sora.

Rules:
- Output ONLY the expanded prompt, nothing else
- No explanations, no preamble, no labels
- Make it vivid, specific, and cinematic
- Include: subject, action, environment, lighting, camera movement, mood, visual style
- Keep it under 200 words
- Optimized for ${orientation}`,
        messages: [
          {
            role: "user",
            content: `Expand this simple idea into a detailed cinematic video prompt:\n\n"${idea}"`,
          },
        ],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Claude error:", data);
      return NextResponse.json({ error: data.error?.message ?? "Claude request failed" }, { status: 400 });
    }

    const expanded = data.content?.[0]?.text?.trim();
    if (!expanded) return NextResponse.json({ error: "No response from Claude" }, { status: 500 });

    return NextResponse.json({ success: true, prompt: expanded });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Prompt expand error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
