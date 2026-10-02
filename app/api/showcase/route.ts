import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const COLUMNS = "id, type, prompt, video_url, output_type, model, aspect_ratio, duration, featured_category, featured_title";

// Public: admin-curated generations for the homepage showcase.
// Only template-safe columns are returned (never user_id).
export async function GET() {
  try {
    const base = () => supabase
      .from("generations")
      .select(COLUMNS)
      .eq("is_featured", true)
      .eq("status", "completed");

    // Manual sort order first (supabase/showcase_studio.sql adds featured_sort)...
    let { data, error } = await base()
      .order("featured_sort", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(60);

    // ...falling back to newest-first if that column doesn't exist yet
    if (error) {
      ({ data, error } = await base().order("created_at", { ascending: false }).limit(60));
    }

    if (error) return NextResponse.json({ items: [] });
    return NextResponse.json(
      { items: data ?? [] },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch {
    return NextResponse.json({ items: [] });
  }
}
