"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";

const SITE_URL = "https://klipflowai.com";

type EditorMode = "rich" | "html";

function richToHtml(text: string): string {
  return text
    .split("\n\n")
    .map((para) => {
      if (para.startsWith("# ")) return `<h1>${para.slice(2)}</h1>`;
      if (para.startsWith("## ")) return `<h2>${para.slice(3)}</h2>`;
      if (para.startsWith("### ")) return `<h3>${para.slice(4)}</h3>`;
      if (para.startsWith("- ")) {
        const items = para.split("\n").map((l) => `<li>${l.slice(2)}</li>`).join("");
        return `<ul>${items}</ul>`;
      }
      if (/^\d+\. /.test(para)) {
        const items = para.split("\n").map((l) => `<li>${l.replace(/^\d+\. /, "")}</li>`).join("");
        return `<ol>${items}</ol>`;
      }
      if (para.startsWith("<img")) return para;
      return `<p>${para.replace(/\n/g, " ")}</p>`;
    })
    .join("\n");
}

function htmlToRich(html: string): string {
  return html
    .replace(/<h1>(.*?)<\/h1>/g, "# $1")
    .replace(/<h2>(.*?)<\/h2>/g, "## $1")
    .replace(/<h3>(.*?)<\/h3>/g, "### $1")
    .replace(/<li>(.*?)<\/li>/g, "- $1")
    .replace(/<\/?ul>/g, "")
    .replace(/<\/?ol>/g, "")
    .replace(/<p>(.*?)<\/p>/g, "$1")
    .replace(/<strong>(.*?)<\/strong>/g, "**$1**")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function AdminBlog() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [editorMode, setEditorMode] = useState<EditorMode>("rich");
  const [richText, setRichText] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [editRichText, setEditRichText] = useState("");
  const [editEditorMode, setEditEditorMode] = useState<EditorMode>("html");
  const [editImagePreview, setEditImagePreview] = useState("");
  const [updating, setUpdating] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const editBodyImageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyImageInputRef = useRef<HTMLInputElement>(null);

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

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleEditorModeSwitch = (mode: EditorMode) => {
    if (mode === "html" && editorMode === "rich") {
      setForm({ ...form, html_body: richToHtml(richText) });
    }
    if (mode === "rich" && editorMode === "html") {
      setRichText(htmlToRich(form.html_body));
    }
    setEditorMode(mode);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Please upload an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5MB."); return; }

    setImageUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `blog-${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage
        .from("blog-images")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("blog-images").getPublicUrl(fileName);
      setForm({ ...form, featured_image: publicUrl });
      setImagePreview(publicUrl);
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setImageUploading(false);
    }
  };

  const handleBodyImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Please upload an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5MB."); return; }
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `blog-body-${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage
        .from("blog-images")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("blog-images").getPublicUrl(fileName);
      setRichText(prev => prev + `\n\n<img src="${publicUrl}" alt="Image" style="width:100%;border-radius:12px;margin:16px 0;" />\n\n`);
    } catch (err: any) {
      alert("Image upload failed: " + err.message);
    } finally {
      if (bodyImageInputRef.current) bodyImageInputRef.current.value = "";
    }
  };

  const handleUrlInput = (url: string) => {
    setForm({ ...form, featured_image: url });
    setImagePreview(url);
  };

  const clearImage = () => {
    setForm({ ...form, featured_image: "" });
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreate = async () => {
    if (!form.title) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { alert("Not logged in. Please refresh and try again."); setSaving(false); return; }

      const finalHtml = editorMode === "rich" ? richToHtml(richText) : form.html_body;

      const insertData = {
        title: form.title,
        slug: form.slug || generateSlug(form.title),
        excerpt: form.excerpt || null,
        html_body: finalHtml || null,
        featured_image: form.featured_image || null,
        status: form.status,
        meta_title: form.meta_title || form.title,
        meta_description: form.meta_description || null,
        meta_keywords: form.meta_keywords || null,
        author_id: session.user.id,
        published_at: form.status === "published" ? new Date().toISOString() : null,
      };

      const { data, error } = await supabase
        .from("blog_posts")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        alert("Error saving post: " + error.message + "\n\nCode: " + error.code);
        setSaving(false);
        return;
      }

      if (data) {
        setPosts([data, ...posts]);
        setForm({ title: "", slug: "", excerpt: "", html_body: "", featured_image: "", status: "draft", meta_title: "", meta_description: "", meta_keywords: "" });
        setRichText("");
        setImagePreview("");
        setEditorMode("rich");
        setShowForm(false);
      }
    } catch (err: any) {
      alert("Unexpected error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === "published" ? "draft" : "published";
    await supabase.from("blog_posts").update({
      status: newStatus,
      published_at: newStatus === "published" ? new Date().toISOString() : null
    }).eq("id", id);
    setPosts(posts.map((p) => p.id === id ? { ...p, status: newStatus } : p));
  };

  const deletePost = async (id: number) => {
    if (!confirm("Delete this post?")) return;
    await supabase.from("blog_posts").delete().eq("id", id);
    setPosts(posts.filter((p) => p.id !== id));
  };

  const openEdit = (post: any) => {
    setEditingPost({ ...post });
    setEditImagePreview(post.featured_image || "");
    setEditEditorMode("html");
    setEditRichText(htmlToRich(post.html_body || ""));
  };

  const handleEditImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Please upload an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5MB."); return; }
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `blog-${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from("blog-images").upload(fileName, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("blog-images").getPublicUrl(fileName);
      setEditingPost({ ...editingPost, featured_image: publicUrl });
      setEditImagePreview(publicUrl);
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      if (editFileInputRef.current) editFileInputRef.current.value = "";
    }
  };

  const handleEditBodyImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Please upload an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5MB."); return; }
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `blog-body-${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from("blog-images").upload(fileName, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("blog-images").getPublicUrl(fileName);
      if (editEditorMode === "rich") {
        setEditRichText(prev => prev + `\n\n<img src="${publicUrl}" alt="Image" style="width:100%;border-radius:12px;margin:16px 0;" />\n\n`);
      } else {
        setEditingPost({ ...editingPost, html_body: (editingPost.html_body || "") + `\n<img src="${publicUrl}" alt="Image" style="width:100%;border-radius:12px;margin:16px 0;" />\n` });
      }
    } catch (err: any) {
      alert("Image upload failed: " + err.message);
    } finally {
      if (editBodyImageInputRef.current) editBodyImageInputRef.current.value = "";
    }
  };

  const handleUpdate = async () => {
    if (!editingPost?.title) return;
    setUpdating(true);
    try {
      const finalHtml = editEditorMode === "rich" ? richToHtml(editRichText) : editingPost.html_body;
      const { data, error } = await supabase
        .from("blog_posts")
        .update({
          title: editingPost.title,
          slug: editingPost.slug,
          excerpt: editingPost.excerpt || null,
          html_body: finalHtml || null,
          featured_image: editingPost.featured_image || null,
          status: editingPost.status,
          meta_title: editingPost.meta_title || editingPost.title,
          meta_description: editingPost.meta_description || null,
          meta_keywords: editingPost.meta_keywords || null,
          published_at: editingPost.status === "published" ? (editingPost.published_at || new Date().toISOString()) : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingPost.id)
        .select()
        .single();

      if (error) { alert("Error updating post: " + error.message); setUpdating(false); return; }
      if (data) {
        setPosts(posts.map((p) => p.id === data.id ? data : p));
        setEditingPost(null);
        setEditImagePreview("");
      }
    } catch (err: any) {
      alert("Unexpected error: " + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const copyUrl = (slug: string, id: number) => {
    navigator.clipboard.writeText(`${SITE_URL}/blog/${slug}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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

      {/* EDIT MODAL */}
      {editingPost && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="bg-gray-900 border border-purple-500/30 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">Edit Post</h3>
                <button onClick={() => setEditingPost(null)} className="text-gray-400 hover:text-white text-sm transition">✕ Close</button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Featured Image */}
                <div className="md:col-span-2">
                  <label className="text-gray-400 text-xs mb-2 block">Featured Image</label>
                  {editImagePreview ? (
                    <div className="relative w-full h-48 rounded-xl overflow-hidden border border-white/20 mb-2">
                      <img src={editImagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <button onClick={() => { setEditingPost({ ...editingPost, featured_image: "" }); setEditImagePreview(""); }} className="absolute top-2 right-2 bg-black/70 hover:bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full transition">✕ Remove</button>
                    </div>
                  ) : (
                    <div onClick={() => editFileInputRef.current?.click()} className="w-full h-24 border-2 border-dashed border-white/20 hover:border-purple-500/60 rounded-xl flex flex-col items-center justify-center cursor-pointer transition mb-2">
                      <div className="text-2xl mb-1">🖼️</div>
                      <div className="text-white text-xs font-semibold">Click to upload image</div>
                    </div>
                  )}
                  <input ref={editFileInputRef} type="file" accept="image/*" onChange={handleEditImageUpload} className="hidden" />
                  <input
                    type="text"
                    value={editingPost.featured_image || ""}
                    onChange={(e) => { setEditingPost({ ...editingPost, featured_image: e.target.value }); setEditImagePreview(e.target.value); }}
                    placeholder="or paste image URL"
                    className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm"
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Title</label>
                  <input type="text" value={editingPost.title} onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Slug</label>
                  <input type="text" value={editingPost.slug} onChange={(e) => setEditingPost({ ...editingPost, slug: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Status</label>
                  <select value={editingPost.status} onChange={(e) => setEditingPost({ ...editingPost, status: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Excerpt</label>
                  <input type="text" value={editingPost.excerpt || ""} onChange={(e) => setEditingPost({ ...editingPost, excerpt: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm" />
                </div>

                {/* Editor */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-gray-400 text-xs">Content</label>
                    <div className="bg-white/10 rounded-lg p-0.5 flex">
                      <button onClick={() => { setEditEditorMode("rich"); setEditRichText(htmlToRich(editingPost.html_body || "")); }} className={`px-3 py-1 rounded-md text-xs font-semibold transition ${editEditorMode === "rich" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"}`}>✏️ Rich Text</button>
                      <button onClick={() => { setEditEditorMode("html"); setEditingPost({ ...editingPost, html_body: richToHtml(editRichText) }); }} className={`px-3 py-1 rounded-md text-xs font-semibold transition ${editEditorMode === "html" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"}`}>{"</>"} HTML</button>
                    </div>
                  </div>

                  {editEditorMode === "rich" ? (
                    <div>
                      <div className="bg-white/5 border border-white/10 rounded-t-xl px-3 py-2 flex gap-2 flex-wrap">
                        {[
                          { label: "H2", action: () => setEditRichText(editRichText + "\n\n## ") },
                          { label: "H3", action: () => setEditRichText(editRichText + "\n\n### ") },
                          { label: "B", action: () => setEditRichText(editRichText + "**bold**") },
                          { label: "• List", action: () => setEditRichText(editRichText + "\n\n- Item 1\n- Item 2\n- Item 3") },
                          { label: "1. List", action: () => setEditRichText(editRichText + "\n\n1. Item 1\n2. Item 2\n3. Item 3") },
                          { label: "¶ Para", action: () => setEditRichText(editRichText + "\n\n") },
                          { label: "🖼 Image", action: () => editBodyImageInputRef.current?.click() },
                        ].map((btn, i) => (
                          <button key={i} onClick={btn.action} className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-2 py-1 rounded transition">{btn.label}</button>
                        ))}
                      </div>
                      <textarea value={editRichText} onChange={(e) => setEditRichText(e.target.value)} rows={12} className="w-full bg-black/40 border border-white/10 border-t-0 rounded-b-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition text-sm resize-none" />
                    </div>
                  ) : (
                    <div>
                      <div className="bg-white/5 border border-white/10 rounded-t-xl px-3 py-2 flex gap-2">
                        <button onClick={() => editBodyImageInputRef.current?.click()} className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-2 py-1 rounded transition">🖼 Image</button>
                      </div>
                      <textarea value={editingPost.html_body || ""} onChange={(e) => setEditingPost({ ...editingPost, html_body: e.target.value })} rows={12} className="w-full bg-black/40 border border-white/10 border-t-0 rounded-b-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition text-xs font-mono resize-none" />
                    </div>
                  )}
                  <input ref={editBodyImageInputRef} type="file" accept="image/*" onChange={handleEditBodyImageUpload} className="hidden" />
                </div>
              </div>

              {/* SEO */}
              <div className="border-t border-white/10 pt-4">
                <h4 className="font-bold text-sm mb-3">SEO & Meta Tags</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Meta Title</label>
                    <input type="text" value={editingPost.meta_title || ""} onChange={(e) => setEditingPost({ ...editingPost, meta_title: e.target.value })} maxLength={60} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Meta Keywords</label>
                    <input type="text" value={editingPost.meta_keywords || ""} onChange={(e) => setEditingPost({ ...editingPost, meta_keywords: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-gray-400 text-xs mb-1 block">Meta Description</label>
                    <textarea value={editingPost.meta_description || ""} onChange={(e) => setEditingPost({ ...editingPost, meta_description: e.target.value })} maxLength={160} rows={2} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm resize-none" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={handleUpdate} disabled={updating} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition text-sm">
                  {updating ? "Saving..." : "Save Changes"}
                </button>
                <button onClick={() => setEditingPost(null)} className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl transition text-sm">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white/5 border border-purple-500/30 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-lg">Add New Blog Post</h3>
          <div className="grid md:grid-cols-2 gap-4">

            {/* FEATURED IMAGE */}
            <div className="md:col-span-2">
              <label className="text-gray-400 text-xs mb-2 block">Featured Image</label>
              {imagePreview ? (
                <div className="relative w-full h-48 rounded-xl overflow-hidden border border-white/20 mb-2">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button onClick={clearImage} className="absolute top-2 right-2 bg-black/70 hover:bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full transition">
                    ✕ Remove
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-36 border-2 border-dashed border-white/20 hover:border-purple-500/60 rounded-xl flex flex-col items-center justify-center cursor-pointer transition mb-2 group"
                >
                  {imageUploading ? (
                    <div className="text-purple-400 text-sm font-semibold animate-pulse">Uploading...</div>
                  ) : (
                    <>
                      <div className="text-3xl mb-2 group-hover:scale-110 transition">🖼️</div>
                      <div className="text-white text-sm font-semibold">Click to upload image</div>
                      <div className="text-gray-500 text-xs mt-1">JPG, PNG, WebP — max 5MB</div>
                    </>
                  )}
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              <input ref={bodyImageInputRef} type="file" accept="image/*" onChange={handleBodyImageUpload} className="hidden" />
              <div className="flex items-center gap-3 mt-2">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-gray-600 text-xs">or paste image URL</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <input
                type="text"
                value={form.featured_image.startsWith("http") && !imagePreview.includes("supabase") ? form.featured_image : ""}
                onChange={(e) => handleUrlInput(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm"
              />
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

            {/* EDITOR — Rich Text / HTML Toggle */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-gray-400 text-xs">Content</label>
                <div className="bg-white/10 rounded-lg p-0.5 flex">
                  <button
                    onClick={() => handleEditorModeSwitch("rich")}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition ${editorMode === "rich" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"}`}
                  >
                    ✏️ Rich Text
                  </button>
                  <button
                    onClick={() => handleEditorModeSwitch("html")}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition ${editorMode === "html" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"}`}
                  >
                    {"</>"}  HTML
                  </button>
                </div>
              </div>

              {editorMode === "rich" ? (
                <div>
                  <div className="bg-white/5 border border-white/10 rounded-t-xl px-3 py-2 flex gap-2 flex-wrap">
                    {[
                      { label: "H2", action: () => setRichText(richText + "\n\n## ") },
                      { label: "H3", action: () => setRichText(richText + "\n\n### ") },
                      { label: "B", action: () => setRichText(richText + "**bold**") },
                      { label: "• List", action: () => setRichText(richText + "\n\n- Item 1\n- Item 2\n- Item 3") },
                      { label: "1. List", action: () => setRichText(richText + "\n\n1. Item 1\n2. Item 2\n3. Item 3") },
                      { label: "¶ Para", action: () => setRichText(richText + "\n\n") },
                    { label: "🖼 Image", action: () => bodyImageInputRef.current?.click() },
                    ].map((btn, i) => (
                      <button key={i} onClick={btn.action} className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-2 py-1 rounded transition">
                        {btn.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={richText}
                    onChange={(e) => setRichText(e.target.value)}
                    placeholder={"## Your heading\n\nWrite your paragraph here...\n\n## Another section\n\n- Bullet point 1\n- Bullet point 2"}
                    rows={12}
                    className="w-full bg-black/40 border border-white/10 border-t-0 rounded-b-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm resize-none"
                  />
                  <p className="text-gray-600 text-xs mt-1">Use ## for headings, - for bullets, **text** for bold, blank line between paragraphs</p>
                </div>
              ) : (
                <textarea
                  value={form.html_body}
                  onChange={(e) => setForm({ ...form, html_body: e.target.value })}
                  placeholder="<h2>Your heading</h2>&#10;<p>Your paragraph...</p>"
                  rows={12}
                  className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-xs font-mono resize-none"
                />
              )}
            </div>
          </div>

          {/* SEO */}
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
            <button onClick={() => { setShowForm(false); clearImage(); setRichText(""); setEditorMode("rich"); }} className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl transition text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : posts.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">📝</div>
          <h3 className="font-bold text-lg mb-2">No posts yet</h3>
          <p className="text-gray-400 text-sm">Create your first blog post to start driving organic traffic.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div key={post.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {post.featured_image && (
                  <img src={post.featured_image} alt={post.title} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-sm truncate">{post.title}</h3>
                    <span className={"text-xs px-2 py-0.5 rounded-full " + (post.status === "published" ? "bg-green-900/30 text-green-400" : "bg-gray-900/30 text-gray-500")}>
                      {post.status}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs truncate">{post.excerpt}</p>
                  <p className="text-gray-600 text-xs mt-1">
                    /blog/{post.slug} · {new Date(post.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => openEdit(post)} className="text-blue-400 hover:text-white text-xs transition">
                  Edit
                </button>
                {post.status === "published" && (
                  <button
                    onClick={() => copyUrl(post.slug, post.id)}
                    className="text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition font-semibold"
                  >
                    {copiedId === post.id ? "✓ Copied!" : "🔗 Copy URL"}
                  </button>
                )}
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