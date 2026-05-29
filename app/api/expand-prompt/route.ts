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

    const { idea, style, aspect_ratio } = await req.json();
    if (!idea) return NextResponse.json({ error: "Idea is required" }, { status: 400 });

    const openaiKey = await getSetting("openai_api_key");
    if (!openaiKey) return NextResponse.json({ error: "OpenAI is not configured. Please add your API key in Admin → AI Providers." }, { status: 503 });

    const orientation = aspect_ratio === "9:16" ? "vertical portrait, TikTok/Reels style" : aspect_ratio === "1:1" ? "square format" : "horizontal widescreen, cinematic";
    const styleHint = style ? `Visual style: ${style}.` : "";

    const systemPrompt = `You are a world-class AI video prompt engineer. Your job is to transform simple ideas into detailed, cinematic video generation prompts that produce stunning results with AI video models like Kling, Veo, and Sora.

Rules:
- Output ONLY the expanded prompt, nothing else
- No explanations, no preamble, no labels
- Make it vivid, specific, and cinematic
- Include: subject, action, environment, lighting, camera movement, mood, visual style
- Keep it under 200 words
- Make it optimized for ${orientation}`;

    const userMessage = `Expand this simple idea into a detailed cinematic video prompt:\n\n"${idea}"\n\n${styleHint}`;

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
        max_tokens: 300,
        temperature: 0.8,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("OpenAI error:", data);
      return NextResponse.json({ error: data.error?.message ?? "OpenAI request failed" }, { status: 400 });
    }

    const expanded = data.choices?.[0]?.message?.content?.trim();
    if (!expanded) return NextResponse.json({ error: "No response from OpenAI" }, { status: 500 });

    return NextResponse.json({ success: true, prompt: expanded });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Prompt expand error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
