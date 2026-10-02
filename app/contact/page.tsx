"use client";
import { useState } from "react";
import { CheckCircle2, Clock, Mail } from "lucide-react";
import MarketingShell from "../components/MarketingShell";
import { Alert, Button, ButtonLink, Field, Input, Spinner, Textarea } from "../components/ui";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.message) {
      setError("Please fill in all required fields.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setSent(true);
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <MarketingShell>
        <section className="mx-auto flex max-w-md flex-col items-center px-4 py-28 text-center">
          <span className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-400"><CheckCircle2 size={26} aria-hidden /></span>
          <h1 className="text-3xl font-semibold tracking-tight">Message sent</h1>
          <p className="mt-3 text-ink-muted">Thanks for reaching out. We&apos;ll get back to you within 24 hours.</p>
          <ButtonLink href="/" variant="secondary" size="lg" className="mt-8">Back to home</ButtonLink>
        </section>
      </MarketingShell>
    );
  }

  return (
    <MarketingShell>
      <section className="mx-auto max-w-5xl px-4 py-16 md:px-8 md:py-20">
        <div className="mb-12 max-w-xl">
          <h1 className="text-4xl font-semibold tracking-tight">Get in touch</h1>
          <p className="mt-3 text-lg text-ink-muted">Have a question or need help? We&apos;d love to hear from you.</p>
        </div>

        <div className="grid gap-8 md:grid-cols-[1fr_1.4fr] md:gap-12">
          <div className="space-y-6">
            <div className="space-y-4">
              {[
                { icon: Mail, label: "Email", value: "support@klipflowai.com" },
                { icon: Clock, label: "Response time", value: "Within 24 hours" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-4">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent-text"><Icon size={19} aria-hidden /></span>
                    <div>
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-sm text-ink-muted">{item.value}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-line bg-surface p-6">
              <h3 className="font-semibold">Try KlipflowAI free</h3>
              <p className="mt-2 text-sm text-ink-muted">Get 25 free tokens and generate your first AI video today. No credit card required.</p>
              <ButtonLink href="/signup" variant="primary" className="mt-5">Get started free</ButtonLink>
            </div>
          </div>

          <form className="space-y-4 rounded-2xl border border-line bg-surface p-6" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            <h2 className="text-lg font-semibold">Send a message</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" required />
              </Field>
              <Field label="Phone (optional)">
                <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 234 567 8900" />
              </Field>
            </div>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" required />
            </Field>
            <Field label="Message">
              <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="How can we help?" rows={5} required />
            </Field>
            {error && <Alert>{error}</Alert>}
            <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
              {loading ? <><Spinner size={17} /> Sending…</> : "Send message"}
            </Button>
          </form>
        </div>
      </section>
    </MarketingShell>
  );
}
