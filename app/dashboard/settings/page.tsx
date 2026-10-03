'use client';
import { useState, useEffect } from "react";
import { Check, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "../../components/LanguageSwitcher";
import { supabase } from "../../lib/supabase";
import { Badge, Button, Field, Input, PageHeader, SectionTitle, cardClass } from "../../components/ui";

export default function Settings() {
  const t = useTranslations("settings");
  const nav = useTranslations("nav");
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        setName(session.user.user_metadata?.full_name || "");
      }
    };
    getUser();
  }, []);

  const handleSave = async () => {
    await supabase.auth.updateUser({ data: { full_name: name } });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const connectedPlatforms = [
    { name: "TikTok", mark: "Tk", connected: false },
    { name: "Instagram", mark: "Ig", connected: false },
    { name: "YouTube", mark: "Yt", connected: false },
    { name: "Facebook", mark: "Fb", connected: false },
    { name: "X (Twitter)", mark: "X", connected: false },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={nav("settings")} description={t("description")} />

      <div className="space-y-4">
        {/* PROFILE */}
        <section className={`${cardClass} p-5 md:p-6`}>
          <SectionTitle>{t("profile")}</SectionTitle>
          <div className="space-y-4">
            <Field label={t("displayName")}>
              <Input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} />
            </Field>
            <Field label={t("email")} hint={t("emailHint")}>
              <Input type="email" value={user?.email || ""} disabled />
            </Field>
            <Button variant="primary" onClick={handleSave}>
              {saved ? <><Check size={16} aria-hidden /> {t("saved")}</> : t("saveChanges")}
            </Button>
          </div>
        </section>

        {/* INTERFACE LANGUAGE */}
        <section className={`${cardClass} p-5 md:p-6`}>
          <SectionTitle description={t("languageDesc")}>{t("language")}</SectionTitle>
          <LanguageSwitcher className="w-full sm:w-64" block />
        </section>

        {/* CONNECTED PLATFORMS */}
        <section className={`${cardClass} p-5 md:p-6`}>
          <SectionTitle description={t("socialDesc")}>{t("social")}</SectionTitle>
          <ul className="divide-y divide-line/60">
            {connectedPlatforms.map((platform) => (
              <li key={platform.name} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-raised text-xs font-semibold text-ink">{platform.mark}</span>
                  <span className="text-sm font-medium">{platform.name}</span>
                </div>
                {platform.connected
                  ? <Badge tone="success"><Check size={12} aria-hidden /> {t("connected")}</Badge>
                  : <Badge>{t("comingSoon")}</Badge>}
              </li>
            ))}
          </ul>
        </section>

        {/* SIGN OUT */}
        <section className={`${cardClass} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6`}>
          <div>
            <h2 className="text-base font-semibold">{nav("signOut")}</h2>
            <p className="mt-0.5 text-sm text-ink-muted">{t("signOutDesc")}</p>
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              const { supabase } = await import('../../lib/supabase');
              await supabase.auth.signOut();
              window.location.href = '/';
            }}
          >
            <LogOut size={16} className="rtl:-scale-x-100" aria-hidden /> {nav("signOut")}
          </Button>
        </section>

        {/* DANGER ZONE */}
        <section className="flex flex-col gap-4 rounded-2xl border border-red-500/25 bg-red-500/[0.05] p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
          <div>
            <h2 className="text-base font-semibold text-red-300">{t("deleteAccount")}</h2>
            <p className="mt-0.5 text-sm text-ink-muted">{t("deleteDesc")}</p>
          </div>
          <button className="h-10 rounded-xl border border-red-500/25 px-4 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10">
            {t("deleteAccount")}
          </button>
        </section>
      </div>
    </div>
  );
}
