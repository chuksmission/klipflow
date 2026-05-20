import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data } = await supabase
      .from("token_pricing")
      .select("action, tokens")
      .order("id");
    const map: Record<string, number> = {};
    data?.forEach((item) => { map[item.action] = item.tokens; });
    return NextResponse.json({ pricing: map });
  } catch {
    return NextResponse.json({ pricing: {} });
  }
}