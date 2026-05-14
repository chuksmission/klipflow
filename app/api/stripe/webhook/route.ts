import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripe } from "../../../lib/stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      console.error("Webhook signature failed:", err.message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const userId = session.metadata?.user_id;
        const type = session.metadata?.type;

        if (!userId) break;

        if (type === "token_topup") {
          const tokens = parseInt(session.metadata?.tokens || "0");
          if (tokens > 0) {
            const { data: tokenData } = await supabase
              .from("user_tokens")
              .select("balance")
              .eq("user_id", userId)
              .maybeSingle();

            const currentBalance = tokenData?.balance || 0;
            await supabase.from("user_tokens").upsert({
              user_id: userId,
              balance: currentBalance + tokens,
              updated_at: new Date().toISOString(),
            }, { onConflict: "user_id" });

            console.log("Added " + tokens + " tokens to user " + userId);
          }
        } else if (type === "subscription") {
          await supabase.from("user_profiles").upsert({
            id: userId,
            plan: "paid",
            updated_at: new Date().toISOString(),
          }, { onConflict: "id" });
          console.log("Subscription activated for user " + userId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        // Subscription cancelled
        const subscription = event.data.object as any;
        console.log("Subscription cancelled:", subscription.id);
        break;
      }

      case "invoice.payment_failed": {
        console.log("Payment failed for invoice:", (event.data.object as any).id);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
