'use client';
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabase";
import AuthShell, { PasswordInput } from "../components/AuthShell";
import { Alert, Button, Field, Spinner } from "../components/ui";

export default function UpdatePassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleAuthChange = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setReady(true);
        return;
      }

      const hash = window.location.hash;
      if (hash) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        if (accessToken && type === 'recovery') {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          if (!error) setReady(true);
          else setError('Invalid or expired reset link. Please request a new one.');
        } else {
          setError('Invalid reset link. Please request a new one.');
        }
      } else {
        setError('Invalid reset link. Please request a new one.');
      }
    };

    handleAuthChange();
  }, []);

  const handleUpdate = async () => {
    if (!password || !confirmPassword) {
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

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <AuthShell title="Choose a new password" subtitle="Use at least 8 characters.">
      {!ready && !error && (
        <div className="flex flex-col items-center py-8 text-center">
          <Spinner size={24} className="text-accent-text" />
          <p className="mt-3 text-sm text-ink-muted">Verifying your reset link…</p>
        </div>
      )}

      {error && !ready && (
        <div className="flex flex-col items-center py-4 text-center">
          <span className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-red-500/10 text-red-400"><AlertTriangle size={20} aria-hidden /></span>
          <p className="mb-5 text-sm text-ink-muted">{error}</p>
          <Button variant="primary" onClick={() => router.push('/reset-password')}>Request a new link</Button>
        </div>
      )}

      {ready && (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleUpdate(); }}>
          <Field label="New password">
            <PasswordInput autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Confirm new password">
            <PasswordInput autoComplete="new-password" placeholder="Repeat new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
            {loading ? <><Spinner size={17} /> Updating…</> : "Update password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
