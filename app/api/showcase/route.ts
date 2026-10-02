import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Public: admin-curated generations for the homepage showcase.
// Only template-safe columns are returned (never user_id).
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("generations")
      .select("id, type, prompt, video_url, output_type, model, aspect_ratio, duration, featured_category, featured_title")
      .eq("is_featured", true)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) return NextResponse.json({ items: [] });
    return NextResponse.json(
      { items: data ?? [] },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch {
    return NextResponse.json({ items: [] });
  }
}
