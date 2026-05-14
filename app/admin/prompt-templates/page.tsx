"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminPromptTemplates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    title: "",
    prompt: "",
    category: "text_to_video",
  });

  const categories = [
    "text_to_video",
    "image_to_video",
    "ai_actor",
    "ugc",
    "script_writer",
    "prompt_expander",
  ];

  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await supabase
        .from("prompt_templates")
        .select("*")
        .order("created_at", { ascending: false });
      setTemplates(data || []);
      setLoading(false);
    };
    fetchTemplates();
  }, []);

  const handleCreate = async () => {
    if (!form.prompt) return;
    setSaving(true);
    const { data } = await supabase
      .from("prompt_templates")
      .insert({ title: form.title, prompt: form.prompt, category: form.category, is_active: true })
      .select()
      .single();
    if (data) setTemplates([data, ...templates]);
    setForm({ title: "", prompt: "", category: "text_to_video" });
    setShowForm(false);
    setSaving(false);
  };

  const deleteTemplate = async (id: number) => {
    await supabase.from("prompt_templates").delete().eq("id", id);
    setTemplates(templates.filter((t) => t.id !== id));
  };

  const filtered = templates.filter((t) =>
    t.prompt?.toLowerCase().includes(search.toLowerCase()) ||
    t.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold mb-1">Prompt Templates</h1>
          <p className="text-gray-400 text-sm">{templates.length} templates  shown to users in Video Studio</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-xl transition text-sm">
          + Add Template
        </button>
      </div>

      {showForm && (
        <div className="bg-white/5 border border-purple-500/30 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold">Add Prompt Template</h3>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Title (optional)</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Luxury product showcase" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm">
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Prompt</label>
            <textarea value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} placeholder="A luxury watch rotating slowly on a marble surface, golden hour lighting, cinematic 4K..." rows={4} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm resize-none" />
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving || !form.prompt} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition text-sm">
              {saving ? "Adding..." : "Add Template"}
            </button>
            <button onClick={() => setShowForm(false)} className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl transition text-sm">Cancel</button>
          </div>
        </div>
      )}

      <input type="text" placeholder="Search templates..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm" />

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">?</div>
          <h3 className="font-bold text-lg mb-2">No templates yet</h3>
          <p className="text-gray-400 text-sm">Add prompt templates that users can select in Video Studio.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((template) => (
            <div key={template.id} className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  {template.title && <h3 className="font-bold text-sm mb-0.5">{template.title}</h3>}
                  <span className="bg-purple-900/30 text-purple-400 text-xs px-2 py-0.5 rounded-full">
                    {template.category?.replace(/_/g, " ")}
                  </span>
                </div>
                <button onClick={() => deleteTemplate(template.id)} className="text-red-400 hover:text-red-300 text-xs transition shrink-0">Delete</button>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed">{template.prompt}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
