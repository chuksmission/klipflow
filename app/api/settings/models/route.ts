import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Public endpoint — returns only enabled/disabled flags, no secrets
export async function GET() {
  try {
    const { data: settings } = await supabase
      .from("admin_settings")
      .select("key, value")
      .eq("category", "ai_providers")
      .eq("is_secret", false)
      .like("key", "%_enabled%");

    const map: Record<string, boolean> = {};
    settings?.forEach((s) => {
      map[s.key] = s.value === "true";
    });

    return NextResponse.json({ models: map });
  } catch {
    return NextResponse.json({ models: {} });
  }
}
