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

    const openaiKey = await getSetting("openai_api_key");
    if (!openaiKey) return NextResponse.json({ error: "OpenAI is not configured. Please add your API key in Admin → AI Providers." }, { status: 503 });

    const videoLength = duration === "15" ? "15 seconds" : duration === "10" ? "10 seconds" : duration === "8" ? "8 seconds" : "5-8 seconds";
    const platformHint = platform === "tiktok" ? "TikTok" : platform === "youtube" ? "YouTube Shorts" : platform === "instagram" ? "Instagram Reels" : "short-form social media";
    const formatHint = format || "engaging storytelling";

    const systemPrompt = `You are a viral content creator and scriptwriter specializing in short-form video scripts for ${platformHint}. You write scripts that get millions of views.

Rules:
- Write a complete script for a ${videoLength} video
- Format: Hook (first 2-3 seconds), Body (main content), CTA (call to action)
- Make the hook irresistible — viewers must keep watching
- Use conversational, punchy language
- Include [VISUAL CUE] tags to indicate what should be shown on screen
- Keep it tight and punchy for ${videoLength}
- Format: storytelling style is ${formatHint}
- Output the script only, no explanations`;

    const userMessage = `Write a viral ${platformHint} script about:\n\n"${topic}"`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 500,
        temperature: 0.9,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("OpenAI error:", data);
      return NextResponse.json({ error: data.error?.message ?? "OpenAI request failed" }, { status: 400 });
    }

    const script = data.choices?.[0]?.message?.content?.trim();
    if (!script) return NextResponse.json({ error: "No response from OpenAI" }, { status: 500 });

    return NextResponse.json({ success: true, script });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Script write error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
