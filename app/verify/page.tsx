'use client';
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Coins } from "lucide-react";
import { useTranslations } from "next-intl";
import { supabase } from "../lib/supabase";
import AuthShell from "../components/AuthShell";
import { ButtonLink, Spinner } from "../components/ui";

export default function Verify() {
  const t = useTranslations("verify");
  const c = useTranslations("common");
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
      <AuthShell title={t("loadingTitle")} subtitle={t("loadingSubtitle")}>
        <div className="flex justify-center py-6"><Spinner size={26} className="text-accent-text" /></div>
      </AuthShell>
    );
  }

  if (status === 'success') {
    return (
      <AuthShell title={t("successTitle")} subtitle={t("successSubtitle")}>
        <div className="mb-6 flex items-center gap-4 rounded-xl border border-accent/30 bg-accent/10 p-4">
          <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-accent text-white"><Coins size={20} aria-hidden /></span>
          <div>
            <p className="text-lg font-semibold text-ink">{t("freeTokens")}</p>
            <p className="text-sm text-ink-muted">{t("freeTokensHint")}</p>
          </div>
        </div>
        <ButtonLink href="/dashboard" variant="primary" size="lg" className="w-full">{c("goToDashboard")} <ArrowRight size={17} className="rtl:-scale-x-100" aria-hidden /></ButtonLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("failedTitle")}
      subtitle={t("failedSubtitle")}
      footer={<>{t("needHelp")} <Link href="/contact" className="font-medium text-accent-text hover:text-ink">{t("contactSupport")}</Link></>}
    >
      <ButtonLink href="/signup" variant="primary" size="lg" className="w-full">{c("tryAgain")}</ButtonLink>
    </AuthShell>
  );
}
