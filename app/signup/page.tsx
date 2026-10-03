'use client';
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { supabase } from "../lib/supabase";
import { getDeviceFingerprint } from "../lib/fingerprint";
import { MailCheck } from "lucide-react";
import AuthShell, { AuthDivider, GoogleButton, PasswordInput } from "../components/AuthShell";
import { Alert, Button, Field, Input, Spinner } from "../components/ui";
import { useAuthErrorMessage } from "../lib/auth-errors";

export default function SignUp() {
  const t = useTranslations("signup");
  const a = useTranslations("authForm");
  const authError = useAuthErrorMessage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.push('/dashboard');
    };
    checkSession();
  }, []);

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      setError(a("fillAll"));
      return;
    }
    if (password !== confirmPassword) {
      setError(a("mismatch"));
      return;
    }
    if (password.length < 8) {
      setError(a("tooShort"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const fingerprint = await getDeviceFingerprint();

      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fingerprint })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ? authError(data.error) : a("genericError"));
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/verify`
        }
      });

      if (signUpError) {
        setError(authError(signUpError.message));
        return;
      }

      setSuccess(true);

    } catch (err) {
      setError(a("genericError"));
    } finally {
      setLoading(false);
    }
  };

  const signUpWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `https://klipflowai.com/verify` }
    });
  };

  if (success) {
    return (
      <AuthShell
        title={t("checkEmailTitle")}
        subtitle={t.rich("checkEmailSubtitle", { email, strong: (chunks) => <span className="font-medium text-ink">{chunks}</span> })}
        footer={<>{t("alreadyVerified")} <Link href="/login" className="font-medium text-accent-text hover:text-ink">{t("signIn")}</Link></>}
      >
        <div className="flex items-start gap-3 rounded-xl border border-line bg-canvas p-4">
          <MailCheck size={20} className="mt-0.5 flex-shrink-0 text-accent-text" aria-hidden />
          <p className="text-sm text-ink-muted">{t("spamHint")}</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={<>{t("haveAccount")} <Link href="/login" className="font-medium text-accent-text hover:text-ink">{t("signIn")}</Link></>}
    >
      <GoogleButton onClick={signUpWithGoogle} />
      <AuthDivider />
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSignUp(); }}>
        <Field label={a("email")}>
          <Input type="email" autoComplete="email" placeholder={a("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </Field>
        <Field label={a("password")}>
          <PasswordInput autoComplete="new-password" placeholder={t("passwordPlaceholder")} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label={t("confirmPassword")}>
          <PasswordInput autoComplete="new-password" placeholder={t("confirmPlaceholder")} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
          {loading ? <><Spinner size={17} /> {t("creating")}</> : t("submit")}
        </Button>
        <p className="text-center text-xs leading-relaxed text-ink-subtle">
          {t.rich("agree", {
            terms: (chunks) => <Link href="/terms-of-service" className="text-ink-muted underline-offset-2 hover:text-ink hover:underline">{chunks}</Link>,
            privacy: (chunks) => <Link href="/privacy-policy" className="text-ink-muted underline-offset-2 hover:text-ink hover:underline">{chunks}</Link>,
          })}
        </p>
      </form>
    </AuthShell>
  );
}
