// Cost line for duration-billed tools: "Cost: 73 tokens · 1m 27s · you have X",
// with the per-second breakdown underneath.
import { MIN_BILLED_SECONDS, formatDuration } from "../lib/duration-pricing";

interface Props {
  cost: number;
  ratePerMinute: number;
  seconds: number | null;   // null until a video is chosen
  balance: number;
  /** Optional label for the rate, e.g. "new face + voice" */
  rateLabel?: string;
}

export default function CostSummary({ cost, ratePerMinute, seconds, balance, rateLabel }: Props) {
  const billed = seconds === null ? null : Math.max(MIN_BILLED_SECONDS, seconds);
  return (
    <div className="space-y-0.5">
      <p className="text-sm text-ink-muted">
        Cost: <span className="font-semibold text-ink">{seconds === null ? `from ${cost} tokens` : `${cost} tokens`}</span>
        {seconds !== null && <> · {formatDuration(seconds)}</>}
        {" "}· you have {balance}
      </p>
      <p className="text-xs text-ink-subtle">
        {ratePerMinute} tokens/min{rateLabel ? ` (${rateLabel})` : ""}, billed per second with a {MIN_BILLED_SECONDS}s minimum
        {billed !== null && <>: {formatDuration(billed)} × {ratePerMinute}/min = {((billed * ratePerMinute) / 60).toFixed(1)} → {cost} tokens</>}
        {seconds !== null && seconds < MIN_BILLED_SECONDS && <> (billed as {MIN_BILLED_SECONDS}s)</>}
      </p>
    </div>
  );
}
