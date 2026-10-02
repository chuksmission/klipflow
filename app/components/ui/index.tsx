import type { ComponentProps, ReactNode } from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import { cardClass, cardPadded, inputClass, labelClass, selectClass, textareaClass } from "./styles";

export { Button, ButtonLink, buttonClass } from "./Button";
export * from "./styles";

/* ---------- Layout ---------- */

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ padded = true, className = "", ...props }: { padded?: boolean } & ComponentProps<"div">) {
  return <div {...props} className={`${padded ? cardPadded : cardClass} ${className}`} />;
}

export function SectionTitle({ children, description, action }: { children: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-ink">{children}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------- Data display ---------- */

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "signal";
const toneClass: Record<Tone, string> = {
  neutral: "bg-white/[0.06] text-ink-muted border-line",
  accent: "bg-accent/12 text-accent-text border-accent/30",
  success: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
  warning: "bg-amber-500/10 text-amber-300 border-amber-500/25",
  danger: "bg-red-500/10 text-red-300 border-red-500/25",
  signal: "bg-signal/10 text-signal border-signal/25",
};

export function Badge({ tone = "neutral", className = "", children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function StatCard({ label, value, hint, icon: Icon }: { label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className={`${cardClass} p-5`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] text-ink-muted">{label}</p>
        {Icon && <Icon size={16} className="text-ink-subtle" aria-hidden />}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon?: LucideIcon; title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className={`${cardClass} flex flex-col items-center px-6 py-14 text-center`}>
      {Icon && (
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.05] text-ink-muted">
          <Icon size={22} aria-hidden />
        </span>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "danger", children }: { tone?: "danger" | "success" | "warning" | "info"; children: ReactNode }) {
  const cls = {
    danger: "border-red-500/25 bg-red-500/10 text-red-300",
    success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    warning: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    info: "border-accent/30 bg-accent/10 text-accent-text",
  }[tone];
  return <div role={tone === "danger" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

/* ---------- Feedback ---------- */

export function Spinner({ size = 18, className = "" }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} aria-hidden />;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/[0.05] ${className}`} />;
}

export function Progress({ value, className = "" }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-white/[0.07] ${className}`} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${v}%` }} />
    </div>
  );
}

/* ---------- Forms ---------- */

export function Field({ label, hint, children }: { label?: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      {label && <label className={labelClass}>{label}</label>}
      {children}
      {hint && <p className="mt-1.5 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${className}`} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${textareaClass} ${className}`} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select {...props} className={`${selectClass} ${className}`} />;
}

export function Toggle({ checked, onChange, label, size = "md" }: { checked: boolean; onChange: () => void; label?: string; size?: "sm" | "md" }) {
  const track = size === "sm" ? "h-5 w-9" : "h-6 w-11";
  const knob = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const shift = size === "sm" ? "translate-x-4" : "translate-x-5";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex flex-shrink-0 items-center rounded-full p-0.5 transition-colors ${track} ${checked ? "bg-accent" : "bg-white/15 hover:bg-white/20"}`}
    >
      <span className={`${knob} rounded-full bg-white shadow transition-transform ${checked ? shift : "translate-x-0"}`} />
    </button>
  );
}
