// Browser helpers for the secure token flow: deduct (creates a charge) and
// refund that charge. Refund amounts are decided by the server, never here.
import { supabase } from "./supabase";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token } : null;
}

// Where charges are paid from. Showcase Studio switches to "showcase" (the
// admin showcase balance) while it hosts a Studio module, then back.
let pool: "user" | "showcase" = "user";
export function setChargePool(next: "user" | "showcase") { pool = next; }

export async function chargeTokens(amount: number, feature: string): Promise<{ ok: true; chargeId: string; balance: number } | { ok: false; error: string }> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Please sign in." };
  try {
    const res = await fetch("/api/tokens", { method: "POST", headers, body: JSON.stringify({ amount, feature, pool }) });
    const data = await res.json();
    if (!res.ok || !data.charge_id) return { ok: false, error: data.error ?? "Insufficient tokens." };
    return { ok: true, chargeId: data.charge_id, balance: data.balance };
  } catch {
    return { ok: false, error: "Couldn't reserve tokens. Please try again." };
  }
}

export async function refundCharge(chargeId: string | null | undefined): Promise<{ ok: boolean; balance?: number; error?: string }> {
  if (!chargeId) return { ok: false };
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Please sign in." };
  try {
    const res = await fetch("/api/tokens/refund", { method: "POST", headers, body: JSON.stringify({ charge_id: chargeId }) });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    return { ok: true, balance: data.balance };
  } catch {
    return { ok: false, error: "Refund failed." };
  }
}

// Message suffix describing what happened to the user's tokens
export const refundNote = (r: { ok: boolean; error?: string }) =>
  r.ok ? " Tokens refunded." : r.error ? ` ${r.error}` : "";
