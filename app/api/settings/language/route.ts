import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isLocale } from "../../../../i18n/config";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function userFrom(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

/** The signed-in user's interface language (null until they choose one). */
export async function GET(req: NextRequest) {
  const user = await userFrom(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("user_profiles").select("ui_language").eq("id", user.id).maybeSingle();
  // Before supabase/ui_language.sql runs the column doesn't exist: behave as "not chosen"
  if (error) return NextResponse.json({ locale: null });
  return NextResponse.json({ locale: isLocale(data?.ui_language) ? data!.ui_language : null });
}

export async function POST(req: NextRequest) {
  const user = await userFrom(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { locale } = await req.json().catch(() => ({})) as { locale?: string };
  if (!isLocale(locale)) return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  const { error } = await supabase.from("user_profiles").update({ ui_language: locale }).eq("id", user.id);
  return NextResponse.json({ ok: !error });
}
