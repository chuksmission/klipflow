'use client';
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { supabase } from "../lib/supabase";
import AuthShell, { AuthDivider, GoogleButton, PasswordInput } from "../components/AuthShell";
import { Alert, Button, Field, Input, Spinner, labelClass } from "../components/ui";
import { useAuthErrorMessage } from "../lib/auth-errors";

export default function Login() {
  const t = useTranslations("login");
  const a = useTranslations("authForm");
  const authError = useAuthErrorMessage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.push('/dashboard');
    };
    checkSession();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      setError(a("fillAll"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        setError(authError(signInError.message));
        return;
      }

      router.push('/dashboard');

    } catch (err) {
      setError(a("genericError"));
    } finally {
      setLoading(false);
    }
  };


  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/verify` }
    });
  };

  return (
    <AuthShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={<>{t("noAccount")} <Link href="/signup" className="font-medium text-accent-text hover:text-ink">{t("signUpFree")}</Link></>}
    >
      <GoogleButton onClick={signInWithGoogle} />
      <AuthDivider />
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
        <Field label={a("email")}>
          <Input type="email" autoComplete="email" placeholder={a("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </Field>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className={labelClass + " mb-0"}>{a("password")}</label>
            <Link href="/reset-password" className="text-xs font-medium text-accent-text hover:text-ink">{t("forgot")}</Link>
          </div>
          <PasswordInput autoComplete="current-password" placeholder={t("passwordPlaceholder")} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
          {loading ? <><Spinner size={17} /> {t("signingIn")}</> : t("submit")}
        </Button>
      </form>
    </AuthShell>
  );
}
