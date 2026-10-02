"use client";
import { useState, useEffect } from "react";
import { Check, Copy, ExternalLink, Star } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { SHOWCASE_CATEGORIES } from "../../components/catalog";

export default function AdminGenerations() {
  const [generations, setGenerations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchGenerations = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/generations", {
        headers: { Authorization: "Bearer " + session.access_token },
      });
      const data = await res.json();
      setGenerations(data.generations || []);
      setLoading(false);
    };
    fetchGenerations();
  }, []);

  const filtered = generations.filter((g) =>
    (!featuredOnly || g.is_featured) &&
    (g.prompt?.toLowerCase().includes(search.toLowerCase()) ||
     g.type?.toLowerCase().includes(search.toLowerCase()))
  );
  const featuredCount = generations.filter((g) => g.is_featured).length;

  const copyPrompt = (prompt: string, index: number) => {
    navigator.clipboard.writeText(prompt);
    setCopiedId(index);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const updateLocal = (id: number | string, patch: Record<string, unknown>) =>
    setGenerations((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));

  const saveFeature = async (gen: any, patch: { is_featured: boolean; featured_category?: string | null; featured_title?: string | null; featured_sort?: number }) => {
    setSavingId(gen.id); setError("");
    const next = {
      is_featured: patch.is_featured,
      featured_category: patch.featured_category ?? gen.featured_category ?? (gen.output_type === "image" ? "image" : "cinematic"),
      featured_title: patch.featured_title ?? gen.featured_title ?? "",
      // undefined (and so not sent) until supabase/showcase_studio.sql adds the column
      featured_sort: patch.featured_sort ?? gen.featured_sort,
    };
    updateLocal(gen.id, next);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/generations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ id: gen.id, ...next }),
      });
      const data = await res.json();
      if (!res.ok) {
        updateLocal(gen.id, { is_featured: gen.is_featured, featured_category: gen.featured_category, featured_title: gen.featured_title });
        setError(data.error?.includes("is_featured") ? "Run supabase/showcase.sql first to add the showcase columns." : (data.error ?? "Couldn't save."));
      }
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Generations</h1>
          <p className="text-ink-muted text-sm">{generations.length} total · {featuredCount} featured on the homepage</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={featuredOnly} onChange={(e) => setFeaturedOnly(e.target.checked)} className="accent-purple-600" />
          Featured only
        </label>
      </div>

      <div className="bg-accent/[0.08] border border-accent/25 rounded-xl p-4 text-sm text-ink">
        Feature your best outputs to show them on the homepage. Visitors can click <span className="text-white font-medium">Use this</span> to open the Studio with the same prompt and model. Only feature content you have the rights to show publicly.
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="bg-surface border border-line rounded-2xl p-4">
        <input
          type="text"
          placeholder="Search by prompt or type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-4 py-2.5 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm mb-4"
        />

        {loading ? (
          <p className="text-center text-ink-subtle py-8 text-sm">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-ink-subtle py-8 text-sm">No generations found</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((gen, i) => (
              <div key={gen.id ?? i} className={"flex flex-col md:flex-row gap-3 p-3 rounded-xl text-sm border " + (gen.is_featured ? "bg-accent/[0.08] border-purple-500/40" : "bg-surface border-transparent")}>
                <div className="w-full md:w-40 aspect-video bg-black/40 rounded-lg overflow-hidden flex-shrink-0">
                  {gen.video_url && (gen.output_type === "image"
                    ? <img src={gen.video_url} alt="" className="w-full h-full object-cover" />
                    : <video src={gen.video_url} muted playsInline preload="metadata" className="w-full h-full object-cover" />)}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-ink text-xs line-clamp-2">{gen.prompt || "No prompt"}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-subtle">
                    <span className="capitalize text-accent-text">{gen.type?.replace(/_/g, " ")}</span>
                    {gen.model && <span>{gen.model}</span>}
                    <span>{gen.tokens_used ?? 0} tokens</span>
                    <span>{new Date(gen.created_at).toLocaleDateString()}</span>
                  </div>
                  {gen.is_featured && (
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={gen.featured_category ?? ""}
                        onChange={(e) => saveFeature(gen, { is_featured: true, featured_category: e.target.value })}
                        className="bg-canvas border border-line hover:border-line-strong rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
                      >
                        {SHOWCASE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                      <input
                        type="text"
                        placeholder="Card title (optional)"
                        defaultValue={gen.featured_title ?? ""}
                        onBlur={(e) => { if (e.target.value !== (gen.featured_title ?? "")) saveFeature(gen, { is_featured: true, featured_title: e.target.value }); }}
                        className="flex-1 min-w-[160px] bg-canvas border border-line hover:border-line-strong rounded-lg px-2 py-1.5 text-white placeholder:text-ink-subtle text-xs focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
                      />
                      {"featured_sort" in gen && (
                        <input
                          type="number"
                          title="Sort order (lower shows first)"
                          aria-label="Sort order"
                          defaultValue={gen.featured_sort ?? 0}
                          onBlur={(e) => { const v = parseInt(e.target.value, 10) || 0; if (v !== (gen.featured_sort ?? 0)) saveFeature(gen, { is_featured: true, featured_sort: v }); }}
                          className="w-20 bg-canvas border border-line hover:border-line-strong rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
                        />
                      )}
                    </div>
                  )}
                </div>
                <div className="flex md:flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => saveFeature(gen, { is_featured: !gen.is_featured })}
                    disabled={savingId === gen.id || !gen.video_url}
                    className={"inline-flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap disabled:opacity-50 " + (gen.is_featured ? "bg-purple-600 text-white hover:bg-purple-700" : "bg-raised text-ink hover:bg-raised-hover")}
                  >
                    <Star size={13} aria-hidden /> {gen.is_featured ? "Featured" : "Feature"}
                  </button>
                  <button
                    onClick={() => copyPrompt(gen.prompt ?? "", i)}
                    className="inline-flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-raised hover:bg-raised-hover text-ink transition font-medium whitespace-nowrap"
                  >
                    {copiedId === i ? <><Check size={13} aria-hidden /> Copied</> : <><Copy size={13} aria-hidden /> Copy prompt</>}
                  </button>
                  {gen.video_url && (
                    <a
                      href={gen.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-raised hover:bg-raised-hover text-ink transition font-medium whitespace-nowrap"
                    >
                      <ExternalLink size={13} aria-hidden /> Open
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
