import { Sparkles } from "lucide-react";

/** KlipflowAI mark: the violet tile with the spark (same as the marketing header). */
export function BrandIcon({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`grid place-items-center rounded-[28%] bg-accent text-white ${className}`} style={{ width: size, height: size }}>
      <Sparkles size={Math.round(size * 0.5)} aria-hidden />
    </span>
  );
}

export function BrandWordmark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <BrandIcon size={size} />
      <span className="font-semibold tracking-tight text-ink" style={{ fontSize: size * 0.56 }}>KlipflowAI</span>
    </span>
  );
}
