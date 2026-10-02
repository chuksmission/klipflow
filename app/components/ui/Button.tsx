import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap rounded-xl transition-colors " +
  "disabled:cursor-not-allowed disabled:bg-raised disabled:text-ink-subtle disabled:border-line";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  secondary: "bg-raised text-ink border border-line hover:border-line-strong hover:bg-raised-hover",
  ghost: "text-ink-muted hover:text-ink hover:bg-white/5",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`.trim();
}

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

export function Button({ variant, size, className, ...props }: CommonProps & ComponentProps<"button">) {
  return <button type="button" {...props} className={buttonClass(variant, size, className)} />;
}

export function ButtonLink({ variant, size, className, ...props }: CommonProps & ComponentProps<typeof Link>) {
  return <Link {...props} className={buttonClass(variant, size, className)} />;
}
