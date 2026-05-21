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

    const now = new Date();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last5min = new Date(now.getTime() - 5 * 60 * 1000);

    // ---- USERS ----
    let totalUsers = 0, newToday = 0, recentUsers: any[] = [];
    try {
      const { data: usersData } = await supabase.auth.admin.listUsers();
      const users = usersData?.users || [];
      totalUsers = users.length;
      newToday = users.filter((u) => new Date(u.created_at) >= today).length;
      recentUsers = users
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map((u) => ({ email: u.email, created_at: u.created_at }));
    } catch (e) { console.error("Users error:", e); }

    // ---- GENERATIONS ----
    let totalGenerations = 0, generationsToday = 0, totalTokensUsed = 0, recentActivity: any[] = [];
    try {
      const { data: generations } = await supabase
        .from("generations")
        .select("tokens_used, type, prompt, created_at")
        .order("created_at", { ascending: false });
      totalGenerations = generations?.length || 0;
      totalTokensUsed = generations?.reduce((sum, g) => sum + (g.tokens_used || 0), 0) || 0;
      generationsToday = generations?.filter(g => new Date(g.created_at) >= today).length || 0;
      recentActivity = generations?.slice(0, 5) || [];
    } catch (e) { console.error("Generations error:", e); }

    // ---- SUBSCRIPTIONS ----
    let activeSubscriptions = 0, mrr = 0;
    try {
      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("status, plan_id")
        .eq("status", "active");
      activeSubscriptions = subscriptions?.length || 0;

      if (activeSubscriptions > 0) {
        const { data: plans } = await supabase.from("plans").select("id, price_monthly");
        const planPriceMap: Record<number, number> = {};
        plans?.forEach(p => { planPriceMap[p.id] = p.price_monthly || 0; });
        mrr = subscriptions?.reduce((sum, sub) => sum + (sub.plan_id ? planPriceMap[sub.plan_id] || 0 : 0), 0) || 0;
      }
    } catch (e) { console.error("Subscriptions error:", e); }

    // ---- TRAFFIC ----
    let activeNow = 0, visitorsToday = 0, visitors7d = 0, visitors30d = 0;
    let topCountries: any[] = [], topPages: any[] = [], trafficChart: any[] = [];
    try {
      const [r1, r2, r3, r4] = await Promise.all([
        supabase.from("page_visits").select("session_id").gte("created_at", last5min.toISOString()),
        supabase.from("page_visits").select("session_id").gte("created_at", today.toISOString()),
        supabase.from("page_visits").select("session_id").gte("created_at", last7.toISOString()),
        supabase.from("page_visits").select("session_id, country, country_code, page, created_at").gte("created_at", last30.toISOString()),
      ]);

      activeNow = new Set(r1.data?.map(v => v.session_id)).size;
      visitorsToday = new Set(r2.data?.map(v => v.session_id)).size;
      visitors7d = new Set(r3.data?.map(v => v.session_id)).size;
      visitors30d = new Set(r4.data?.map(v => v.session_id)).size;

      // Top countries
      const countryMap: Record<string, { count: number; code: string }> = {};
      r4.data?.forEach(v => {
        if (!v.country) return;
        if (!countryMap[v.country]) countryMap[v.country] = { count: 0, code: v.country_code || "" };
        countryMap[v.country].count++;
      });
      topCountries = Object.entries(countryMap)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([country, data]) => ({ country, code: data.code, visits: data.count }));

      // Top pages
      const pageMap: Record<string, number> = {};
      r4.data?.forEach(v => { if (v.page) pageMap[v.page] = (pageMap[v.page] || 0) + 1; });
      topPages = Object.entries(pageMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([page, visits]) => ({ page, visits }));

      // Daily chart last 7 days
      const dailyMap: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        dailyMap[d.toISOString().split("T")[0]] = 0;
      }
      r3.data?.forEach(v => {
        const key = new Date(v.session_id || now).toISOString().split("T")[0];
      });
      // Use r4 for daily breakdown
      const { data: daily7d } = await supabase
        .from("page_visits")
        .select("created_at")
        .gte("created_at", last7.toISOString());
      daily7d?.forEach(v => {
        const key = new Date(v.created_at).toISOString().split("T")[0];
        if (dailyMap[key] !== undefined) dailyMap[key]++;
      });
      trafficChart = Object.entries(dailyMap).map(([date, visits]) => ({ date, visits }));

    } catch (e) { console.error("Traffic error:", e); }

    // ---- LEADS & ABUSE ----
    let totalLeads = 0, abuseAttempts = 0;
    try {
      const { count: l } = await supabase.from("leads").select("*", { count: "exact", head: true });
      totalLeads = l || 0;
    } catch (e) { console.error("Leads error:", e); }
    try {
      const { count: a } = await supabase.from("device_fingerprints").select("*", { count: "exact", head: true }).eq("verified", false);
      abuseAttempts = a || 0;
    } catch (e) { console.error("Abuse error:", e); }

    return NextResponse.json({
      stats: {
        totalUsers, newToday, totalGenerations, generationsToday,
        totalTokensUsed, mrr, activeSubscriptions, totalLeads, abuseAttempts,
      },
      traffic: {
        activeNow, today: visitorsToday, last7days: visitors7d, last30days: visitors30d,
        topCountries, topPages, chart: trafficChart,
      },
      recentUsers,
      recentActivity,
    });

  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}