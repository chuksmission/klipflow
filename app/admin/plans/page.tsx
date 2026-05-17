"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminPlans() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [updating, setUpdating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price_monthly: "",
    price_yearly: "",
    tokens_per_month: "",
    stripe_price_id_monthly: "",
    stripe_price_id_yearly: "",
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
        stripe_price_id_monthly: form.stripe_price_id_monthly || null,
        stripe_price_id_yearly: form.stripe_price_id_yearly || null,
        is_popular: form.is_popular,
        is_active: form.is_active,
        features: features,
        sort_order: plans.length + 1,
      })
      .select()
      .single();
    if (data) setPlans([...plans, data]);
    setForm({ name: "", description: "", price_monthly: "", price_yearly: "", tokens_per_month: "", stripe_price_id_monthly: "", stripe_price_id_yearly: "", is_popular: false, is_active: true, features: "" });
    setShowForm(false);
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!editingPlan) return;
    setUpdating(true);
    const features = typeof editingPlan.features === "string"
      ? editingPlan.features.split("\n").filter((f: string) => f.trim())
      : editingPlan.features;
    const { data } = await supabase
      .from("plans")
      .update({
        name: editingPlan.name,
        description: editingPlan.description,
        price_monthly: parseFloat(editingPlan.price_monthly) || 0,
        price_yearly: parseFloat(editingPlan.price_yearly) || 0,
        tokens_per_month: parseInt(editingPlan.tokens_per_month) || 0,
        stripe_price_id_monthly: editingPlan.stripe_price_id_monthly || null,
        stripe_price_id_yearly: editingPlan.stripe_price_id_yearly || null,
        is_popular: editingPlan.is_popular,
        is_active: editingPlan.is_active,
        features: features,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingPlan.id)
      .select()
      .single();
    if (data) setPlans(plans.map((p) => p.id === data.id ? data : p));
    setEditingPlan(null);
    setUpdating(false);
  };

  const toggleActive = async (id: number, current: boolean) => {
    await supabase.from("plans").update({ is_active: !current }).eq("id", id);
    setPlans(plans.map((p) => p.id === id ? { ...p, is_active: !current } : p));
  };

  const deletePlan = async (id: number) => {
    if (!confirm("Delete this plan?")) return;
    await supabase.from("plans").delete().eq("id", id);
    setPlans(plans.filter((p) => p.id !== id));
  };

  const openEdit = (plan: any) => {
    setEditingPlan({
      ...plan,
      features: Array.isArray(plan.features) ? plan.features.join("\n") : plan.features || "",
    });
  };

  const formFields = (data: any, setData: any) => (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <label className="text-gray-400 text-xs mb-1 block">Plan Name</label>
        <input type="text" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} placeholder="Creator Pro" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
      </div>
      <div>
        <label className="text-gray-400 text-xs mb-1 block">Description</label>
        <input type="text" value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} placeholder="For serious content creators" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
      </div>
      <div>
        <label className="text-gray-400 text-xs mb-1 block">Monthly Price ($)</label>
        <input type="number" value={data.price_monthly} onChange={(e) => setData({ ...data, price_monthly: e.target.value })} placeholder="29" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
      </div>
      <div>
        <label className="text-gray-400 text-xs mb-1 block">Yearly Price ($)</label>
        <input type="number" value={data.price_yearly} onChange={(e) => setData({ ...data, price_yearly: e.target.value })} placeholder="23" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
      </div>
      <div>
        <label className="text-gray-400 text-xs mb-1 block">Tokens Per Month</label>
        <input type="number" value={data.tokens_per_month} onChange={(e) => setData({ ...data, tokens_per_month: e.target.value })} placeholder="250" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
      </div>
      <div className="flex items-center gap-4 pt-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setData({ ...data, is_popular: !data.is_popular })} className={"relative w-10 h-5 rounded-full transition-colors " + (data.is_popular ? "bg-purple-600" : "bg-white/20")}>
            <div className={"absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all " + (data.is_popular ? "left-5" : "left-0.5")} />
          </button>
          <span className="text-gray-400 text-xs">Mark as Popular</span>
        </div>
      </div>

      {/* Stripe Price IDs */}
      <div className="md:col-span-2 border-t border-white/10 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-purple-400 text-xs font-bold uppercase tracking-widest">Stripe Price IDs</span>
          <span className="text-gray-600 text-xs">— from your Stripe dashboard → Product catalog</span>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Monthly Price ID</label>
            <input type="text" value={data.stripe_price_id_monthly || ""} onChange={(e) => setData({ ...data, stripe_price_id_monthly: e.target.value })} placeholder="price_1abc..." className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm font-mono" />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Yearly Price ID</label>
            <input type="text" value={data.stripe_price_id_yearly || ""} onChange={(e) => setData({ ...data, stripe_price_id_yearly: e.target.value })} placeholder="price_1xyz..." className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm font-mono" />
          </div>
        </div>
      </div>

      <div className="md:col-span-2">
        <label className="text-gray-400 text-xs mb-1 block">Features (one per line)</label>
        <textarea value={data.features} onChange={(e) => setData({ ...data, features: e.target.value })} placeholder={"250 tokens/month\nAll AI models\nVideo Studio\nAd Spy"} rows={5} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm resize-none" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold mb-1">Plans</h1>
          <p className="text-gray-400 text-sm">Manage subscription plans and pricing</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-xl transition text-sm">
          + New Plan
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white/5 border border-purple-500/30 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-lg">Create New Plan</h3>
          {formFields(form, setForm)}
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving || !form.name} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition text-sm">
              {saving ? "Creating..." : "Create Plan"}
            </button>
            <button onClick={() => setShowForm(false)} className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl transition text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingPlan && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-8">
            <div className="bg-gray-900 border border-purple-500/30 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">Edit Plan — {editingPlan.name}</h3>
                <button onClick={() => setEditingPlan(null)} className="text-gray-400 hover:text-white text-sm">✕ Close</button>
              </div>
              {formFields(editingPlan, setEditingPlan)}
              <div className="flex gap-3">
                <button onClick={handleUpdate} disabled={updating} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition text-sm">
                  {updating ? "Saving..." : "Save Changes"}
                </button>
                <button onClick={() => setEditingPlan(null)} className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl transition text-sm">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plans List */}
      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : plans.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">💳</div>
          <h3 className="font-bold text-lg mb-2">No plans yet</h3>
          <p className="text-gray-400 text-sm">Create your first plan to start accepting subscriptions.</p>
        </div>
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
                <button onClick={() => toggleActive(plan.id, plan.is_active)} className={"relative w-10 h-5 rounded-full transition-colors " + (plan.is_active ? "bg-purple-600" : "bg-white/20")}>
                  <div className={"absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all " + (plan.is_active ? "left-5" : "left-0.5")} />
                </button>
              </div>
              <div className="flex items-center gap-4 mb-3">
                <div>
                  <div className="text-xl font-extrabold">${plan.price_monthly}<span className="text-gray-500 text-xs">/mo</span></div>
                  <div className="text-gray-500 text-xs">${plan.price_yearly}/mo yearly</div>
                </div>
                <div className="bg-purple-900/30 border border-purple-500/20 rounded-xl px-3 py-1.5">
                  <div className="text-purple-400 font-bold text-sm">{plan.tokens_per_month}</div>
                  <div className="text-gray-500 text-xs">tokens/month</div>
                </div>
              </div>

              {/* Stripe Price IDs status */}
              <div className="flex gap-2 mb-3">
                <span className={"text-xs px-2 py-0.5 rounded-full " + (plan.stripe_price_id_monthly ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400")}>
                  {plan.stripe_price_id_monthly ? "✓ Monthly Stripe" : "✗ No Monthly Stripe ID"}
                </span>
                <span className={"text-xs px-2 py-0.5 rounded-full " + (plan.stripe_price_id_yearly ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400")}>
                  {plan.stripe_price_id_yearly ? "✓ Yearly Stripe" : "✗ No Yearly Stripe ID"}
                </span>
              </div>

              {Array.isArray(plan.features) && plan.features.length > 0 && (
                <div className="space-y-1 mb-4">
                  {plan.features.map((feature: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="text-green-400">✓</span> {feature}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <button onClick={() => openEdit(plan)} className="text-purple-400 hover:text-white text-xs transition">Edit</button>
                <button onClick={() => deletePlan(plan.id)} className="text-red-400 hover:text-red-300 text-xs transition">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}