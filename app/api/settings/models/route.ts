import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: settings } = await supabase
      .from("admin_settings")
      .select("key, value")
      .eq("category", "ai_providers")
      .eq("is_secret", false);

    const models: Record<string, boolean> = {};
    const labels: Record<string, string> = {};
    const descs: Record<string, string> = {};
    const badges: Record<string, string> = {};

    settings?.forEach((s) => {
      if (s.key.endsWith("_enabled")) models[s.key] = s.value === "true";
      else if (s.key.startsWith("model_label_")) labels[s.key.replace("model_label_", "")] = s.value ?? "";
      else if (s.key.startsWith("model_desc_")) descs[s.key.replace("model_desc_", "")] = s.value ?? "";
      else if (s.key.startsWith("model_badges_")) badges[s.key.replace("model_badges_", "")] = s.value ?? "";
    });

    return NextResponse.json({ models, labels, descs, badges });
  } catch {
    return NextResponse.json({ models: {}, labels: {}, descs: {}, badges: {} });
  }
}