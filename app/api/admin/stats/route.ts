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
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // ---- USERS ----
    const { data: usersData } = await supabase.auth.admin.listUsers();
    const users = usersData?.users || [];
    const totalUsers = users.length;
    const newToday = users.filter((u) => new Date(u.created_at) >= today).length;
    const recentUsers = users
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map((u) => ({ email: u.email, created_at: u.created_at }));

    // ---- GENERATIONS ----
    const { data: generations } = await supabase
      .from("generations")
      .select("tokens_used, type, prompt, created_at, model")
      .order("created_at", { ascending: false });

    const totalGenerations = generations?.length || 0;
    const totalTokensUsed = generations?.reduce((sum, g) => sum + (g.tokens_used || 0), 0) || 0;
    const generationsToday = generations?.filter(g => new Date(g.created_at) >= today).length || 0;
    const generationsThisWeek = generations?.filter(g => new Date(g.created_at) >= last7).length || 0;
    const recentActivity = generations?.slice(0, 5) || [];

    // ---- SUBSCRIPTIONS & REVENUE ----
    const { data: subscriptions } = await supabase
      .from("subscriptions")
      .select("status, current_period_start, current_period_end, plan_id")
      .eq("status", "active");

    const activeSubscriptions = subscriptions?.length || 0;

    // Get plan prices for MRR calculation
    const { data: plans } = await supabase
      .from("plans")
      .select("id, price_monthly");

    const planPriceMap: Record<number, number> = {};
    plans?.forEach(p => { planPriceMap[p.id] = p.price_monthly || 0; });

    const mrr = subscriptions?.reduce((sum, sub) => {
      return sum + (sub.plan_id ? planPriceMap[sub.plan_id] || 0 : 0);
    }, 0) || 0;

    // ---- TRAFFIC ----
    const { data: visitsActive } = await supabase
      .from("page_visits")
      .select("session_id")
      .gte("created_at", last5min.toISOString());

    const { data: visitsToday } = await supabase
      .from("page_visits")
      .select("session_id")
      .gte("created_at", today.toISOString());

    const { data: visits7d } = await supabase
      .from("page_visits")
      .select("session_id")
      .gte("created_at", last7.toISOString());

    const { data: visits30d } = await supabase
      .from("page_visits")
      .select("session_id, country, country_code, page, created_at")
      .gte("created_at", last30.toISOString());

    // Unique visitors (by session_id)
    const uniqueActive = new Set(visitsActive?.map(v => v.session_id)).size;
    const uniqueToday = new Set(visitsToday?.map(v => v.session_id)).size;
    const unique7d = new Set(visits7d?.map(v => v.session_id)).size;
    const unique30d = new Set(visits30d?.map(v => v.session_id)).size;

    // Top countries
    const countryMap: Record<string, { count: number; code: string }> = {};
    visits30d?.forEach(v => {
      if (!v.country) return;
      if (!countryMap[v.country]) countryMap[v.country] = { count: 0, code: v.country_code || "" };
      countryMap[v.country].count++;
    });
    const topCountries = Object.entries(countryMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([country, data]) => ({ country, code: data.code, visits: data.count }));

    // Top pages
    const pageMap: Record<string, number> = {};
    visits30d?.forEach(v => {
      if (!v.page) return;
      pageMap[v.page] = (pageMap[v.page] || 0) + 1;
    });
    const topPages = Object.entries(pageMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([page, visits]) => ({ page, visits }));

    // Daily traffic for chart (last 7 days)
    const dailyTraffic: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split("T")[0];
      dailyTraffic[key] = 0;
    }
    visits7d?.forEach(v => {
      const key = new Date(v.session_id || now).toISOString().split("T")[0];
    });
    // Use visits30d for daily breakdown
    const { data: visits7dFull } = await supabase
      .from("page_visits")
      .select("created_at")
      .gte("created_at", last7.toISOString());
    visits7dFull?.forEach(v => {
      const key = new Date(v.created_at).toISOString().split("T")[0];
      if (dailyTraffic[key] !== undefined) dailyTraffic[key]++;
    });
    const trafficChart = Object.entries(dailyTraffic).map(([date, visits]) => ({ date, visits }));

    // ---- LEADS ----
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
        generationsToday,
        generationsThisWeek,
        totalTokensUsed,
        totalRevenue: mrr,
        mrr,
        activeSubscriptions,
        totalLeads: totalLeads || 0,
        abuseAttempts: abuseAttempts || 0,
      },
      traffic: {
        activeNow: uniqueActive,
        today: uniqueToday,
        last7days: unique7d,
        last30days: unique30d,
        topCountries,
        topPages,
        chart: trafficChart,
      },
      recentUsers,
      recentActivity,
    });

  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
