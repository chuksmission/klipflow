import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { completeCharge, isChargeId } from "../../lib/charges";
import { parseOutputLanguage } from "../../lib/output-language";

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
      charge_id?: string;
      language?: string;
      accent?: string;
      source_image_url?: string;
      settings?: Record<string, unknown>;
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
      charge_id,
    } = body;

    // Either video_url or image_url must be provided
    if (!video_url && !image_url) {
      return NextResponse.json({ error: "video_url or image_url is required" }, { status: 400 });
    }

    const finalOutputType = output_type ?? (image_url && !video_url ? "image" : "video");
    const finalUrl = video_url || image_url;

    const row: Record<string, unknown> = {
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
    };
    const outputLanguage = parseOutputLanguage(body.language, body.accent);
    if (outputLanguage) { row.language = outputLanguage.code; row.accent = outputLanguage.accent || null; }

    // The input image (image modules), shown on the showcase when an admin features this
    const source = typeof body.source_image_url === "string" ? body.source_image_url.trim() : "";
    if (/^https:\/\/\S+$/.test(source) && source.length <= 2048) row.source_image_url = source;

    // Settings used (remix mode, languages, template...), shown on showcase cards for upload tools
    if (body.settings && typeof body.settings === "object" && !Array.isArray(body.settings)) {
      const settings = Object.fromEntries(Object.entries(body.settings)
        .filter(([k, v]) => /^[a-z_]{1,24}$/.test(k) && (typeof v === "string" || typeof v === "number"))
        .slice(0, 8).map(([k, v]) => [k, String(v).slice(0, 80)]));
      if (Object.keys(settings).length) row.settings = settings;
    }

    let { data, error } = await supabase.from("generations").insert(row).select().single();
    // Before the migrations add these columns (generation_language.sql, showcase_details.sql): save without them
    if (error && /language|accent|source_image_url|settings/.test(error.message)) {
      delete row.language; delete row.accent; delete row.source_image_url; delete row.settings;
      ({ data, error } = await supabase.from("generations").insert(row).select().single());
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // The result was delivered: close the charge so it can no longer be refunded
    if (isChargeId(charge_id)) await completeCharge(charge_id, user.id, data?.id != null ? String(data.id) : null);

    return NextResponse.json({ success: true, generation: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
