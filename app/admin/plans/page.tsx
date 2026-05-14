"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminPlans() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price_monthly: "",
    price_yearly: "",
    tokens_per_month: "",
    is_popular: false,
    is_active: true,
    features: "",
  });

  useEffect(() => {
    const fetchPlans = async () => {
      const { data } = await supabase
        .from("plans")
        .select("*")
        .order("sort_order");
      setPlans(data || []);
      setLoading(false);
    };
    fetchPlans();
  }, []);

  const handleCreate = async () => {
    if (!form.name) return;
    setSaving(true);
    const features = form.features.split("\n").filter((f) => f.trim());
    const { data } = await supabase
      .from("plans")
      .insert({
        name: form.name,
        description: form.description,
        price_monthly: parseFloat(form.price_monthly) || 0,
        price_yearly: parseFloat(form.price_yearly) || 0,
        tokens_per_month: parseInt(form.tokens_per_month) || 0,
        is_popular: form.is_popular,
        is_active: form.is_active,
        features: features,
        sort_order: plans.length + 1,
      })
      .select()
      .single();
    if (data) setPlans([...plans, data]);
    setForm({ name: "", description: "", price_monthly: "", price_yearly: "", tokens_per_month: "", is_popular: false, is_active: true, features: "" });
    setShowForm(false);
    setSaving(false);
  };

  const toggleActive = async (id: number, current: boolean) => {
    await supabase.from("plans").update({ is_active: !current }).eq("id", id);
    setPlans(plans.map((p) => p.id === id ? { ...p, is_active: !current } : p));
  };

  const deletePlan = async (id: number) => {
    await supabase.from("plans").delete().eq("id", id);
    setPlans(plans.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold mb-1">Plans</h1>
          <p className="text-gray-400 text-sm">Manage subscription plans and pricing</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-xl transition text-sm"
        >
          + New Plan
        </button>
      </div>

      {showForm && (
        <div className="bg-white/5 border border-purple-500/30 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-lg">Create New Plan</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Plan Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Creator Pro" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Description</label>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="For serious content creators" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Monthly Price ($)</label>
              <input type="number" value={form.price_monthly} onChange={(e) => setForm({ ...form, price_monthly: e.target.value })} placeholder="29" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Yearly Price ($)</label>
              <input type="number" value={form.price_yearly} onChange={(e) => setForm({ ...form, price_yearly: e.target.value })} placeholder="23" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Tokens Per Month</label>
              <input type="number" value={form.tokens_per_month} onChange={(e) => setForm({ ...form, tokens_per_month: e.target.value })} placeholder="250" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
            </div>
            <div className="flex items-center gap-4 pt-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setForm({ ...form, is_popular: !form.is_popular })} className={"relative w-10 h-5 rounded-full transition-colors " + (form.is_popular ? "bg-purple-600" : "bg-white/20")}>
                  <div className={"absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all " + (form.is_popular ? "left-5" : "left-0.5")} />
                </button>
                <span className="text-gray-400 text-xs">Mark as Popular</span>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-gray-400 text-xs mb-1 block">Features (one per line)</label>
              <textarea value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} placeholder={"250 tokens/month\nAll AI models\nVideo Studio\nAd Spy"} rows={5} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm resize-none" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving || !form.name} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition text-sm">
              {saving ? "Creating..." : "Create Plan"}
            </button>
            <button onClick={() => setShowForm(false)} className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl transition text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {plans.map((plan) => (
            <div key={plan.id} className={"bg-white/5 border rounded-2xl p-6 " + (plan.is_popular ? "border-purple-500/50" : "border-white/10")}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold">{plan.name}</h3>
                    {plan.is_popular && <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">Popular</span>}
                    <span className={plan.is_active ? "bg-green-900/30 text-green-400 text-xs px-2 py-0.5 rounded-full" : "bg-gray-900/30 text-gray-500 text-xs px-2 py-0.5 rounded-full"}>
                      {plan.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">{plan.description}</p>
                </div>
                <button
                  onClick={() => toggleActive(plan.id, plan.is_active)}
                  className={"relative w-10 h-5 rounded-full transition-colors " + (plan.is_active ? "bg-purple-600" : "bg-white/20")}
                >
                  <div className={"absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all " + (plan.is_active ? "left-5" : "left-0.5")} />
                </button>
              </div>
              <div className="flex items-center gap-4 mb-3">
                <div>
                  <div className="text-xl font-extrabold">${plan.price_monthly}<span className="text-gray-500 text-xs">/mo</span></div>
                  <div className="text-gray-500 text-xs">${plan.price_yearly}/mo yearly</div>
                </div>
                <div className="bg-purple-900/30 border border-purple-500/20 rounded-xl px-3 py-1.5">
                  <div className="text-purple-400 font-bold text-sm">?? {plan.tokens_per_month}</div>
                  <div className="text-gray-500 text-xs">tokens/month</div>
                </div>
              </div>
              {Array.isArray(plan.features) && plan.features.length > 0 && (
                <div className="space-y-1 mb-4">
                  {plan.features.map((feature: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="text-green-400">?</span> {feature}
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => deletePlan(plan.id)} className="text-red-400 hover:text-red-300 text-xs transition">
                Delete Plan
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
