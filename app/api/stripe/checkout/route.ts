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
    if (!stripe) {
      return NextResponse.json({ error: "Payment system not configured. Please contact support." }, { status: 503 });
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { type, priceId, tokens, amount } = await req.json();

    let session;

    if (type === "subscription") {
      // Subscription plan checkout
      session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: process.env.NEXT_PUBLIC_APP_URL + "/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}",
        cancel_url: process.env.NEXT_PUBLIC_APP_URL + "/dashboard/billing?cancelled=true",
        customer_email: user.email,
        metadata: {
          user_id: user.id,
          type: "subscription",
        },
      });
    } else if (type === "token_topup") {
      // Token top-up one-time payment
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: {
              name: tokens + " KlipflowAI Tokens",
              description: "AI video generation credits for KlipflowAI",
            },
            unit_amount: amount * 100, // amount in cents
          },
          quantity: 1,
        }],
        success_url: process.env.NEXT_PUBLIC_APP_URL + "/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}",
        cancel_url: process.env.NEXT_PUBLIC_APP_URL + "/dashboard/billing?cancelled=true",
        customer_email: user.email,
        metadata: {
          user_id: user.id,
          type: "token_topup",
          tokens: tokens.toString(),
        },
      });
    } else {
      return NextResponse.json({ error: "Invalid checkout type" }, { status: 400 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: error.message || "Something went wrong" }, { status: 500 });
  }
}
