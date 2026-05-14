"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminVideoTemplates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    video_url: "",
    thumbnail_url: "",
    category: "",
  });

  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await supabase
        .from("video_templates")
        .select("*")
        .order("created_at", { ascending: false });
      setTemplates(data || []);
      setLoading(false);
    };
    fetchTemplates();
  }, []);

  const handleCreate = async () => {
    if (!form.video_url) return;
    setSaving(true);
    const { data } = await supabase
      .from("video_templates")
      .insert({ title: form.title, video_url: form.video_url, thumbnail_url: form.thumbnail_url, category: form.category, is_active: true })
      .select()
      .single();
    if (data) setTemplates([data, ...templates]);
    setForm({ title: "", video_url: "", thumbnail_url: "", category: "" });
    setShowForm(false);
    setSaving(false);
  };

  const deleteTemplate = async (id: number) => {
    await supabase.from("video_templates").delete().eq("id", id);
    setTemplates(templates.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold mb-1">Video Templates</h1>
          <p className="text-gray-400 text-sm">{templates.length} videos  shown to users as inspiration</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-xl transition text-sm">
          + Add Video
        </button>
      </div>

      {showForm && (
        <div className="bg-white/5 border border-purple-500/30 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold">Add Video Template</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Title</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Luxury Fashion" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Category</label>
              <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Fashion, Travel, Nature..." className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="text-gray-400 text-xs mb-1 block">Video URL</label>
              <input type="url" value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} placeholder="https://example.com/video.mp4" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="text-gray-400 text-xs mb-1 block">Thumbnail URL (optional)</label>
              <input type="url" value={form.thumbnail_url} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} placeholder="https://example.com/thumbnail.jpg" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving || !form.video_url} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition text-sm">
              {saving ? "Adding..." : "Add Video"}
            </button>
            <button onClick={() => setShowForm(false)} className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl transition text-sm">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : templates.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">??</div>
          <h3 className="font-bold text-lg mb-2">No video templates yet</h3>
          <p className="text-gray-400 text-sm">Add reference videos that users can use as inspiration.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div key={template.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <video src={template.video_url} className="w-full aspect-video object-cover" muted playsInline />
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-xs">{template.title}</p>
                    <p className="text-gray-500 text-xs">{template.category}</p>
                  </div>
                  <button onClick={() => deleteTemplate(template.id)} className="text-red-400 hover:text-red-300 text-xs transition">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
