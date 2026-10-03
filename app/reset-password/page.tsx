'use client';
import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuthErrorMessage } from "../lib/auth-errors";
import { supabase } from "../lib/supabase";
import AuthShell from "../components/AuthShell";
import { Alert, Button, Field, Input, Spinner } from "../components/ui";

export default function ResetPassword() {
  const t = useTranslations("resetPassword");
  const a = useTranslations("authForm");
  const authError = useAuthErrorMessage();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async () => {
    if (!email) {
      setError(t("enterEmail"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `https://klipflowai.com/update-password`
      });

      if (resetError) {
        setError(authError(resetError.message));
        return;
      }

      setSent(true);

    } catch (err) {
      setError(a("genericError"));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthShell
        title={t("sentTitle")}
        subtitle={t.rich("sentSubtitle", { email, strong: (chunks) => <span className="font-medium text-ink">{chunks}</span> })}
        footer={<Link href="/login" className="font-medium text-accent-text hover:text-ink">{t("backToSignIn")}</Link>}
      >
        <div className="flex items-start gap-3 rounded-xl border border-line bg-canvas p-4">
          <MailCheck size={20} className="mt-0.5 flex-shrink-0 text-accent-text" aria-hidden />
          <p className="text-sm text-ink-muted">{t("sentHint")}</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={<>{t("remember")} <Link href="/login" className="font-medium text-accent-text hover:text-ink">{t("signIn")}</Link></>}
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleReset(); }}>
        <Field label={a("email")}>
          <Input type="email" autoComplete="email" placeholder={a("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
          {loading ? <><Spinner size={17} /> {t("sending")}</> : t("submit")}
        </Button>
      </form>
    </AuthShell>
  );
}
