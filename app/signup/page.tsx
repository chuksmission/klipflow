'use client';
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getDeviceFingerprint } from "../lib/fingerprint";
import { MailCheck } from "lucide-react";
import AuthShell, { AuthDivider, GoogleButton, PasswordInput } from "../components/AuthShell";
import { Alert, Button, Field, Input, Spinner } from "../components/ui";

export default function SignUp() {
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
      setError("Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
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
        setError(data.error || 'Something went wrong.');
        return;
      }

      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/verify`
        }
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      setSuccess(true);

    } catch (err) {
      setError('Something went wrong. Please try again.');
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
        title="Check your email"
        subtitle={<>We sent a verification link to <span className="font-medium text-ink">{email}</span>. Click it to verify your account and claim your 25 free tokens.</>}
        footer={<>Already verified? <Link href="/login" className="font-medium text-accent-text hover:text-ink">Sign in</Link></>}
      >
        <div className="flex items-start gap-3 rounded-xl border border-line bg-canvas p-4">
          <MailCheck size={20} className="mt-0.5 flex-shrink-0 text-accent-text" aria-hidden />
          <p className="text-sm text-ink-muted">Don&apos;t see it? Check your spam or promotions folder. The link expires in 24 hours.</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Get 25 free tokens, enough for 2 videos. No credit card required."
      footer={<>Already have an account? <Link href="/login" className="font-medium text-accent-text hover:text-ink">Sign in</Link></>}
    >
      <GoogleButton onClick={signUpWithGoogle} />
      <AuthDivider />
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSignUp(); }}>
        <Field label="Email">
          <Input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </Field>
        <Field label="Password">
          <PasswordInput autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm password">
          <PasswordInput autoComplete="new-password" placeholder="Repeat your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
          {loading ? <><Spinner size={17} /> Creating account…</> : "Create free account"}
        </Button>
        <p className="text-center text-xs leading-relaxed text-ink-subtle">
          By signing up you agree to our{" "}
          <Link href="/terms-of-service" className="text-ink-muted underline-offset-2 hover:text-ink hover:underline">Terms of Service</Link>
          {" "}and{" "}
          <Link href="/privacy-policy" className="text-ink-muted underline-offset-2 hover:text-ink hover:underline">Privacy Policy</Link>.
        </p>
      </form>
    </AuthShell>
  );
}
