import { writeFileSync, mkdirSync } from 'fs';

// ============================================
// 1. GALLERY PAGE - Fixed with proper auth
// ============================================
writeFileSync('app/dashboard/gallery/page.tsx', `"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function Gallery() {
  const [generations, setGenerations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchGenerations();
  }, []);

  const fetchGenerations = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data, error } = await supabase
      .from("generations")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    if (!error) setGenerations(data || []);
    setLoading(false);
  };

  const filtered = filter === "all" ? generations : generations.filter((g) => g.type?.includes(filter));

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold mb-1">Gallery</h1>
          <p className="text-gray-400 text-sm">{generations.length} total generations</p>
        </div>
        <div className="flex gap-2">
          {["all", "video", "image"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={"px-4 py-2 rounded-xl text-xs font-bold transition capitalize " + (filter === f ? "bg-purple-600 text-white" : "bg-white/10 text-gray-400 hover:bg-white/20")}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl aspect-video animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">🎬</div>
          <h3 className="font-bold text-lg mb-2">No content yet</h3>
          <p className="text-gray-400 text-sm mb-6">Generated videos and images will appear here</p>
          <a href="/dashboard/studio" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full transition inline-block text-sm">
            Generate First Video
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filtered.map((gen, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden group">
              {gen.video_url ? (
                <video src={gen.video_url} className="w-full aspect-video object-cover" muted playsInline onError={(e) => { (e.target as HTMLVideoElement).style.display = "none"; }} />
              ) : (
                <div className="w-full aspect-video bg-gray-900 flex items-center justify-center text-gray-600 text-sm">No preview</div>
              )}
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-purple-400 text-xs font-bold capitalize">{gen.type?.replace(/_/g, " ")}</span>
                  <span className="text-gray-600 text-xs">{gen.tokens_used} tokens</span>
                </div>
                <p className="text-gray-400 text-xs truncate mb-2">{gen.prompt}</p>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-xs">{new Date(gen.created_at).toLocaleDateString()}</span>
                  {gen.video_url && (
                    <button onClick={() => handleDownload(gen.video_url, "klipflowai-" + gen.id + ".mp4")} className="text-purple-400 hover:text-white text-xs transition font-semibold">
                      Download
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
`, 'utf8');
console.log('Fixed gallery page');

// ============================================
// 2. ACTIVITY PAGE - Real generation history
// ============================================
writeFileSync('app/dashboard/activity/page.tsx', `"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function Activity() {
  const [generations, setGenerations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase
        .from("generations")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!error) setGenerations(data || []);
      setLoading(false);
    };
    fetchActivity();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold mb-1">Activity Log</h1>
        <p className="text-gray-400 text-sm">Your last 50 generations</p>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : generations.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">⚡</div>
          <h3 className="font-bold text-lg mb-2">No activity yet</h3>
          <p className="text-gray-400 text-sm">Every generation, post, and action will be logged here</p>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-4 text-gray-500 text-xs font-bold uppercase px-4 py-3 border-b border-white/10">
            <span className="col-span-2">Prompt</span>
            <span>Type</span>
            <span>Tokens</span>
          </div>
          {generations.map((gen, i) => (
            <div key={i} className="grid grid-cols-4 items-center px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition">
              <div className="col-span-2 truncate text-gray-300 text-sm pr-4">{gen.prompt}</div>
              <div className="capitalize text-purple-400 text-xs">{gen.type?.replace(/_/g, " ")}</div>
              <div className="flex items-center justify-between">
                <span className="text-yellow-400 text-xs font-bold">{gen.tokens_used} tokens</span>
                <span className="text-gray-600 text-xs">{new Date(gen.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
`, 'utf8');
console.log('Fixed activity page');

