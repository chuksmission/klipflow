import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const COLUMNS = "id, type, prompt, video_url, output_type, model, aspect_ratio, duration, featured_category, featured_title";
// Added by supabase/generation_language.sql and supabase/showcase_details.sql
const DETAIL_COLUMNS = ", language, accent, source_image_url, show_prompt, show_source_image, settings";

// Tools that work from the visitor's own uploaded video: only their settings are shown
const UPLOAD_TYPES = new Set(["video_remix", "series_cloner", "video_translation", "video_translator", "faceless_reels", "demo_video"]);
// Upload tools whose image input may still be shown (Actor Swap's new-performer photo)
const SOURCE_IMAGE_TYPES = new Set(["image_to_video", "ugc_ad", "image_ad", "text_to_image", "ai_actor_swap"]);

type Row = Record<string, unknown> & { type: string | null; prompt: string | null };

// Public: admin-curated generations for the homepage showcase.
// Only template-safe columns are returned (never user_id), and the prompt and
// source image only when the admin allows it.
export async function GET() {
  try {
    const query = (columns: string, sorted: boolean) => {
      const q = supabase
        .from("generations")
        .select(columns)
        .eq("is_featured", true)
        .eq("status", "completed");
      // Manual sort order first (supabase/showcase_studio.sql adds featured_sort)
      return (sorted ? q.order("featured_sort", { ascending: true }) : q)
        .order("created_at", { ascending: false })
        .limit(60);
    };

    // Fall back step by step while the newer columns don't exist yet
    let data: Row[] | null = null;
    for (const [columns, sorted] of [[COLUMNS + DETAIL_COLUMNS, true], [COLUMNS, true], [COLUMNS, false]] as const) {
      const res = await query(columns, sorted);
      if (!res.error) { data = res.data as unknown as Row[]; break; }
    }
    if (!data) return NextResponse.json({ items: [] });

    const items = data.map((row) => {
      const upload = UPLOAD_TYPES.has(row.type ?? "") || row.type === "ai_actor_swap";
      const showPrompt = !upload && row.show_prompt !== false;
      const showSource = SOURCE_IMAGE_TYPES.has(row.type ?? "") && row.show_source_image !== false;
      return {
        id: row.id,
        type: row.type,
        prompt: showPrompt ? row.prompt : null,
        video_url: row.video_url,
        output_type: row.output_type,
        model: row.model,
        aspect_ratio: row.aspect_ratio,
        duration: row.duration,
        featured_category: row.featured_category,
        featured_title: row.featured_title,
        language: row.language ?? null,
        accent: row.accent ?? null,
        source_image_url: showSource ? (row.source_image_url ?? null) : null,
        settings: row.settings && typeof row.settings === "object" ? row.settings : null,
      };
    });

    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch {
    return NextResponse.json({ items: [] });
  }
}
