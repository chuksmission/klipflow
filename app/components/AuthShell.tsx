"use client";
import Link from "next/link";
import { useState, type ComponentProps, type ReactNode } from "react";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";
import { inputClass } from "./ui/styles";

// Shared frame for login, signup, password reset and verification pages.
export default function AuthShell({ title, subtitle, children, footer }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const c = useTranslations("common");
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-4 py-12 text-ink">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[900px] max-w-[160%] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(109,74,255,0.45), rgba(34,211,238,0.08) 65%, transparent)" }} />
      <LanguageSwitcher className="absolute end-4 top-4" />
      <div className="relative w-full max-w-[400px]">
        <Link href="/" className="mx-auto mb-8 flex w-fit items-center gap-2.5" aria-label={c("home")}>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-white"><Sparkles size={18} aria-hidden /></span>
          <span className="text-lg font-semibold tracking-tight">KlipflowAI</span>
        </Link>
        <div className="rounded-2xl border border-line bg-surface/95 p-6 shadow-2xl shadow-black/40 backdrop-blur-sm sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-ink-muted">{footer}</div>}
      </div>
    </main>
  );
}

export function AuthDivider() {
  const t = useTranslations("auth");
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-ink-subtle">
      <span className="h-px flex-1 bg-line" />{t("or")}<span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function GoogleButton({ onClick, label }: { onClick: () => void; label?: string }) {
  const t = useTranslations("auth");
  return (
    <button type="button" onClick={onClick}
      className="flex h-11 w-full items-center justify-center gap-3 rounded-xl bg-white text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      {label ?? t("google")}
    </button>
  );
}

export function PasswordInput(props: Omit<ComponentProps<"input">, "type">) {
  const t = useTranslations("auth");
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? "text" : "password"} className={`${inputClass} h-11 pe-11`} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? t("hidePassword") : t("showPassword")}
        className="absolute end-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-subtle transition-colors hover:bg-white/5 hover:text-ink">
        {show ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
      </button>
    </div>
  );
}
