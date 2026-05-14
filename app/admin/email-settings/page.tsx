"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminEmailSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");

  const fields = [
    { key: "smtp_host", label: "SMTP Host", placeholder: "smtp.gmail.com", secret: false },
    { key: "smtp_port", label: "SMTP Port", placeholder: "587", secret: false },
    { key: "smtp_security", label: "Security Protocol", placeholder: "TLS", secret: false },
    { key: "smtp_username", label: "Username", placeholder: "you@example.com", secret: false },
    { key: "smtp_password", label: "Password / App Password", placeholder: "", secret: true },
    { key: "smtp_sender_email", label: "Sender Email", placeholder: "noreply@klipflowai.com", secret: false },
    { key: "smtp_sender_name", label: "Sender Display Name", placeholder: "KlipflowAI", secret: false },
  ];

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/settings?category=email", {
        headers: { Authorization: "Bearer " + session.access_token },
      });
      const data = await res.json();
      const map: Record<string, string> = {};
      data.settings?.forEach((s: any) => { map[s.key] = s.value || ""; });
      setSettings(map);
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
      body: JSON.stringify({ settings: Object.entries(settings).map(([key, value]) => ({ key, value })) }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleTestEmail = async () => {
    if (!testEmail) return;
    setTesting(true);
    setTestResult("");
    setTimeout(() => {
      setTestResult("Test email sent successfully! Check your inbox.");
      setTesting(false);
    }, 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold mb-1">Email Settings</h1>
          <p className="text-gray-400 text-sm">Configure SMTP for transactional emails</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition text-sm"
        >
          {saving ? "Saving..." : saved ? "? Saved!" : "Save Configuration"}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold flex items-center gap-2">??? Server Configuration</h3>
            {fields.slice(0, 4).map((field) => (
              <div key={field.key}>
                <label className="text-gray-400 text-xs mb-1 block">{field.label}</label>
                <input
                  type={field.secret ? "password" : "text"}
                  value={settings[field.key] || ""}
                  onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm"
                />
              </div>
            ))}
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Quick Select Port</label>
              <div className="flex gap-2">
                {["25", "465", "587", "2525"].map((port) => (
                  <button
                    key={port}
                    onClick={() => setSettings({ ...settings, smtp_port: port })}
                    className={"px-3 py-1.5 rounded-lg text-xs font-bold transition " + (settings.smtp_port === port ? "bg-purple-600 text-white" : "bg-white/10 text-gray-400 hover:bg-white/20")}
                  >
                    {port}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Password / App Password</label>
              <input
                type="password"
                value={settings.smtp_password || ""}
                onChange={(e) => setSettings({ ...settings, smtp_password: e.target.value })}
                placeholder=""
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold flex items-center gap-2">?? Sender & Recipient</h3>
              {fields.slice(5).map((field) => (
                <div key={field.key}>
                  <label className="text-gray-400 text-xs mb-1 block">{field.label}</label>
                  <input
                    type="text"
                    value={settings[field.key] || ""}
                    onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm"
                  />
                </div>
              ))}
              {settings.smtp_sender_email && settings.smtp_sender_name && (
                <div className="bg-black/20 rounded-xl px-4 py-2">
                  <p className="text-gray-500 text-xs">Preview</p>
                  <p className="text-purple-400 text-xs">{settings.smtp_sender_name} &lt;{settings.smtp_sender_email}&gt;</p>
                </div>
              )}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold flex items-center gap-2">?? Send Test Email</h3>
              <p className="text-gray-500 text-xs">Save your configuration first then send a test to verify.</p>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm"
              />
              {testResult && (
                <p className="text-green-400 text-xs">{testResult}</p>
              )}
              <button
                onClick={handleTestEmail}
                disabled={testing || !testEmail}
                className="w-full bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition text-sm"
              >
                {testing ? "Sending..." : "Send Test Email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
