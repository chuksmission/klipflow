import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - fetch user's generations for gallery
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: generations, error } = await supabase
      .from("generations")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Generations fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ generations: generations ?? [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Generations GET error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - save a completed generation to gallery
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as {
      type?: string;
      prompt?: string;
      video_url?: string;
      status?: string;
      tokens_used?: number;
      duration?: string;
      aspect_ratio?: string;
      model?: string;
    };

    const { type, prompt, video_url, status, tokens_used, duration, aspect_ratio, model } = body;

    if (!video_url) return NextResponse.json({ error: "video_url is required" }, { status: 400 });

    const { data, error } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        type: type ?? "text_to_video",
        prompt: prompt ?? "",
        video_url,
        status: status ?? "completed",
        tokens_used: tokens_used ?? 0,
        duration: duration ?? "5",
        aspect_ratio: aspect_ratio ?? "16:9",
        model: model ?? "kling-v1-6-pro",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Generation save error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, generation: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Generations POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
