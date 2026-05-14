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
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: usersData } = await supabase.auth.admin.listUsers();
    const users = usersData?.users || [];
    const totalUsers = users.length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newToday = users.filter((u) => new Date(u.created_at) >= today).length;

    const recentUsers = users
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map((u) => ({ email: u.email, created_at: u.created_at }));

    const { data: generations } = await supabase
      .from("generations")
      .select("tokens_used, type, prompt, created_at")
      .order("created_at", { ascending: false });

    const totalGenerations = generations?.length || 0;
    const totalTokensUsed = generations?.reduce((sum, g) => sum + (g.tokens_used || 0), 0) || 0;
    const recentActivity = generations?.slice(0, 5) || [];

    const { count: totalLeads } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true });

    const { count: abuseAttempts } = await supabase
      .from("device_fingerprints")
      .select("*", { count: "exact", head: true })
      .eq("verified", false);

    return NextResponse.json({
      stats: {
        totalUsers,
        newToday,
        totalGenerations,
        totalTokensUsed,
        totalRevenue: 0,
        activeSubscriptions: 0,
        totalLeads: totalLeads || 0,
        abuseAttempts: abuseAttempts || 0,
      },
      recentUsers,
      recentActivity,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
