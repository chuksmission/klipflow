import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCharge, isChargeId, refundCharge } from "../../../lib/charges";
import { getTaskStatus } from "../../../lib/task-status";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// A job still running after this long is treated as timed out (the Studio
// stops waiting after 5 minutes for most models).
const TIMEOUT_MS = 5 * 60 * 1000;
// A charge stuck "claimed" (start crashed before a job id came back)
const STALE_CLAIM_MS = 2 * 60 * 1000;

/**
 * Refund the remaining amount of one charge. The amount is never taken from
 * the request: it comes from the charge, which must belong to the caller,
 * still be open, and whose job must have failed, never started, or timed out.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { charge_id } = await req.json() as { charge_id?: string };
    if (!isChargeId(charge_id)) return NextResponse.json({ error: "A valid charge_id is required" }, { status: 400 });

    const charge = await getCharge(charge_id);
    if (!charge || charge.user_id !== user.id) return NextResponse.json({ error: "Charge not found" }, { status: 404 });
    if (charge.status === "completed" || charge.status === "refunded") {
      return NextResponse.json({ error: "This charge has already been settled." }, { status: 409 });
    }

    const age = Date.now() - new Date(charge.created_at).getTime();

    // Verify the job really didn't deliver before giving tokens back
    if (charge.task_id === "claimed") {
      if (age < STALE_CLAIM_MS) return NextResponse.json({ error: "This generation is still starting." }, { status: 409 });
    } else if (charge.task_id && charge.provider) {
      const status = await getTaskStatus(charge.task_id, charge.provider).catch(() => null);
      if (status?.completed) {
        return NextResponse.json({ error: "This generation succeeded, so it can't be refunded." }, { status: 409 });
      }
      if (!status?.failed && age < TIMEOUT_MS) {
        return NextResponse.json({ error: "This generation is still processing." }, { status: 409 });
      }
    }

    const result = await refundCharge(charge.id, user.id);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ balance: result.balance, refunded: result.refunded });
  } catch (error) {
    console.error("Refund error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