// ============================================
// 3. CONTACT PAGE
// ============================================
mkdirSync('app/contact', { recursive: true });
writeFileSync('app/contact/page.tsx', `"use client";
import { useState } from "react";
import Link from "next/link";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.message) {
      setError("Please fill in all required fields.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setSent(true);
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h1 className="text-3xl font-extrabold mb-4">Message Sent!</h1>
          <p className="text-gray-400 mb-6">Thanks for reaching out! We will get back to you within 24 hours.</p>
          <Link href="/" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full transition inline-block">
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <Link href="/" className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent inline-block mb-6">
            KlipflowAI
          </Link>
          <h1 className="text-4xl font-extrabold mb-4">Get in Touch</h1>
          <p className="text-gray-400 text-lg">Have a question or need help? We would love to hear from you.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold mb-4">Contact Information</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-purple-900/40 border border-purple-500/30 rounded-xl flex items-center justify-center text-lg">📧</div>
                  <div>
                    <div className="text-sm font-semibold">Email</div>
                    <div className="text-gray-400 text-sm">support@klipflowai.com</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-purple-900/40 border border-purple-500/30 rounded-xl flex items-center justify-center text-lg">⚡</div>
                  <div>
                    <div className="text-sm font-semibold">Response Time</div>
                    <div className="text-gray-400 text-sm">Within 24 hours</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-6">
              <h3 className="font-bold mb-3">Try KlipflowAI Free</h3>
              <p className="text-gray-400 text-sm mb-4">Get 25 free tokens and generate your first AI video today. No credit card required.</p>
              <Link href="/signup" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-full transition inline-block text-sm">
                Get Started Free
              </Link>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-bold">Send a Message</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Full Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Phone (optional)</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 234 567 8900" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm" />
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Email Address *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Message *</label>
              <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="How can we help you?" rows={5} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm resize-none" />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={handleSubmit} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition">
              {loading ? "Sending..." : "Send Message"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
`, 'utf8');
console.log('Created contact page');

// ============================================
// 4. CONTACT API
// ============================================
mkdirSync('app/api/contact', { recursive: true });
writeFileSync('app/api/contact/route.ts', `import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, message } = await req.json();
    if (!name || !email || !message) {
      return NextResponse.json({ error: "Name, email and message are required" }, { status: 400 });
    }

    const { error } = await supabase.from("leads").insert({
      name,
      email,
      phone: phone || null,
      message,
      source: "contact_page",
      is_read: false,
    });

    if (error) {
      console.error("Lead insert error:", error);
      return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact API error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
`, 'utf8');
console.log('Created contact API');

// ============================================
// 5. STRIPE FOUNDATION - Ready for keys
// ============================================
mkdirSync('app/lib', { recursive: true });
writeFileSync('app/lib/stripe.ts', `import Stripe from "stripe";

// Stripe client - initialized with secret key from admin settings or env
export const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-12-18.acacia" as any });
};
`, 'utf8');
console.log('Created Stripe lib');

// ============================================
// 6. STRIPE CHECKOUT API
// ============================================
mkdirSync('app/api/stripe/checkout', { recursive: true });
writeFileSync('app/api/stripe/checkout/route.ts', `import { NextRequest, NextResponse } from "next/server";
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
`, 'utf8');
console.log('Created Stripe checkout API');

// ============================================
// 7. STRIPE WEBHOOK
// ============================================
mkdirSync('app/api/stripe/webhook', { recursive: true });
writeFileSync('app/api/stripe/webhook/route.ts', `import { NextRequest, NextResponse } from "next/server";
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
`, 'utf8');
console.log('Created Stripe webhook');

