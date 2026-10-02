'use client';
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import AuthShell, { AuthDivider, GoogleButton, PasswordInput } from "../components/AuthShell";
import { Alert, Button, Field, Input, Spinner, labelClass } from "../components/ui";

export default function Login() {
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
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      router.push('/dashboard');

    } catch (err) {
      setError('Something went wrong. Please try again.');
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
      title="Welcome back"
      subtitle="Sign in to your KlipflowAI account."
      footer={<>Don&apos;t have an account? <Link href="/signup" className="font-medium text-accent-text hover:text-ink">Sign up free</Link></>}
    >
      <GoogleButton onClick={signInWithGoogle} />
      <AuthDivider />
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
        <Field label="Email">
          <Input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </Field>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className={labelClass + " mb-0"}>Password</label>
            <Link href="/reset-password" className="text-xs font-medium text-accent-text hover:text-ink">Forgot password?</Link>
          </div>
          <PasswordInput autoComplete="current-password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
          {loading ? <><Spinner size={17} /> Signing in…</> : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
