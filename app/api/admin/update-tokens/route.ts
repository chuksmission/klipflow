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
    .select("is_admin, role")
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

    const { user_id, amount, action } = await req.json();
    if (!user_id || !amount || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data: tokenData } = await supabase
      .from("user_tokens")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    let new_balance = 0;

    if (!tokenData) {
      new_balance = action === "set" ? amount : action === "add" ? 25 + amount : 25 - amount;
      await supabase.from("user_tokens").insert({
        user_id,
        balance: Math.max(0, new_balance),
        total_used: 0,
      });
    } else {
      if (action === "add") {
        new_balance = tokenData.balance + amount;
      } else if (action === "deduct") {
        new_balance = Math.max(0, tokenData.balance - amount);
      } else if (action === "set") {
        new_balance = Math.max(0, amount);
      }
      await supabase
        .from("user_tokens")
        .update({ balance: new_balance, updated_at: new Date().toISOString() })
        .eq("user_id", user_id);
    }

    return NextResponse.json({ success: true, new_balance });
  } catch (error) {
    console.error("Update tokens error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
