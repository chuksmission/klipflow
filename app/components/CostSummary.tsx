// Cost line for duration-billed tools: "Cost: 73 tokens · 1m 27s · you have X",
// with the per-second breakdown underneath.
import { useTranslations } from "next-intl";
import { MIN_BILLED_SECONDS } from "../lib/duration-pricing";

interface Props {
  cost: number;
  ratePerMinute: number;
  seconds: number | null;   // null until a video is chosen
  balance: number;
  /** Optional label for the rate, e.g. "new face + voice" */
  rateLabel?: string;
}

export default function CostSummary({ cost, ratePerMinute, seconds, balance, rateLabel }: Props) {
  const t = useTranslations("cost");
  const billed = seconds === null ? null : Math.max(MIN_BILLED_SECONDS, seconds);
  const duration = (s: number) => { const total = Math.max(0, Math.round(s)); const m = Math.floor(total / 60); return m ? t("minSec", { m, s: total % 60 }) : t("sec", { s: total }); };
  return (
    <div className="space-y-0.5">
      <p className="text-sm text-ink-muted">
        {t.rich(seconds === null ? "lineFrom" : "line", { cost, strong: (chunks) => <span className="font-semibold text-ink">{chunks}</span> })}
        {seconds !== null && <> · {duration(seconds)}</>}
        {" "}· {t("youHave", { balance })}
      </p>
      <p className="text-xs text-ink-subtle">
        {rateLabel ? t("rateLabelled", { rate: ratePerMinute, label: rateLabel, min: MIN_BILLED_SECONDS }) : t("rate", { rate: ratePerMinute, min: MIN_BILLED_SECONDS })}
        {billed !== null && <>: {t("math", { duration: duration(billed), rate: ratePerMinute, exact: ((billed * ratePerMinute) / 60).toFixed(1), cost })}</>}
        {seconds !== null && seconds < MIN_BILLED_SECONDS && <> {t("billedAs", { min: MIN_BILLED_SECONDS })}</>}
      </p>
    </div>
  );
}
