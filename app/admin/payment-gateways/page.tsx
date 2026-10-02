"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminPaymentGateways() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const gateways = [
    { id: "stripe", name: "Stripe", desc: "Global payments", fields: [{ key: "stripe_publishable_key", label: "Publishable Key", secret: false }, { key: "stripe_secret_key", label: "Secret Key", secret: true }, { key: "stripe_webhook_secret", label: "Webhook Secret", secret: true }] },
    { id: "paypal", name: "PayPal", desc: "Global payments", fields: [{ key: "paypal_client_id", label: "Client ID", secret: false }, { key: "paypal_client_secret", label: "Client Secret", secret: true }] },
    { id: "paystack", name: "Paystack", desc: "Africa payments — Nigeria, Ghana, Kenya, South Africa", fields: [{ key: "paystack_public_key", label: "Public Key", secret: false }, { key: "paystack_secret_key", label: "Secret Key", secret: true }] },
    { id: "flutterwave", name: "Flutterwave", desc: "Africa and Global payments", fields: [{ key: "flutterwave_public_key", label: "Public Key", secret: false }, { key: "flutterwave_secret_key", label: "Secret Key", secret: true }] },
    { id: "razorpay", name: "Razorpay", desc: "India payments", fields: [{ key: "razorpay_key_id", label: "Key ID", secret: false }, { key: "razorpay_key_secret", label: "Key Secret", secret: true }] },
  ];

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/settings?category=payments", { headers: { Authorization: "Bearer " + session.access_token } });
      const data = await res.json();
      const map: Record<string, string> = {};
      data.settings?.forEach((s: any) => { map[s.key] = s.value || ""; });
      setSettings(map);
        const enabledMap: Record<string, boolean> = {};
        data.settings?.forEach((s: any) => {
          if (s.key.endsWith("_enabled")) enabledMap[s.key.replace("_enabled", "")] = s.value === "true";
        });
        setEnabled(enabledMap);
        setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const allSettings = [
        ...Object.entries(settings).map(([key, value]) => ({ key, value, category: "payments" })),
        ...Object.entries(enabled).map(([key, value]) => ({ key: key + "_enabled", value: String(value), category: "payments" })),
      ];
      await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ settings: allSettings }) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight mb-1">Payment Gateways</h1><p className="text-ink-muted text-sm">Configure and enable payment providers</p></div>
        <button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 px-6 rounded-xl transition text-sm">{saving ? "Saving..." : saved ? "Saved!" : "Save Gateways"}</button>
      </div>
      {loading ? <p className="text-ink-muted">Loading...</p> : (
        <div className="space-y-4">
          {gateways.map((gateway) => (
            <div key={gateway.id} className="bg-surface border border-line rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div><h3 className="font-semibold">{gateway.name}</h3><p className="text-ink-subtle text-xs">{gateway.desc}</p></div>
                <button onClick={() => setEnabled({ ...enabled, [gateway.id]: !enabled[gateway.id] })} className={"relative w-12 h-6 rounded-full transition-colors " + (enabled[gateway.id] ? "bg-purple-600" : "bg-raised-hover")}>
                  <div className={"absolute top-1 w-4 h-4 bg-white rounded-full transition-all " + (enabled[gateway.id] ? "left-7" : "left-1")} />
                </button>
              </div>
              <div className="space-y-3">
                {gateway.fields.map((field) => (
                  <div key={field.key}>
                    <label className="text-ink-muted text-xs mb-1 block">{field.label}</label>
                    <input type={field.secret ? "password" : "text"} value={settings[field.key] || ""} onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })} placeholder={"Enter " + field.label} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-4 py-2.5 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}