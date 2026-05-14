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
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin, role")
      .eq("id", user.id)
      .single();
    if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: usersData } = await supabase.auth.admin.listUsers();
    const authUsers = usersData?.users || [];

    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, is_admin, is_banned, role");

    const { data: tokens } = await supabase
      .from("user_tokens")
      .select("user_id, balance");

    const profileMap: Record<string, any> = {};
    profiles?.forEach((p) => { profileMap[p.id] = p; });

    const tokenMap: Record<string, number> = {};
    tokens?.forEach((t) => { tokenMap[t.user_id] = t.balance; });

    const formattedUsers = authUsers.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      provider: u.app_metadata?.provider,
      email_confirmed: !!u.email_confirmed_at,
      is_admin: profileMap[u.id]?.is_admin || false,
      is_banned: profileMap[u.id]?.is_banned || false,
      role: profileMap[u.id]?.role || "user",
      token_balance: tokenMap[u.id] ?? 25,
    }));

    return NextResponse.json({ users: formattedUsers });
  } catch (error) {
    console.error("Admin users error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
