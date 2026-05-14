import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAdmin(token: string) {
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  return profile?.is_admin ? user : null;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const admin = await checkAdmin(authHeader.replace("Bearer ", ""));
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { user_id, ban } = await req.json();
    if (!user_id) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

    await supabase
      .from("user_profiles")
      .upsert({ id: user_id, is_banned: ban }, { onConflict: "id" });

    if (ban) {
      await supabase.auth.admin.signOut(user_id, "global");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Ban user error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
