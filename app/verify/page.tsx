'use client';
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Coins } from "lucide-react";
import { supabase } from "../lib/supabase";
import AuthShell from "../components/AuthShell";
import { ButtonLink, Spinner } from "../components/ui";

export default function Verify() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase
          .from('device_fingerprints')
          .update({ verified: true })
          .eq('email', session.user.email);
        setStatus('success');
      } else {
        setStatus('error');
      }
    };
    checkSession();
  }, []);

  if (status === 'loading') {
    return (
      <AuthShell title="Verifying your account" subtitle="This only takes a moment.">
        <div className="flex justify-center py-6"><Spinner size={26} className="text-accent-text" /></div>
      </AuthShell>
    );
  }

  if (status === 'success') {
    return (
      <AuthShell title="You're verified" subtitle="Your account is confirmed and your free tokens are ready.">
        <div className="mb-6 flex items-center gap-4 rounded-xl border border-accent/30 bg-accent/10 p-4">
          <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-accent text-white"><Coins size={20} aria-hidden /></span>
          <div>
            <p className="text-lg font-semibold text-ink">25 free tokens</p>
            <p className="text-sm text-ink-muted">Enough to generate 2 full AI videos.</p>
          </div>
        </div>
        <ButtonLink href="/dashboard" variant="primary" size="lg" className="w-full">Go to dashboard <ArrowRight size={17} aria-hidden /></ButtonLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Verification failed"
      subtitle="The verification link may have expired. Try signing up again or contact support."
      footer={<>Need help? <Link href="/contact" className="font-medium text-accent-text hover:text-ink">Contact support</Link></>}
    >
      <ButtonLink href="/signup" variant="primary" size="lg" className="w-full">Try again</ButtonLink>
    </AuthShell>
  );
}
