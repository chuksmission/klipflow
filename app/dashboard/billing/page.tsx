"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

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

import { Suspense } from "react";

function BillingContent() {
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
                  <span className="text-3xl font-extrabold">${billing === "monthly" ? plan.price_monthly : plan.price_yearly}</span>
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
                <div className="text-2xl font-extrabold mb-1">${pack.price}</div>
                <div className="text-purple-400 font-bold text-sm mb-1">{pack.tokens} tokens</div>
                <div className="text-gray-500 text-xs mb-4">${(pack.price / pack.tokens * 10).toFixed(1)} per 10 tokens</div>
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

export default function Billing() {
  return (
    <Suspense fallback={<div className="text-gray-400 p-6">Loading billing...</div>}>
      <BillingContent />
    </Suspense>
  );
}