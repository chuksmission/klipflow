// Server-side token charges (see supabase/token_charges.sql).
// A charge is created when tokens are deducted. It pays for exactly one job,
// can be refunded only up to what remains on it, and closes when the result
// is saved to the gallery. Import only from API routes.
import { createClient } from "@supabase/supabase-js";
import { VIDEO_MODELS } from "../components/catalog";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface Charge {
  id: string;
  user_id: string;
  amount: number;
  refunded_amount: number;
  status: "charged" | "partially_refunded" | "refunded" | "completed";
  feature: string | null;
  task_id: string | null;
  provider: string | null;
  created_at: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isChargeId = (id: unknown): id is string => typeof id === "string" && UUID.test(id);

// ---- pricing (server-side source of truth for minimum charges) ----

export async function getTokenPrice(action: string, fallback: number): Promise<number> {
  const { data } = await supabase.from("token_pricing").select("tokens").eq("action", action).maybeSingle();
  return typeof data?.tokens === "number" ? data.tokens : fallback;
}

export async function videoModelPrice(model: string): Promise<number> {
  const fallback = VIDEO_MODELS.find((m) => m.id === model)?.tokens ?? 10;
  return getTokenPrice(model, fallback);
}

// ---- lifecycle ----

export async function createCharge(userId: string, amount: number, feature: string | null) {
  const { data, error } = await supabase.rpc("charge_tokens", { p_user_id: userId, p_amount: amount, p_feature: feature ?? "" });
  if (error) {
    if (error.message.includes("insufficient_tokens")) return { error: "Insufficient token balance", status: 400 };
    if (error.message.includes("invalid_amount")) return { error: "Invalid amount", status: 400 };
    console.error("charge_tokens error:", error);
    return { error: "Couldn't reserve tokens. Please try again.", status: 500 };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { chargeId: row.out_charge_id as string, balance: row.out_balance as number, totalUsed: row.out_total_used as number };
}

export async function getCharge(chargeId: string): Promise<Charge | null> {
  if (!isChargeId(chargeId)) return null;
  const { data } = await supabase.from("token_charges").select("*").eq("id", chargeId).maybeSingle();
  return (data as Charge) ?? null;
}

/**
 * Reserve an unused, paid charge for one provider job. Fails if the charge is
 * missing, already used, closed, or doesn't cover `minAmount`.
 */
export async function claimCharge(chargeId: unknown, minAmount: number, userId?: string): Promise<{ charge?: Charge; error?: string }> {
  if (!isChargeId(chargeId)) return { error: "A paid charge is required to start this generation." };
  let query = supabase
    .from("token_charges")
    .update({ task_id: "claimed" })
    .eq("id", chargeId)
    .eq("status", "charged")
    .is("task_id", null)
    .gte("amount", minAmount);
  if (userId) query = query.eq("user_id", userId);
  const { data } = await query.select("*").maybeSingle();
  if (data) return { charge: data as Charge };

  const existing = await getCharge(chargeId);
  if (!existing || (userId && existing.user_id !== userId)) return { error: "Charge not found." };
  if (existing.status !== "charged") return { error: "This charge has already been settled." };
  if (existing.task_id) return { error: "This charge has already been used for a generation." };
  return { error: `This generation costs ${minAmount} tokens.` };
}

export async function attachTask(chargeId: string, taskId: string, provider: string) {
  await supabase.from("token_charges").update({ task_id: taskId, provider }).eq("id", chargeId).eq("task_id", "claimed");
}

// Start failed before a provider job existed: free the charge so it can be refunded
export async function releaseClaim(chargeId: string) {
  await supabase.from("token_charges").update({ task_id: null }).eq("id", chargeId).eq("task_id", "claimed");
}

export async function refundCharge(chargeId: string, userId: string, amount?: number) {
  const { data, error } = await supabase.rpc("refund_token_charge", { p_charge_id: chargeId, p_user_id: userId, p_amount: amount ?? null });
  if (error) {
    if (error.message.includes("charge_not_found")) return { error: "Charge not found.", status: 404 };
    if (error.message.includes("charge_closed")) return { error: "This charge has already been settled.", status: 409 };
    if (error.message.includes("invalid_amount")) return { error: "Nothing left to refund on this charge.", status: 409 };
    console.error("refund_token_charge error:", error);
    return { error: "Refund failed. Please contact support.", status: 500 };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { refunded: row.out_refunded as number, balance: row.out_balance as number };
}

export async function completeCharge(chargeId: string, userId: string, generationId: string | null) {
  await supabase
    .from("token_charges")
    .update({ status: "completed", generation_id: generationId, settled_at: new Date().toISOString() })
    .eq("id", chargeId)
    .eq("user_id", userId)
    .in("status", ["charged", "partially_refunded"]);
}

// ---- admin bypass (admin tools spend the separate showcase balance) ----

export async function isAdminRequest(authHeader: string | null): Promise<boolean> {
  if (!authHeader) return false;
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!user) return false;
  const { data: profile } = await supabase.from("user_profiles").select("is_admin").eq("id", user.id).single();
  return !!profile?.is_admin;
}
