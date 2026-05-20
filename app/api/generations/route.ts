import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const outputType = searchParams.get("type"); // "video" or "image" or null for all

    let query = supabase
      .from("generations")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(100);

    if (outputType) query = query.eq("output_type", outputType);

    const { data: generations, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ generations: generations ?? [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
      image_url?: string;
      output_type?: string;
      status?: string;
      tokens_used?: number;
      duration?: string;
      aspect_ratio?: string;
      model?: string;
      provider?: string;
    };

    const {
      type,
      prompt,
      video_url,
      image_url,
      output_type,
      status,
      tokens_used,
      duration,
      aspect_ratio,
      model,
      provider,
    } = body;

    // Either video_url or image_url must be provided
    if (!video_url && !image_url) {
      return NextResponse.json({ error: "video_url or image_url is required" }, { status: 400 });
    }

    const finalOutputType = output_type ?? (image_url && !video_url ? "image" : "video");
    const finalUrl = video_url || image_url;

    const { data, error } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        type: type ?? "text_to_video",
        prompt: prompt ?? "",
        video_url: finalUrl,
        output_type: finalOutputType,
        status: status ?? "completed",
        tokens_used: tokens_used ?? 0,
        duration: duration ?? null,
        aspect_ratio: aspect_ratio ?? null,
        model: model ?? null,
        provider: provider ?? null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, generation: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
