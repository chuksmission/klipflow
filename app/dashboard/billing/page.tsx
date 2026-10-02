"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Coins, CreditCard, Lock } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Alert, Badge, Button, EmptyState, PageHeader, Skeleton, Spinner, Toggle, cardClass } from "../../components/ui";

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

  const alertTone = messageType === "success" ? "success" : messageType === "warning" ? "warning" : "danger";

  const openTopUp = () => {
    if (!isSubscriber) {
      showMessage("Token top-up is available for subscribers only. Please subscribe to a plan first.", "warning");
      setTab("plans");
      return;
    }
    setTab("topup");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Billing and credits" description="Manage your plan and top up your tokens." />

      {message && <Alert tone={alertTone}>{message}</Alert>}

      {/* Current plan and token balance */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`${cardClass} p-5`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] text-ink-muted">Current plan</p>
              <p className="mt-1 text-xl font-semibold capitalize tracking-tight">{currentPlan}</p>
            </div>
            <Badge tone={currentPlan === "Free Trial" ? "neutral" : "accent"}>{currentPlan === "Free Trial" ? "Trial" : "Active"}</Badge>
          </div>
        </div>
        <div className={`${cardClass} flex items-center justify-between gap-3 p-5`}>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent-text"><Coins size={19} aria-hidden /></span>
            <div>
              <p className="text-[13px] text-ink-muted">Token balance</p>
              <p className="text-xl font-semibold tabular-nums tracking-tight">{tokenBalance}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={openTopUp}>Top up</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex rounded-xl border border-line bg-surface p-1" role="tablist">
        <button role="tab" aria-selected={tab === "plans"} onClick={() => setTab("plans")}
          className={"h-9 rounded-lg px-4 text-sm font-medium transition-colors " + (tab === "plans" ? "bg-raised text-ink" : "text-ink-muted hover:text-ink")}>
          Plans
        </button>
        <button role="tab" aria-selected={tab === "topup"} onClick={openTopUp}
          className={"inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-medium transition-colors " + (tab === "topup" ? "bg-raised text-ink" : "text-ink-muted hover:text-ink")}>
          Top up tokens {!isSubscriber && <Lock size={13} aria-label="Subscribers only" />}
        </button>
      </div>

      {/* Plans tab */}
      {tab === "plans" && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Toggle checked={billing === "yearly"} onChange={() => setBilling(billing === "monthly" ? "yearly" : "monthly")} label="Bill yearly" />
            <span className="text-sm text-ink">Bill yearly</span>
            <Badge tone="success">Save 20%</Badge>
          </div>

          {plansLoading ? (
            <div className="grid gap-4 md:grid-cols-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}
            </div>
          ) : plans.length === 0 ? (
            <EmptyState icon={CreditCard} title="No plans available yet" description="Check back soon." />
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {plans.map((plan) => (
                <div key={plan.id} className={"relative flex flex-col rounded-2xl border p-6 " + (plan.is_popular ? "border-accent bg-accent/[0.07]" : "border-line bg-surface")}>
                  {plan.is_popular && (
                    <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-0.5 text-xs font-medium text-white">Popular</span>
                  )}
                  <h3 className="font-semibold">{plan.name}</h3>
                  {plan.description && <p className="mt-1 text-xs text-ink-muted">{plan.description}</p>}
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tracking-tight">${billing === "monthly" ? plan.price_monthly : plan.price_yearly}</span>
                    <span className="text-sm text-ink-muted">/mo</span>
                  </div>
                  {billing === "yearly" && <p className="mt-1 text-xs text-ink-subtle">Billed annually</p>}
                  <p className="mt-3 text-sm font-medium text-accent-text">{plan.tokens_per_month} tokens / month</p>
                  {Array.isArray(plan.features) && plan.features.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {plan.features.map((feature: string, j: number) => (
                        <li key={j} className="flex items-start gap-2 text-xs text-ink-muted">
                          <Check size={14} className="mt-0.5 flex-shrink-0 text-accent-text" aria-hidden /> {feature}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex-1" />
                  <Button
                    onClick={() => handleSubscribe(plan)}
                    disabled={checkoutLoading === plan.id}
                    variant={plan.is_popular ? "primary" : "secondary"}
                    className="mt-6 w-full"
                  >
                    {checkoutLoading === plan.id ? <><Spinner size={16} /> Processing…</> : "Get started"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Top up tab */}
      {tab === "topup" && (
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">Tokens never expire. Use them any time for any AI generation.</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
            {TOKEN_PACKS.map((pack, i) => (
              <div key={i} className={"relative flex flex-col rounded-2xl border p-5 text-center " + ((pack as any).popular ? "border-accent bg-accent/[0.07]" : "border-line bg-surface")}>
                {(pack as any).popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-3 py-0.5 text-xs font-medium text-white">Best value</span>
                )}
                <p className="text-2xl font-semibold tracking-tight">${pack.price}</p>
                <p className="mt-1 text-sm font-medium text-accent-text">{pack.tokens} tokens</p>
                <p className="mt-1 text-xs text-ink-subtle">${(pack.price / pack.tokens * 10).toFixed(1)} per 10 tokens</p>
                <Button
                  onClick={() => handleTopUp(pack)}
                  disabled={checkoutLoading === "pack-" + pack.tokens}
                  variant={(pack as any).popular ? "primary" : "secondary"}
                  size="sm"
                  className="mt-4 w-full"
                >
                  {checkoutLoading === "pack-" + pack.tokens ? <Spinner size={14} /> : "Buy now"}
                </Button>
              </div>
            ))}
          </div>
          <div className={`${cardClass} p-5`}>
            <h3 className="text-sm font-semibold">Invoice history</h3>
            <p className="mt-1 text-sm text-ink-muted">No invoices yet. Your billing history will appear here after your first purchase.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Billing() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-28" /></div>}>
      <BillingContent />
    </Suspense>
  );
}
