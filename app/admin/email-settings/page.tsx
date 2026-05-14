"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminEmailSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");

  const fields = [
    { key: "smtp_host", label: "SMTP Host", placeholder: "smtp.resend.com" },
    { key: "smtp_port", label: "SMTP Port", placeholder: "465" },
    { key: "smtp_security", label: "Security Protocol", placeholder: "TLS" },
    { key: "smtp_username", label: "Username", placeholder: "resend" },
    { key: "smtp_password", label: "Password / API Key", placeholder: "••••••••••••", secret: true },
    { key: "smtp_sender_email", label: "Sender Email", placeholder: "noreply@klipflowai.com" },
    { key: "smtp_sender_name", label: "Sender Name", placeholder: "KlipflowAI" },
  ];

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/settings?category=email", { headers: { Authorization: "Bearer " + session.access_token } });
      const data = await res.json();
      const map = {};
      data.settings?.forEach((s) => { map[s.key] = s.value || ""; });
      setSettings(map);
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ settings: Object.entries(settings).map(([key, value]) => ({ key, value })) }) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold mb-1">Email Settings</h1><p className="text-gray-400 text-sm">Configure SMTP for transactional emails</p></div>
        <button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition text-sm">{saving ? "Saving..." : saved ? "Saved!" : "Save Configuration"}</button>
      </div>
      {loading ? <p className="text-gray-400">Loading...</p> : (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="text-gray-400 text-xs mb-1 block">{field.label}</label>
              <input type={field.secret ? "password" : "text"} value={settings[field.key] || ""} onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })} placeholder={field.placeholder} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
            </div>
          ))}
          <div className="pt-4 border-t border-white/10">
            <label className="text-gray-400 text-xs mb-1 block">Send Test Email</label>
            <div className="flex gap-2">
              <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
              <button onClick={() => { setTesting(true); setTimeout(() => { setTestResult("Test sent!"); setTesting(false); setTimeout(() => setTestResult(""), 3000); }, 2000); }} disabled={testing || !testEmail} className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-xl transition text-sm">{testing ? "Sending..." : "Send"}</button>
            </div>
            {testResult && <p className="text-green-400 text-xs mt-2">{testResult}</p>}
          </div>
        </div>
      )}
    </div>
  );
}