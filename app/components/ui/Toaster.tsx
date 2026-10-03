"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

/*
  Lightweight toasts + confirm dialog, replacing the browser's alert()/confirm().
  Call toast(...) or await confirmDialog(...) from anywhere; <FeedbackHost />
  is mounted once in the root layout.
*/

type ToastTone = "success" | "error" | "info" | "warning";
interface ToastItem { id: number; message: string; tone: ToastTone }
interface ConfirmRequest {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  resolve: (ok: boolean) => void;
}

let nextId = 1;
const toastListeners = new Set<(t: ToastItem) => void>();
const confirmListeners = new Set<(r: ConfirmRequest) => void>();

function guessTone(message: string): ToastTone {
  return /fail|error|couldn|can't|cannot|invalid|wrong|denied|insufficient/i.test(message) ? "error" : "success";
}

export function toast(message: string, tone?: ToastTone) {
  const item = { id: nextId++, message, tone: tone ?? guessTone(message) };
  if (toastListeners.size === 0) { console.info(message); return; }
  toastListeners.forEach((l) => l(item));
}

export function confirmDialog(opts: Omit<ConfirmRequest, "resolve"> | string): Promise<boolean> {
  const o = typeof opts === "string" ? { title: opts } : opts;
  return new Promise((resolve) => {
    if (confirmListeners.size === 0) { resolve(window.confirm(o.title)); return; }
    confirmListeners.forEach((l) => l({ ...o, resolve }));
  });
}

const toneIcon = {
  success: <CheckCircle2 size={18} className="text-emerald-400" aria-hidden />,
  error: <XCircle size={18} className="text-red-400" aria-hidden />,
  warning: <AlertTriangle size={18} className="text-amber-400" aria-hidden />,
  info: <Info size={18} className="text-accent-text" aria-hidden />,
};

export function FeedbackHost() {
  const tr = useTranslations("toast");
  const c = useTranslations("common");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onToast = (t: ToastItem) => {
      setToasts((prev) => [...prev.slice(-3), t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 4500);
    };
    const onConfirm = (r: ConfirmRequest) => setConfirmReq(r);
    toastListeners.add(onToast);
    confirmListeners.add(onConfirm);
    return () => { toastListeners.delete(onToast); confirmListeners.delete(onConfirm); };
  }, []);

  const close = (ok: boolean) => {
    confirmReq?.resolve(ok);
    setConfirmReq(null);
  };

  useEffect(() => {
    if (!confirmReq) return;
    confirmBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { confirmReq.resolve(false); setConfirmReq(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmReq]);

  return (
    <>
      <div className="pointer-events-none fixed end-4 top-4 z-[100] flex w-[min(380px,calc(100%-2rem))] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role={t.tone === "error" ? "alert" : "status"}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line-strong bg-raised px-4 py-3 text-sm text-ink shadow-2xl shadow-black/50">
            <span className="mt-0.5 flex-shrink-0">{toneIcon[t.tone]}</span>
            <p className="min-w-0 flex-1 leading-relaxed">{t.message}</p>
            <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} aria-label={tr("dismiss")}
              className="-me-1 grid h-6 w-6 flex-shrink-0 place-items-center rounded-md text-ink-subtle hover:bg-white/5 hover:text-ink">
              <X size={14} aria-hidden />
            </button>
          </div>
        ))}
      </div>

      {confirmReq && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => close(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-line-strong bg-surface p-6 shadow-2xl shadow-black/60">
            <h2 id="confirm-title" className="text-base font-semibold text-ink">{confirmReq.title}</h2>
            {confirmReq.description && <p className="mt-2 text-sm leading-relaxed text-ink-muted">{confirmReq.description}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => close(false)} className="h-10 rounded-xl border border-line bg-raised px-4 text-sm font-medium text-ink transition-colors hover:border-line-strong">
                {confirmReq.cancelLabel ?? c("cancel")}
              </button>
              <button ref={confirmBtnRef} onClick={() => close(true)}
                className={"h-10 rounded-xl px-4 text-sm font-medium text-white transition-colors " + (confirmReq.destructive ? "bg-red-600 hover:bg-red-500" : "bg-accent hover:bg-accent-hover")}>
                {confirmReq.confirmLabel ?? tr("confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
