import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { amount } = await req.json() as { amount: number };
    if (!amount || amount <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

    const { data: tokenData } = await supabase.from("user_tokens").select("balance, total_used").eq("user_id", user.id).single();
    if (!tokenData) return NextResponse.json({ error: "Token record not found" }, { status: 404 });

    const { data: updated } = await supabase.from("user_tokens").update({
      balance: tokenData.balance + amount,
      total_used: Math.max(0, tokenData.total_used - amount),
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id).select().single();

    return NextResponse.json({ balance: updated?.balance, refunded: amount });
  } catch (error) {
    console.error("Refund error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
