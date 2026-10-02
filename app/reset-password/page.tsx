'use client';
import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { supabase } from "../lib/supabase";
import AuthShell from "../components/AuthShell";
import { Alert, Button, Field, Input, Spinner } from "../components/ui";

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async () => {
    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `https://klipflowai.com/update-password`
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSent(true);

    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={<>We sent a password reset link to <span className="font-medium text-ink">{email}</span>.</>}
        footer={<Link href="/login" className="font-medium text-accent-text hover:text-ink">Back to sign in</Link>}
      >
        <div className="flex items-start gap-3 rounded-xl border border-line bg-canvas p-4">
          <MailCheck size={20} className="mt-0.5 flex-shrink-0 text-accent-text" aria-hidden />
          <p className="text-sm text-ink-muted">Open the link on this device to choose a new password. Check your spam folder if it doesn&apos;t arrive.</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
      footer={<>Remember your password? <Link href="/login" className="font-medium text-accent-text hover:text-ink">Sign in</Link></>}
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleReset(); }}>
        <Field label="Email">
          <Input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
          {loading ? <><Spinner size={17} /> Sending…</> : "Send reset link"}
        </Button>
      </form>
    </AuthShell>
  );
}
