'use client';
import { useState, useEffect } from "react";
import { Check, LogOut } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Badge, Button, Field, Input, PageHeader, SectionTitle, cardClass } from "../../components/ui";

export default function Settings() {
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
      <PageHeader title="Settings" description="Manage your account and connected platforms." />

      <div className="space-y-4">
        {/* PROFILE */}
        <section className={`${cardClass} p-5 md:p-6`}>
          <SectionTitle>Profile</SectionTitle>
          <div className="space-y-4">
            <Field label="Display name">
              <Input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </Field>
            <Field label="Email" hint="Contact support to change your email address.">
              <Input type="email" value={user?.email || ""} disabled />
            </Field>
            <Button variant="primary" onClick={handleSave}>
              {saved ? <><Check size={16} aria-hidden /> Saved</> : "Save changes"}
            </Button>
          </div>
        </section>

        {/* CONNECTED PLATFORMS */}
        <section className={`${cardClass} p-5 md:p-6`}>
          <SectionTitle description="Connect your accounts for Autopilot posting.">Connected social accounts</SectionTitle>
          <ul className="divide-y divide-line/60">
            {connectedPlatforms.map((platform) => (
              <li key={platform.name} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-raised text-xs font-semibold text-ink">{platform.mark}</span>
                  <span className="text-sm font-medium">{platform.name}</span>
                </div>
                {platform.connected
                  ? <Badge tone="success"><Check size={12} aria-hidden /> Connected</Badge>
                  : <Badge>Coming soon</Badge>}
              </li>
            ))}
          </ul>
        </section>

        {/* SIGN OUT */}
        <section className={`${cardClass} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6`}>
          <div>
            <h2 className="text-base font-semibold">Sign out</h2>
            <p className="mt-0.5 text-sm text-ink-muted">Sign out of KlipflowAI on this device.</p>
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              const { supabase } = await import('../../lib/supabase');
              await supabase.auth.signOut();
              window.location.href = '/';
            }}
          >
            <LogOut size={16} aria-hidden /> Sign out
          </Button>
        </section>

        {/* DANGER ZONE */}
        <section className="flex flex-col gap-4 rounded-2xl border border-red-500/25 bg-red-500/[0.05] p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
          <div>
            <h2 className="text-base font-semibold text-red-300">Delete account</h2>
            <p className="mt-0.5 text-sm text-ink-muted">Permanently delete your account and all data.</p>
          </div>
          <button className="h-10 rounded-xl border border-red-500/25 px-4 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10">
            Delete account
          </button>
        </section>
      </div>
    </div>
  );
}
