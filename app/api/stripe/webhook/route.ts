import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripe, getStripeWebhookSecret } from "../../../lib/stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUserIdFromCustomer(customerId: string): Promise<string | null> {
  // Check subscriptions table first
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (sub?.user_id) return sub.user_id;

  // Fallback: check user_profiles
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return profile?.id ?? null;
}

async function allocateTokensForPlan(userId: string, planId: number) {
  const { data: plan } = await supabase
    .from("plans")
    .select("tokens_per_month")
    .eq("id", planId)
    .single();

  if (!plan?.tokens_per_month) return;

  await supabase.from("user_tokens").upsert({
    user_id: userId,
    balance: plan.tokens_per_month,
    total_used: 0,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
}

export async function POST(req: NextRequest) {
  try {
    const stripe = await getStripe();
    if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = await getStripeWebhookSecret();

    if (!signature || !webhookSecret) {
      return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature failed:", err.message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    console.log("Stripe webhook event:", event.type);

    switch (event.type) {

      // ================================================================
      // CHECKOUT COMPLETED — subscription or token top-up
      // ================================================================
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const userId = session.metadata?.user_id;
        const type = session.metadata?.type;
        const customerId = session.customer;

        if (!userId) { console.error("No user_id in metadata"); break; }

        // Store customer ID on user profile
        if (customerId) {
          await supabase.from("user_profiles").update({
            stripe_customer_id: customerId,
          }).eq("id", userId);
        }

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
          const stripeSubId = session.subscription;
          if (!stripeSubId) break;

          // Fetch full subscription from Stripe
          const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
          const planId = session.metadata?.plan_id ? parseInt(session.metadata.plan_id) : null;

          // Upsert subscription record
          await supabase.from("subscriptions").upsert({
            user_id: userId,
            plan_id: planId,
            stripe_subscription_id: stripeSubId,
            stripe_customer_id: customerId,
            status: stripeSub.status,
            current_period_start: new Date((stripeSub as any).current_period_start * 1000).toISOString(),
            current_period_end: new Date((stripeSub as any).current_period_end * 1000).toISOString(),
            cancel_at_period_end: stripeSub.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          }, { onConflict: "stripe_subscription_id" });

          // Update user profile
          await supabase.from("user_profiles").update({
            subscription_status: "active",
            stripe_subscription_id: stripeSubId,
            stripe_customer_id: customerId,
            plan_expires_at: new Date((stripeSub as any).current_period_end * 1000).toISOString(),
            tokens_reset_at: new Date().toISOString(),
          }).eq("id", userId);

          // Allocate tokens for the plan
          if (planId) await allocateTokensForPlan(userId, planId);

          console.log("Subscription activated for user " + userId);
        }
        break;
      }

      // ================================================================
      // SUBSCRIPTION UPDATED — plan change, renewal
      // ================================================================
      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        const customerId = subscription.customer;
        const userId = await getUserIdFromCustomer(customerId);

        if (!userId) { console.error("No user found for customer:", customerId); break; }

        await supabase.from("subscriptions").update({
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        }).eq("stripe_subscription_id", subscription.id);

        await supabase.from("user_profiles").update({
          subscription_status: subscription.status,
          plan_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
        }).eq("id", userId);

        console.log("Subscription updated for user " + userId + " status: " + subscription.status);
        break;
      }

      // ================================================================
      // SUBSCRIPTION DELETED — cancelled
      // ================================================================
      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const customerId = subscription.customer;
        const userId = await getUserIdFromCustomer(customerId);

        if (!userId) { console.error("No user found for customer:", customerId); break; }

        await supabase.from("subscriptions").update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        }).eq("stripe_subscription_id", subscription.id);

        await supabase.from("user_profiles").update({
          subscription_status: "cancelled",
          stripe_subscription_id: null,
          plan_expires_at: null,
        }).eq("id", userId);

        console.log("Subscription cancelled for user " + userId);
        break;
      }

      // ================================================================
      // INVOICE PAYMENT SUCCEEDED — monthly renewal
      // ================================================================
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any;
        if (invoice.billing_reason !== "subscription_cycle") break;

        const customerId = invoice.customer;
        const userId = await getUserIdFromCustomer(customerId);
        if (!userId) break;

        // Refresh tokens on renewal
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("plan_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (sub?.plan_id) await allocateTokensForPlan(userId, sub.plan_id);

        await supabase.from("user_profiles").update({
          subscription_status: "active",
          tokens_reset_at: new Date().toISOString(),
        }).eq("id", userId);

        console.log("Tokens refreshed for user " + userId + " on renewal");
        break;
      }

      // ================================================================
      // INVOICE PAYMENT FAILED
      // ================================================================
      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        const customerId = invoice.customer;
        const userId = await getUserIdFromCustomer(customerId);

        if (!userId) break;

        await supabase.from("user_profiles").update({
          subscription_status: "past_due",
        }).eq("id", userId);

        await supabase.from("subscriptions").update({
          status: "past_due",
          updated_at: new Date().toISOString(),
        }).eq("stripe_customer_id", customerId);

        console.log("Payment failed for user " + userId);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
