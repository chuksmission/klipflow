"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminBlog() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    html_body: "",
    featured_image: "",
    status: "draft",
    meta_title: "",
    meta_description: "",
    meta_keywords: "",
  });

  useEffect(() => {
    const fetchPosts = async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("*")
        .order("created_at", { ascending: false });
      setPosts(data || []);
      setLoading(false);
    };
    fetchPosts();
  }, []);

  const generateSlug = (title: string) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  };

  const handleCreate = async () => {
    if (!form.title) return;
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase
      .from("blog_posts")
      .insert({
        title: form.title,
        slug: form.slug || generateSlug(form.title),
        excerpt: form.excerpt,
        html_body: form.html_body,
        featured_image: form.featured_image,
        status: form.status,
        meta_title: form.meta_title || form.title,
        meta_description: form.meta_description,
        meta_keywords: form.meta_keywords,
        author_id: session?.user.id,
        published_at: form.status === "published" ? new Date().toISOString() : null,
      })
      .select()
      .single();
    if (data) setPosts([data, ...posts]);
    setForm({ title: "", slug: "", excerpt: "", html_body: "", featured_image: "", status: "draft", meta_title: "", meta_description: "", meta_keywords: "" });
    setShowForm(false);
    setSaving(false);
  };

  const toggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === "published" ? "draft" : "published";
    await supabase.from("blog_posts").update({ status: newStatus, published_at: newStatus === "published" ? new Date().toISOString() : null }).eq("id", id);
    setPosts(posts.map((p) => p.id === id ? { ...p, status: newStatus } : p));
  };

  const deletePost = async (id: number) => {
    await supabase.from("blog_posts").delete().eq("id", id);
    setPosts(posts.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold mb-1">Blog / CMS</h1>
          <p className="text-gray-400 text-sm">{posts.length} posts</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-xl transition text-sm"
        >
          + New Post
        </button>
      </div>

      {showForm && (
        <div className="bg-white/5 border border-purple-500/30 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-lg">Add New Blog Post</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-gray-400 text-xs mb-1 block">Featured Image URL</label>
              <input type="text" value={form.featured_image} onChange={(e) => setForm({ ...form, featured_image: e.target.value })} placeholder="https://example.com/image.jpg" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Title</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: generateSlug(e.target.value) })} placeholder="Post title" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Slug</label>
              <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="post-url-slug" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Excerpt</label>
              <input type="text" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} placeholder="Short description" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="text-gray-400 text-xs mb-1 block">HTML Body</label>
              <textarea value={form.html_body} onChange={(e) => setForm({ ...form, html_body: e.target.value })} placeholder="<h2>Your content here...</h2>" rows={8} className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-xs font-mono resize-none" />
            </div>
          </div>
          <div className="border-t border-white/10 pt-4">
            <h4 className="font-bold text-sm mb-3">SEO & Meta Tags</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Meta Title <span className="text-gray-600">({form.meta_title.length}/60)</span></label>
                <input type="text" value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} maxLength={60} placeholder="SEO title" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Meta Keywords</label>
                <input type="text" value={form.meta_keywords} onChange={(e) => setForm({ ...form, meta_keywords: e.target.value })} placeholder="keyword1, keyword2, keyword3" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="text-gray-400 text-xs mb-1 block">Meta Description <span className="text-gray-600">({form.meta_description.length}/160)</span></label>
                <textarea value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} maxLength={160} placeholder="SEO description" rows={2} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm resize-none" />
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving || !form.title} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition text-sm">
              {saving ? "Creating..." : "Create Post"}
            </button>
            <button onClick={() => setShowForm(false)} className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl transition text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : posts.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">??</div>
          <h3 className="font-bold text-lg mb-2">No posts yet</h3>
          <p className="text-gray-400 text-sm">Create your first blog post to start driving organic traffic.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div key={post.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-sm truncate">{post.title}</h3>
                  <span className={"text-xs px-2 py-0.5 rounded-full " + (post.status === "published" ? "bg-green-900/30 text-green-400" : "bg-gray-900/30 text-gray-500")}>
                    {post.status}
                  </span>
                </div>
                <p className="text-gray-500 text-xs truncate">{post.excerpt}</p>
                <p className="text-gray-600 text-xs mt-1">/{post.slug} · {new Date(post.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggleStatus(post.id, post.status)} className="text-purple-400 hover:text-white text-xs transition">
                  {post.status === "published" ? "Unpublish" : "Publish"}
                </button>
                <button onClick={() => deletePost(post.id)} className="text-red-400 hover:text-red-300 text-xs transition">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
