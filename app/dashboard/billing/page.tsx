"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

const TOKEN_PACKS = [
  { tokens: 50, price: 5 },
  { tokens: 100, price: 9 },
  { tokens: 250, price: 20, popular: true },
  { tokens: 600, price: 38 },
  { tokens: 1200, price: 72 },
];

function BillingContent() {
  const [plans, setPlans] = useState<any[]>([]);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [currentPlan, setCurrentPlan] = useState<string>("Free Trial");
  const [billing, setBilling] = useState("monthly");
  const [checkoutLoading, setCheckoutLoading] = useState<string | number>("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "warning">("error");
  const [tab, setTab] = useState("plans");
  const [plansLoading, setPlansLoading] = useState(true);
  const searchParams = useSearchParams();

  useEffect(() => {
    fetchTokenBalance();
    fetchPlans();
    fetchCurrentPlan();
    const success = searchParams.get("success");
    const cancelled = searchParams.get("cancelled");
    if (success) { setMessage("Payment successful! Your account has been updated."); setMessageType("success"); }
    if (cancelled) { setMessage("Payment cancelled. No charges were made."); setMessageType("warning"); }
    if (success || cancelled) setTimeout(() => setMessage(""), 5000);
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/plans");
      const data = await res.json();
      setPlans(data.plans || []);
    } catch (err) {
      console.error("Failed to fetch plans:", err);
    } finally {
      setPlansLoading(false);
    }
  };

  const fetchTokenBalance = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/tokens", {
      headers: { Authorization: "Bearer " + session.access_token }
    });
    const data = await res.json();
    if (data.balance !== undefined) setTokenBalance(data.balance);
  };

  const [isSubscriber, setIsSubscriber] = useState(false);

  const fetchCurrentPlan = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from("user_profiles")
      .select("is_admin, subscription_status, plan")
      .eq("id", session.user.id)
      .single();
    if (data?.is_admin) setCurrentPlan("Admin");
    if (data?.plan && data.plan !== "free") {
      setCurrentPlan(data.plan);
      setIsSubscriber(true);
    }
    if (data?.subscription_status === "active") setIsSubscriber(true);
  };

  const showMessage = (msg: string, type: "success" | "error" | "warning" = "error") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(""), 5000);
  };

  const handleSubscribe = async (plan: any) => {
    const priceId = billing === "monthly"
      ? plan.stripe_price_id_monthly
      : plan.stripe_price_id_yearly;

    if (!priceId) {
      showMessage("Stripe not connected yet. Please check back soon or contact support.", "warning");
      return;
    }

    setCheckoutLoading(plan.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { showMessage("Please log in to subscribe."); return; }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token
        },
        body: JSON.stringify({ type: "subscription", priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        showMessage(data.error || "Something went wrong. Please try again.");
      }
    } catch (err) {
      showMessage("Something went wrong. Please try again.");
    } finally {
      setCheckoutLoading("");
    }
  };

  const handleTopUp = async (pack: typeof TOKEN_PACKS[0]) => {
    setCheckoutLoading("pack-" + pack.tokens);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { showMessage("Please log in to top up."); return; }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token
        },
        body: JSON.stringify({ type: "token_topup", tokens: pack.tokens, amount: pack.price }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        showMessage(data.error || "Stripe is not configured yet. Please check back soon.", "warning");
      }
    } catch (err) {
      showMessage("Something went wrong. Please try again.");
    } finally {
      setCheckoutLoading("");
    }
  };

  const messageBg = messageType === "success"
    ? "bg-green-900/20 border-green-500/30 text-green-400"
    : messageType === "warning"
    ? "bg-yellow-900/20 border-yellow-500/30 text-yellow-400"
    : "bg-red-900/20 border-red-500/30 text-red-400";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold mb-1">Billing & Credits</h1>
        <p className="text-gray-400 text-sm">Manage your plan and top up your tokens</p>
      </div>

      {message && (
        <div className={"border rounded-xl px-4 py-3 " + messageBg}>
          <p className="text-sm">{message}</p>
        </div>
      )}

      {/* Current Plan & Token Balance */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-gray-400 text-xs mb-1">Current Plan</div>
            <div className="text-xl font-bold capitalize">{currentPlan}</div>
          </div>
          <div className="bg-purple-900/40 border border-purple-500/30 text-purple-300 text-xs font-bold px-3 py-1 rounded-full capitalize">
            {currentPlan === "Free Trial" ? "Trial" : "Active"}
          </div>
        </div>
        <div className="flex items-center justify-between bg-black/20 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400">Token Balance</span>
            <span className="text-white font-bold text-xl">{tokenBalance}</span>
            <span className="text-gray-400 text-sm">tokens</span>
          </div>
          <button
            onClick={() => {
              if (!isSubscriber) {
                showMessage("Token top-up is available for subscribers only. Please subscribe to a plan first.", "warning");
                return;
              }
              setTab("topup");
            }}
            className="text-purple-400 hover:text-white text-xs font-semibold transition"
          >
            Top Up →
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("plans")}
          className={"px-6 py-2 rounded-xl text-sm font-bold transition " + (tab === "plans" ? "bg-purple-600 text-white" : "bg-white/10 text-gray-400 hover:bg-white/20")}
        >
          Upgrade Plan
        </button>
        <button
          onClick={() => {
            if (!isSubscriber) {
              showMessage("Token top-up is available for subscribers only. Please subscribe to a plan first.", "warning");
              setTab("plans");
              return;
            }
            setTab("topup");
          }}
          className={"px-6 py-2 rounded-xl text-sm font-bold transition " + (tab === "topup" ? "bg-purple-600 text-white" : "bg-white/10 text-gray-400 hover:bg-white/20")}
        >
          Top Up Tokens {!isSubscriber && "🔒"}
        </button>
      </div>

      {/* Plans Tab */}
      {tab === "plans" && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3">
            <span className={"text-sm font-semibold " + (billing === "monthly" ? "text-white" : "text-gray-500")}>Monthly</span>
            <button
              onClick={() => setBilling(billing === "monthly" ? "yearly" : "monthly")}
              className={"relative w-12 h-6 rounded-full transition-colors " + (billing === "yearly" ? "bg-purple-600" : "bg-white/20")}
            >
              <div className={"absolute top-1 w-4 h-4 bg-white rounded-full transition-all " + (billing === "yearly" ? "left-7" : "left-1")} />
            </button>
            <span className={"text-sm font-semibold " + (billing === "yearly" ? "text-white" : "text-gray-500")}>
              Yearly <span className="text-green-400 text-xs">Save 20%</span>
            </span>
          </div>

          {plansLoading ? (
            <div className="text-center py-12 text-gray-400">Loading plans...</div>
          ) : plans.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No plans available yet.</div>
          ) : (
            <div className="grid md:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={"border rounded-2xl p-6 relative " + (plan.is_popular ? "border-purple-500 bg-purple-900/10" : "border-white/10 bg-white/5")}
                >
                  {plan.is_popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-3 py-0.5 rounded-full">
                      Popular
                    </div>
                  )}
                  <h3 className="font-bold mb-1">{plan.name}</h3>
                  <p className="text-gray-500 text-xs mb-4">{plan.description}</p>
                  <div className="mb-4">
                    <span className="text-3xl font-extrabold">
                      ${billing === "monthly" ? plan.price_monthly : plan.price_yearly}
                    </span>
                    <span className="text-gray-500 text-sm">/mo</span>
                    {billing === "yearly" && (
                      <div className="text-green-400 text-xs mt-1">Billed annually</div>
                    )}
                  </div>
                  <div className="bg-purple-900/20 border border-purple-500/20 rounded-xl px-3 py-2 mb-4 text-center">
                    <span className="text-purple-400 font-bold">{plan.tokens_per_month} tokens</span>
                    <span className="text-gray-500 text-xs"> / month</span>
                  </div>
                  {Array.isArray(plan.features) && plan.features.length > 0 && (
                    <div className="space-y-2 mb-6">
                      {plan.features.map((feature: string, j: number) => (
                        <div key={j} className="flex items-center gap-2 text-xs text-gray-400">
                          <span className="text-green-400">✓</span> {feature}
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => handleSubscribe(plan)}
                    disabled={checkoutLoading === plan.id}
                    className={"w-full font-bold py-3 rounded-xl transition text-sm disabled:opacity-50 " + (plan.is_popular ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-white/10 hover:bg-white/20 text-white")}
                  >
                    {checkoutLoading === plan.id ? "Processing..." : "Get Started"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Top Up Tab */}
      {tab === "topup" && (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">Tokens never expire. Use them anytime for any AI generation.</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {TOKEN_PACKS.map((pack, i) => (
              <div
                key={i}
                className={"relative border rounded-2xl p-5 text-center " + ((pack as any).popular ? "border-purple-500 bg-purple-900/20" : "border-white/10 bg-white/5")}
              >
                {(pack as any).popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-3 py-0.5 rounded-full">
                    Best Value
                  </div>
                )}
                <div className="text-2xl font-extrabold mb-1">${pack.price}</div>
                <div className="text-purple-400 font-bold text-sm mb-1">{pack.tokens} tokens</div>
                <div className="text-gray-500 text-xs mb-4">
                  ${(pack.price / pack.tokens * 10).toFixed(1)} per 10 tokens
                </div>
                <button
                  onClick={() => handleTopUp(pack)}
                  disabled={checkoutLoading === "pack-" + pack.tokens}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold py-2 rounded-full transition"
                >
                  {checkoutLoading === "pack-" + pack.tokens ? "Processing..." : "Buy Now"}
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