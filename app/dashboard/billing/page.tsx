"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Coins, CreditCard, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("billing");
  const c = useTranslations("common");
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
    if (success) { setMessage(t("paymentSuccess")); setMessageType("success"); }
    if (cancelled) { setMessage(t("paymentCancelled")); setMessageType("warning"); }
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
      showMessage(t("stripeNotConnected"), "warning");
      return;
    }

    setCheckoutLoading(plan.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { showMessage(t("loginToSubscribe")); return; }

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
        showMessage(data.error || t("genericError"));
      }
    } catch (err) {
      showMessage(t("genericError"));
    } finally {
      setCheckoutLoading("");
    }
  };

  const handleTopUp = async (pack: typeof TOKEN_PACKS[0]) => {
    setCheckoutLoading("pack-" + pack.tokens);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { showMessage(t("loginToTopUp")); return; }

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
        showMessage(data.error || t("stripeNotConfigured"), "warning");
      }
    } catch (err) {
      showMessage(t("genericError"));
    } finally {
      setCheckoutLoading("");
    }
  };

  const alertTone = messageType === "success" ? "success" : messageType === "warning" ? "warning" : "danger";

  const openTopUp = () => {
    if (!isSubscriber) {
      showMessage(t("subscribersOnly"), "warning");
      setTab("plans");
      return;
    }
    setTab("topup");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      {message && <Alert tone={alertTone}>{message}</Alert>}

      {/* Current plan and token balance */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`${cardClass} p-5`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] text-ink-muted">{t("currentPlan")}</p>
              <p className="mt-1 text-xl font-semibold capitalize tracking-tight">{currentPlan === "Free Trial" ? t("freeTrial") : currentPlan === "Admin" ? t("admin") : currentPlan}</p>
            </div>
            <Badge tone={currentPlan === "Free Trial" ? "neutral" : "accent"}>{currentPlan === "Free Trial" ? t("trial") : t("active")}</Badge>
          </div>
        </div>
        <div className={`${cardClass} flex items-center justify-between gap-3 p-5`}>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent-text"><Coins size={19} aria-hidden /></span>
            <div>
              <p className="text-[13px] text-ink-muted">{t("tokenBalance")}</p>
              <p className="text-xl font-semibold tabular-nums tracking-tight">{tokenBalance}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={openTopUp}>{t("topUp")}</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex rounded-xl border border-line bg-surface p-1" role="tablist">
        <button role="tab" aria-selected={tab === "plans"} onClick={() => setTab("plans")}
          className={"h-9 rounded-lg px-4 text-sm font-medium transition-colors " + (tab === "plans" ? "bg-raised text-ink" : "text-ink-muted hover:text-ink")}>
          {t("plans")}
        </button>
        <button role="tab" aria-selected={tab === "topup"} onClick={openTopUp}
          className={"inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-medium transition-colors " + (tab === "topup" ? "bg-raised text-ink" : "text-ink-muted hover:text-ink")}>
          {t("topUpTokens")} {!isSubscriber && <Lock size={13} aria-label={t("subscribersOnlyShort")} />}
        </button>
      </div>

      {/* Plans tab */}
      {tab === "plans" && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Toggle checked={billing === "yearly"} onChange={() => setBilling(billing === "monthly" ? "yearly" : "monthly")} label={t("billYearly")} />
            <span className="text-sm text-ink">{t("billYearly")}</span>
            <Badge tone="success">{t("save20")}</Badge>
          </div>

          {plansLoading ? (
            <div className="grid gap-4 md:grid-cols-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}
            </div>
          ) : plans.length === 0 ? (
            <EmptyState icon={CreditCard} title={t("noPlans")} description={t("checkBack")} />
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {plans.map((plan) => (
                <div key={plan.id} className={"relative flex flex-col rounded-2xl border p-6 " + (plan.is_popular ? "border-accent bg-accent/[0.07]" : "border-line bg-surface")}>
                  {plan.is_popular && (
                    <span className="absolute -top-3 start-6 rounded-full bg-accent px-3 py-0.5 text-xs font-medium text-white">{t("popular")}</span>
                  )}
                  <h3 className="font-semibold">{plan.name}</h3>
                  {plan.description && <p className="mt-1 text-xs text-ink-muted">{plan.description}</p>}
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tracking-tight">${billing === "monthly" ? plan.price_monthly : plan.price_yearly}</span>
                    <span className="text-sm text-ink-muted">{t("perMonth")}</span>
                  </div>
                  {billing === "yearly" && <p className="mt-1 text-xs text-ink-subtle">{t("billedAnnually")}</p>}
                  <p className="mt-3 text-sm font-medium text-accent-text">{t("tokensPerMonth", { count: plan.tokens_per_month })}</p>
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
                    {checkoutLoading === plan.id ? <><Spinner size={16} /> {t("processing")}</> : t("getStarted")}
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
          <p className="text-sm text-ink-muted">{t("neverExpire")}</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
            {TOKEN_PACKS.map((pack, i) => (
              <div key={i} className={"relative flex flex-col rounded-2xl border p-5 text-center " + ((pack as any).popular ? "border-accent bg-accent/[0.07]" : "border-line bg-surface")}>
                {(pack as any).popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-3 py-0.5 text-xs font-medium text-white">{t("bestValue")}</span>
                )}
                <p className="text-2xl font-semibold tracking-tight">${pack.price}</p>
                <p className="mt-1 text-sm font-medium text-accent-text">{c("tokens", { count: pack.tokens })}</p>
                <p className="mt-1 text-xs text-ink-subtle">{t("per10", { price: (pack.price / pack.tokens * 10).toFixed(1) })}</p>
                <Button
                  onClick={() => handleTopUp(pack)}
                  disabled={checkoutLoading === "pack-" + pack.tokens}
                  variant={(pack as any).popular ? "primary" : "secondary"}
                  size="sm"
                  className="mt-4 w-full"
                >
                  {checkoutLoading === "pack-" + pack.tokens ? <Spinner size={14} /> : t("buyNow")}
                </Button>
              </div>
            ))}
          </div>
          <div className={`${cardClass} p-5`}>
            <h3 className="text-sm font-semibold">{t("invoiceHistory")}</h3>
            <p className="mt-1 text-sm text-ink-muted">{t("noInvoices")}</p>
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
