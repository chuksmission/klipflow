"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminEmailTemplates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [activeTemplate, setActiveTemplate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await supabase
        .from("email_templates")
        .select("*")
        .order("id");
      setTemplates(data || []);
      setLoading(false);
    };
    fetchTemplates();
  }, []);

  const handleSave = async () => {
    if (!templates[activeTemplate]) return;
    setSaving(true);
    const template = templates[activeTemplate];
    await supabase
      .from("email_templates")
      .update({
        subject: template.subject,
        html_body: template.html_body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", template.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const updateTemplate = (field: string, value: string) => {
    const updated = [...templates];
    updated[activeTemplate] = { ...updated[activeTemplate], [field]: value };
    setTemplates(updated);
  };

  const variables = ["{{user_name}}", "{{user_email}}", "{{token_balance}}", "{{plan_name}}", "{{dashboard_url}}", "{{verification_url}}", "{{reset_url}}", "{{billing_url}}", "{{tokens_added}}"];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold mb-1">Email Templates</h1>
          <p className="text-gray-400 text-sm">Manage transactional email templates</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition text-sm"
        >
          {saving ? "Saving..." : saved ? "? Saved!" : "Save Template"}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div className="flex gap-2 flex-wrap">
              {templates.map((template, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTemplate(i)}
                  className={"px-4 py-2 rounded-xl text-xs font-bold transition " + (activeTemplate === i ? "bg-purple-600 text-white" : "bg-white/10 text-gray-400 hover:bg-white/20")}
                >
                  {template.name?.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </button>
              ))}
            </div>

            {templates[activeTemplate] && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Subject Line</label>
                  <input
                    type="text"
                    value={templates[activeTemplate].subject || ""}
                    onChange={(e) => updateTemplate("subject", e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-gray-400 text-xs">HTML Body</label>
                    <button
                      onClick={() => updateTemplate("html_body", "")}
                      className="text-gray-600 hover:text-white text-xs transition"
                    >
                      Reset
                    </button>
                  </div>
                  <textarea
                    value={templates[activeTemplate].html_body || ""}
                    onChange={(e) => updateTemplate("html_body", e.target.value)}
                    rows={16}
                    className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-xs font-mono resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="font-bold text-sm mb-3">Available Variables</h3>
              <p className="text-gray-500 text-xs mb-3">Click to copy. Variables are replaced with real values when email is sent.</p>
              <div className="space-y-2">
                {variables.map((variable, i) => (
                  <button
                    key={i}
                    onClick={() => navigator.clipboard.writeText(variable)}
                    className="w-full text-left bg-black/20 hover:bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-purple-400 text-xs font-mono transition"
                  >
                    {variable}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-purple-900/20 border border-purple-500/20 rounded-2xl p-5">
              <h3 className="font-bold text-sm mb-2">?? How it works</h3>
              <p className="text-gray-400 text-xs leading-relaxed">Variables like {"{{user_name}}"} are automatically replaced with real values when the email is sent to users.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
