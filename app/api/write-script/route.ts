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

    const { topic, format, duration, platform } = await req.json();
    if (!topic) return NextResponse.json({ error: "Topic is required" }, { status: 400 });

    const claudeKey = await getSetting("claude_api_key");
    if (!claudeKey) return NextResponse.json({ error: "Claude API key not configured. Please add it in Admin → AI Providers." }, { status: 503 });

    const platformLabel = platform === "tiktok" ? "TikTok" :
      platform === "instagram" ? "Instagram Reels" :
      platform === "youtube" ? "YouTube Shorts" : "Facebook";
    const formatLabel = format || "storytelling";
    const videoLength = duration === "15" ? "15 seconds" :
      duration === "30" ? "30 seconds" :
      duration === "60" ? "60 seconds" : "90 seconds";

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 800,
        system: `You are a viral content creator and scriptwriter specializing in short-form video scripts for ${platformLabel}. You write scripts that get millions of views.

Rules:
- Write a complete script for a ${videoLength} video
- Format with clear sections: HOOK, BODY, CTA
- Make the hook irresistible — first 2-3 seconds must grab attention
- Use conversational, punchy language
- Include [VISUAL CUE] tags to indicate what should be shown on screen
- Script style: ${formatLabel}
- Output the script only, no explanations or preamble`,
        messages: [
          {
            role: "user",
            content: `Write a viral ${platformLabel} script about:\n\n"${topic}"`,
          },
        ],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Claude error:", data);
      return NextResponse.json({ error: data.error?.message ?? "Claude request failed" }, { status: 400 });
    }

    const script = data.content?.[0]?.text?.trim();
    if (!script) return NextResponse.json({ error: "No response from Claude" }, { status: 500 });

    return NextResponse.json({ success: true, script });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Script write error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