// ============================================
// 8. BILLING PAGE - Full with Stripe integration
// ============================================
writeFileSync('app/dashboard/billing/page.tsx', `"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

const PLANS = [
  {
    name: "Creator Starter",
    price_monthly: 29,
    price_yearly: 23,
    tokens: 250,
    description: "Perfect for individual creators",
    features: ["250 tokens/month", "All AI models", "Video Studio", "Ad Spy", "Email support"],
    popular: false,
    stripe_price_monthly: "",
    stripe_price_yearly: "",
  },
  {
    name: "Creator Pro",
    price_monthly: 59,
    price_yearly: 45,
    tokens: 500,
    description: "For serious content creators",
    features: ["500 tokens/month", "All AI models", "Priority generation", "Autopilot posting", "Priority support"],
    popular: true,
    stripe_price_monthly: "",
    stripe_price_yearly: "",
  },
  {
    name: "Ecom Starter",
    price_monthly: 49,
    price_yearly: 39,
    tokens: 300,
    description: "For small e-commerce brands",
    features: ["300 tokens/month", "All AI models", "Ad Spy tool", "1-click ad launcher", "Email support"],
    popular: false,
    stripe_price_monthly: "",
    stripe_price_yearly: "",
  },
  {
    name: "Ecom Pro",
    price_monthly: 149,
    price_yearly: 119,
    tokens: 800,
    description: "For growing e-commerce brands",
    features: ["800 tokens/month", "All AI models", "Unlimited Ad Spy", "5 platform autopilot", "Priority support"],
    popular: true,
    stripe_price_monthly: "",
    stripe_price_yearly: "",
  },
  {
    name: "Ecom Agency",
    price_monthly: 499,
    price_yearly: 399,
    tokens: 3000,
    description: "For agencies managing multiple brands",
    features: ["3000 tokens/month", "All AI models", "White-label option", "Dedicated account manager", "24/7 support"],
    popular: false,
    stripe_price_monthly: "",
    stripe_price_yearly: "",
  },
];

const TOKEN_PACKS = [
  { tokens: 50, price: 5 },
  { tokens: 100, price: 9 },
  { tokens: 250, price: 19, popular: true },
  { tokens: 600, price: 39 },
  { tokens: 1200, price: 69 },
];

export default function Billing() {
  const [tokenBalance, setTokenBalance] = useState(0);
  const [billing, setBilling] = useState("monthly");
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("plans");
  const searchParams = useSearchParams();

  useEffect(() => {
    fetchTokenBalance();
    const success = searchParams.get("success");
    const cancelled = searchParams.get("cancelled");
    if (success) setMessage("Payment successful! Your account has been updated.");
    if (cancelled) setMessage("Payment cancelled. No charges were made.");
    setTimeout(() => setMessage(""), 5000);
  }, []);

  const fetchTokenBalance = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/tokens", { headers: { Authorization: "Bearer " + session.access_token } });
    const data = await res.json();
    if (data.balance !== undefined) setTokenBalance(data.balance);
  };

  const handleSubscribe = async (plan: any) => {
    const priceId = billing === "monthly" ? plan.stripe_price_monthly : plan.stripe_price_yearly;
    if (!priceId) {
      setMessage("Stripe not configured yet. Please contact support.");
      setTimeout(() => setMessage(""), 4000);
      return;
    }
    setCheckoutLoading(plan.name);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
      body: JSON.stringify({ type: "subscription", priceId }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setMessage(data.error || "Something went wrong");
      setTimeout(() => setMessage(""), 4000);
    }
    setCheckoutLoading("");
  };

  const handleTopUp = async (pack: any) => {
    setCheckoutLoading("pack-" + pack.tokens);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
      body: JSON.stringify({ type: "token_topup", tokens: pack.tokens, amount: pack.price }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setMessage(data.error || "Something went wrong. Stripe may not be configured yet.");
      setTimeout(() => setMessage(""), 4000);
    }
    setCheckoutLoading("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold mb-1">Billing & Credits</h1>
        <p className="text-gray-400 text-sm">Manage your plan and top up your tokens</p>
      </div>

      {message && (
        <div className={"border rounded-xl px-4 py-3 " + (message.includes("success") ? "bg-green-900/20 border-green-500/30" : message.includes("cancel") ? "bg-yellow-900/20 border-yellow-500/30" : "bg-red-900/20 border-red-500/30")}>
          <p className={(message.includes("success") ? "text-green-400" : message.includes("cancel") ? "text-yellow-400" : "text-red-400") + " text-sm"}>{message}</p>
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-gray-400 text-xs mb-1">Current Plan</div>
            <div className="text-xl font-bold">Free Trial</div>
          </div>
          <div className="bg-purple-900/40 border border-purple-500/30 text-purple-300 text-xs font-bold px-3 py-1 rounded-full">Trial</div>
        </div>
        <div className="flex items-center justify-between bg-black/20 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400">Token Balance</span>
            <span className="text-white font-bold text-xl">{tokenBalance}</span>
            <span className="text-gray-400 text-sm">tokens</span>
          </div>
          <button onClick={() => setTab("topup")} className="text-purple-400 hover:text-white text-xs font-semibold transition">
            Top Up
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {["plans", "topup"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={"px-6 py-2 rounded-xl text-sm font-bold transition capitalize " + (tab === t ? "bg-purple-600 text-white" : "bg-white/10 text-gray-400 hover:bg-white/20")}>
            {t === "topup" ? "Top Up Tokens" : "Upgrade Plan"}
          </button>
        ))}
      </div>

      {tab === "plans" && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3">
            <span className={"text-sm font-semibold " + (billing === "monthly" ? "text-white" : "text-gray-500")}>Monthly</span>
            <button onClick={() => setBilling(billing === "monthly" ? "yearly" : "monthly")} className={"relative w-12 h-6 rounded-full transition-colors " + (billing === "yearly" ? "bg-purple-600" : "bg-white/20")}>
              <div className={"absolute top-1 w-4 h-4 bg-white rounded-full transition-all " + (billing === "yearly" ? "left-7" : "left-1")} />
            </button>
            <span className={"text-sm font-semibold " + (billing === "yearly" ? "text-white" : "text-gray-500")}>Yearly <span className="text-green-400 text-xs">Save 20%</span></span>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {PLANS.map((plan, i) => (
              <div key={i} className={"border rounded-2xl p-6 relative " + (plan.popular ? "border-purple-500 bg-purple-900/10" : "border-white/10 bg-white/5")}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-3 py-0.5 rounded-full">Popular</div>
                )}
                <h3 className="font-bold mb-1">{plan.name}</h3>
                <p className="text-gray-500 text-xs mb-4">{plan.description}</p>
                <div className="mb-4">
                  <span className="text-3xl font-extrabold">\${billing === "monthly" ? plan.price_monthly : plan.price_yearly}</span>
                  <span className="text-gray-500 text-sm">/mo</span>
                </div>
                <div className="bg-purple-900/20 border border-purple-500/20 rounded-xl px-3 py-2 mb-4 text-center">
                  <span className="text-purple-400 font-bold">{plan.tokens} tokens</span>
                  <span className="text-gray-500 text-xs"> / month</span>
                </div>
                <div className="space-y-2 mb-6">
                  {plan.features.map((feature, j) => (
                    <div key={j} className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="text-green-400">✓</span> {feature}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => handleSubscribe(plan)}
                  disabled={checkoutLoading === plan.name}
                  className={"w-full font-bold py-3 rounded-xl transition text-sm " + (plan.popular ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-white/10 hover:bg-white/20 text-white") + (checkoutLoading === plan.name ? " opacity-50" : "")}
                >
                  {checkoutLoading === plan.name ? "Loading..." : "Get Started"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "topup" && (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">Tokens never expire. Use them anytime for any AI generation.</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {TOKEN_PACKS.map((pack, i) => (
              <div key={i} className={"relative border rounded-2xl p-5 text-center " + (pack.popular ? "border-purple-500 bg-purple-900/20" : "border-white/10 bg-white/5")}>
                {pack.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-3 py-0.5 rounded-full">Best Value</div>
                )}
                <div className="text-2xl font-extrabold mb-1">\${pack.price}</div>
                <div className="text-purple-400 font-bold text-sm mb-1">{pack.tokens} tokens</div>
                <div className="text-gray-500 text-xs mb-4">\${(pack.price / pack.tokens * 10).toFixed(1)} per 10 tokens</div>
                <button
                  onClick={() => handleTopUp(pack)}
                  disabled={checkoutLoading === "pack-" + pack.tokens}
                  className={"w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold py-2 rounded-full transition"}
                >
                  {checkoutLoading === "pack-" + pack.tokens ? "Loading..." : "Buy Now"}
                </button>
              </div>
            ))}
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <h3 className="font-bold text-sm mb-2">Invoice History</h3>
            <p className="text-gray-500 text-sm">No invoices yet. Your billing history will appear here after your first purchase.</p>
          </div>
        </div>
      )}
    </div>
  );
}
`, 'utf8');
console.log('Created billing page');

// ============================================
// 9. FIX GENERATIONS API to use service role
// ============================================
writeFileSync('app/api/generations/route.ts', `import { NextRequest, NextResponse } from "next/server";
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

    const { data, error } = await supabase
      .from("generations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ generations: data || [] });
  } catch (error) {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { type, prompt, video_url, status, tokens_used, duration, aspect_ratio, model } = await req.json();

    const { data, error } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        type: type || "text_to_video",
        prompt,
        video_url,
        status: status || "completed",
        tokens_used: tokens_used || 10,
        duration,
        aspect_ratio,
        model: model || "kling-v1",
      })
      .select()
      .single();

    if (error) {
      console.error("Generation insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ generation: data });
  } catch (error) {
    console.error("Generations POST error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
`, 'utf8');
console.log('Fixed generations API');

console.log('\\nAll features built successfully!');