// Per-second pricing for duration-billed tools (Video Remix Restyle and Actor
// Swap, AI Actor Swap): a per-minute rate prorated per second, 15s minimum.

export const MIN_BILLED_SECONDS = 15;

/** Tokens for `seconds` of video at `ratePerMinute` (exact seconds, rounded up to whole tokens). */
export function perSecondCost(ratePerMinute: number, seconds: number): number {
  if (ratePerMinute <= 0) return 0;
  const billed = Math.max(MIN_BILLED_SECONDS, seconds);
  // Multiply before dividing so whole-token results don't round up on float noise
  return Math.ceil((billed * ratePerMinute) / 60 - 1e-9);
}

/** "1m 27s", "45s", "2m 0s" */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}
