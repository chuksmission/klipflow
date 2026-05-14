"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminTokenPricing() {
  const [pricing, setPricing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchPricing = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/token-pricing", {
        headers: { Authorization: "Bearer " + session.access_token },
      });
      const data = await res.json();
      setPricing(data.pricing || []);
      setLoading(false);
    };
    fetchPricing();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/admin/token-pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
      body: JSON.stringify({ pricing }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold mb-1">Token Pricing</h1>
          <p className="text-gray-400 text-sm">Set credit cost for each action</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition text-sm"
        >
          {saving ? "Saving..." : saved ? "? Saved!" : "Save Changes"}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          {pricing.map((item, i) => (
            <div key={i} className="flex items-center justify-between p-4 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <div className="font-semibold text-sm">{item.description}</div>
                  <div className="text-gray-500 text-xs">{item.action}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-yellow-400">??</span>
                <input
                  type="number"
                  value={item.tokens}
                  onChange={(e) => {
                    const updated = [...pricing];
                    updated[i] = { ...item, tokens: parseInt(e.target.value) || 0 };
                    setPricing(updated);
                  }}
                  className="w-16 bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-white text-center focus:outline-none focus:border-purple-500 transition text-sm"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
