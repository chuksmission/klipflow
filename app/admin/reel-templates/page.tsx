"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Film, ImagePlus, Loader2, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { resumableUpload } from "../../lib/resumable-upload";
import { CHARACTER_KINDS, REEL_CATEGORIES, type ReelTemplate } from "../../lib/faceless-reels";
import { Alert, Badge, Button, EmptyState, Field, Input, PageHeader, Progress, Select, StatCard, Textarea, Toggle, cardClass } from "../../components/ui";
import { confirmDialog, toast } from "../../components/ui/Toaster";

interface Person { id: string; name: string; image: string | null; created_at: string }
interface Overview {
  templates: ReelTemplate[];
  usage: Record<string, number>;
  episodes: number;
  storylines: Record<string, { total: number; available: number }>;
  uniqueness: { checked: number; limit: number; pairs: { score: number; a: Person; b: Person }[] };
}
interface Storyline { id: string; title: string; logline: string; status: string; assigned_at: string | null }

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const KIND_LABEL: Record<string, string> = { fruit_head: "Fruit heads", object_head: "Object heads", food: "Food characters", animated: "3D animated", mini_adult: "Mini adults", custom: "Custom" };
const ext = (f: File, fallback: string) => f.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || fallback;

async function api<T>(init: { method?: string; body?: unknown }): Promise<{ ok: boolean; data: T & { error?: string } }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, data: { error: "Please sign in again." } as T & { error?: string } };
  const res = await fetch("/api/admin/reel-templates", {
    method: init.method ?? "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
  return { ok: res.ok, data };
}

type Form = Omit<ReelTemplate, "id" | "is_active"> & { id: string | null; is_active: boolean };
const emptyForm = (): Form => ({
  id: null, slug: "", name: "", category: "drama", character_kind: "fruit_head", characters: "", setting: "", style: "", formula: "",
  prompt_guide: "", image_preview_url: null, preview_urls: [], disclaimer: null, cast_size: 2, sort: 0, is_active: true,
});

export default function AdminReelTemplates() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [upload, setUpload] = useState<number | null>(null);
  const [varying, setVarying] = useState<string | null>(null);
  const [pool, setPool] = useState<{ template: ReelTemplate; items: Storyline[] } | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await api<Overview>({ method: "GET" });
    if (r.ok) { setData(r.data); setError(""); } else setError(r.data.error ?? "Couldn't load templates.");
    setLoading(false);
  }, []);
  useEffect(() => {
    api<Overview>({ method: "GET" }).then((r) => {
      if (r.ok) setData(r.data); else setError(r.data.error ?? "Couldn't load templates.");
      setLoading(false);
    });
  }, []);

  const templates = data?.templates ?? [];
  const totalSeries = Object.values(data?.usage ?? {}).reduce((n, v) => n + v, 0);
  const pools = Object.values(data?.storylines ?? {});
  const free = pools.reduce((n, p) => n + p.available, 0);
  const ranked = [...templates].sort((a, b) => (data?.usage[b.id] ?? 0) - (data?.usage[a.id] ?? 0));

  // ---------------------------------------------------------------- uploads

  async function uploadImage(file: File) {
    if (!form) return;
    if (!IMAGE_TYPES.includes(file.type)) { toast("Use a JPG, PNG or WebP image.", "error"); return; }
    if (file.size > 5 * 1024 * 1024) { toast("Images can be up to 5MB.", "error"); return; }
    setUpload(0);
    const path = `reel-templates/preview-${Date.now()}.${ext(file, "jpg")}`;
    const { error: err } = await supabase.storage.from("generation-inputs").upload(path, file, { contentType: file.type, upsert: true });
    setUpload(null);
    if (err) { toast(`Upload failed: ${err.message}`, "error"); return; }
    const url = supabase.storage.from("generation-inputs").getPublicUrl(path).data.publicUrl;
    setForm((f) => f && { ...f, image_preview_url: url });
  }

  async function uploadVideo(file: File) {
    if (!form) return;
    if (!VIDEO_TYPES.includes(file.type)) { toast("Use an MP4, MOV or WebM video.", "error"); return; }
    if ((form.preview_urls ?? []).length >= 6) { toast("Up to 6 sample videos.", "error"); return; }
    setUpload(0);
    try {
      const url = await resumableUpload(file, "generation-inputs", `reel-templates/sample-${Date.now()}.${ext(file, "mp4")}`, (p) => setUpload(Math.round(p * 100)));
      setForm((f) => f && { ...f, preview_urls: [...(f.preview_urls ?? []), url] });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed.", "error");
    } finally {
      setUpload(null);
    }
  }

  // ---------------------------------------------------------------- actions

  async function save() {
    if (!form) return;
    if (!form.name.trim()) { toast("Give the template a name.", "error"); return; }
    setSaving(true);
    const r = await api<{ template: ReelTemplate }>({ body: { action: "save", ...form } });
    setSaving(false);
    if (!r.ok) { toast(r.data.error ?? "Couldn't save.", "error"); return; }
    toast(form.id ? "Template updated." : "Template added.", "success");
    setForm(null);
    void load();
  }

  async function toggle(t: ReelTemplate) {
    const r = await api({ body: { action: "toggle", id: t.id, is_active: !t.is_active } });
    if (r.ok) setData((d) => d && { ...d, templates: d.templates.map((x) => (x.id === t.id ? { ...x, is_active: !t.is_active } : x)) });
    else toast(r.data.error ?? "Couldn't update.", "error");
  }

  async function remove(t: ReelTemplate) {
    if (!(await confirmDialog({ title: `Delete "${t.name}"?`, description: "It disappears from the library straight away. Series already made from it keep working.", confirmLabel: "Delete", destructive: true }))) return;
    const r = await api({ body: { action: "delete", id: t.id } });
    if (r.ok) { toast("Template deleted.", "success"); void load(); } else toast(r.data.error ?? "Couldn't delete.", "error");
  }

  async function addVariations(t: ReelTemplate) {
    setVarying(t.id);
    const r = await api<{ added: number }>({ body: { action: "add_variations", id: t.id, count: 6 } });
    setVarying(null);
    if (r.ok) { toast(`Added ${r.data.added} storylines to ${t.name}.`, "success"); void load(); if (pool?.template.id === t.id) void openPool(t); }
    else toast(r.data.error ?? "Couldn't add storylines.", "error");
  }

  async function openPool(t: ReelTemplate) {
    const r = await api<{ storylines: Storyline[] }>({ body: { action: "storylines", id: t.id } });
    if (r.ok) setPool({ template: t, items: r.data.storylines });
  }

  async function deleteStoryline(s: Storyline) {
    const r = await api({ body: { action: "delete_storyline", storyline_id: s.id } });
    if (r.ok) setPool((p) => p && { ...p, items: p.items.filter((x) => x.id !== s.id) });
    else toast(r.data.error ?? "Couldn't delete.", "error");
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => f && { ...f, [k]: v });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Reel Templates" description="The Faceless Reels template library: formats, previews, storyline pools and character uniqueness."
        actions={<Button variant="primary" onClick={() => setForm(emptyForm())}><Plus size={16} aria-hidden /> New template</Button>} />

      {error && <Alert>{error}</Alert>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Templates" value={templates.length} hint={`${templates.filter((t) => t.is_active).length} active`} />
        <StatCard label="Series and reels started" value={totalSeries} />
        <StatCard label="Episodes written" value={data?.episodes ?? 0} />
        <StatCard label="Free storylines" value={free} hint={`of ${pools.reduce((n, p) => n + p.total, 0)} in all pools`} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent-text" aria-hidden /></div>
      ) : templates.length === 0 ? (
        <EmptyState icon={Film} title="No templates yet" description="Run supabase/faceless_reels.sql to add the 15 starter templates, or create one." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const s = data?.storylines[t.id] ?? { total: 0, available: 0 };
            const low = s.total === 0 || s.available / s.total < 0.2;
            return (
              <div key={t.id} className={`${cardClass} flex flex-col overflow-hidden ${t.is_active ? "" : "opacity-60"}`}>
                <div className="flex gap-3 p-4">
                  <div className="h-28 w-[63px] shrink-0 overflow-hidden rounded-lg bg-raised">
                    {t.image_preview_url ? <img src={t.image_preview_url} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-ink-subtle"><ImagePlus size={18} aria-hidden /></span>}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="font-semibold leading-snug text-ink">{t.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge>{t.category}</Badge><Badge>{KIND_LABEL[t.character_kind] ?? t.character_kind}</Badge><Badge>{t.cast_size} cast</Badge>
                    </div>
                    <p className="text-xs text-ink-muted">{data?.usage[t.id] ?? 0} series · {s.available}/{s.total} storylines free</p>
                    {low && <p className="text-xs text-amber-400">Pool low: refills automatically on the next assignment.</p>}
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
                  <Toggle size="sm" checked={t.is_active} onChange={() => toggle(t)} label="Active" />
                  <div className="ms-auto flex flex-wrap gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => openPool(t)}>Storylines</Button>
                    <Button variant="ghost" size="sm" onClick={() => addVariations(t)} disabled={varying !== null}>
                      {varying === t.id ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Sparkles size={14} aria-hidden />} Add 6
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setForm({ ...emptyForm(), ...t })} aria-label={`Edit ${t.name}`}><Pencil size={14} aria-hidden /></Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(t)} aria-label={`Delete ${t.name}`}><Trash2 size={14} aria-hidden /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Most used */}
      {ranked.length > 0 && totalSeries > 0 && (
        <section className={`${cardClass} space-y-3 p-5`}>
          <h2 className="font-semibold">Most used templates</h2>
          <ol className="space-y-2">
            {ranked.slice(0, 8).map((t) => {
              const n = data?.usage[t.id] ?? 0;
              return (
                <li key={t.id} className="space-y-1">
                  <div className="flex justify-between text-sm"><span className="text-ink">{t.name}</span><span className="text-ink-muted">{n}</span></div>
                  <Progress value={(n / Math.max(1, data?.usage[ranked[0].id] ?? 1)) * 100} />
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Uniqueness monitor */}
      {data && (
        <section className={`${cardClass} space-y-3 p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Character uniqueness</h2>
            <Badge>{data.uniqueness.checked} recent characters checked</Badge>
          </div>
          <p className="text-sm text-ink-muted">
            New characters are redesigned when their look scores above {Math.round(data.uniqueness.limit * 100)}% similar to an existing one. Pairs below got through (usually after 3 attempts) and belong to different users.
          </p>
          {data.uniqueness.pairs.length === 0 ? (
            <Alert tone="success">No near-duplicates among recent characters.</Alert>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.uniqueness.pairs.map((p, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl border border-line bg-canvas p-3">
                  {[p.a, p.b].map((c) => (
                    <div key={c.id} className="flex min-w-0 flex-1 items-center gap-2">
                      {c.image ? <img src={c.image} alt="" className="h-14 w-10 shrink-0 rounded-md object-cover" /> : <span className="h-14 w-10 shrink-0 rounded-md bg-raised" />}
                      <span className="truncate text-xs text-ink">{c.name}</span>
                    </div>
                  ))}
                  <Badge tone="warning"><Copy size={12} aria-hidden /> {Math.round(p.score * 100)}%</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Storyline pool */}
      {pool && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={() => setPool(null)}>
          <div className={`${cardClass} max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-b-none p-5 sm:rounded-2xl`} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-semibold">Storylines · {pool.template.name}</h2>
              <button onClick={() => setPool(null)} className="text-ink-muted hover:text-ink" aria-label="Close"><X size={18} aria-hidden /></button>
            </div>
            <Button variant="secondary" size="sm" onClick={() => addVariations(pool.template)} disabled={varying !== null}>
              {varying ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Sparkles size={14} aria-hidden />} Add 6 storyline variations
            </Button>
            <ul className="mt-4 space-y-2">
              {pool.items.length === 0 && <li className="text-sm text-ink-muted">No storylines yet. The first creator to pick this template triggers a batch, or add some now.</li>}
              {pool.items.map((s) => (
                <li key={s.id} className="flex gap-3 rounded-xl border border-line bg-canvas p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{s.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{s.logline}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge tone={s.status === "available" ? "success" : "neutral"}>{s.status === "available" ? "Free" : "Assigned"}</Badge>
                    {s.status === "available" && <button onClick={() => deleteStoryline(s)} className="text-ink-subtle hover:text-danger" aria-label="Delete storyline"><Trash2 size={14} aria-hidden /></button>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Editor */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={() => !saving && setForm(null)}>
          <div className={`${cardClass} max-h-[92vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-b-none p-5 sm:rounded-2xl`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">{form.id ? `Edit ${form.name}` : "New template"}</h2>
              <button onClick={() => setForm(null)} disabled={saving} className="text-ink-muted hover:text-ink" aria-label="Close"><X size={18} aria-hidden /></button>
            </div>

            <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
              <div className="space-y-2">
                <button onClick={() => imageInput.current?.click()} disabled={upload !== null}
                  className="flex aspect-[9/16] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-line-strong bg-canvas text-ink-subtle hover:border-accent/60">
                  {form.image_preview_url ? <img src={form.image_preview_url} alt="" className="h-full w-full object-cover" /> : <span className="px-2 text-center text-xs"><ImagePlus size={20} className="mx-auto mb-1" aria-hidden />Preview image</span>}
                </button>
                <input ref={imageInput} type="file" accept={IMAGE_TYPES.join(",")} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadImage(f); }} />
                <p className="text-[11px] text-ink-subtle">9:16 JPG/PNG/WebP, max 5MB</p>
              </div>
              <div className="grid content-start gap-4 sm:grid-cols-2">
                <Field label="Name"><Input value={form.name} maxLength={120} onChange={(e) => set("name", e.target.value)} /></Field>
                <Field label="Slug" hint="Used for translations; leave empty to derive from the name"><Input value={form.slug} maxLength={80} onChange={(e) => set("slug", e.target.value)} /></Field>
                <Field label="Category">
                  <Select value={form.category} onChange={(e) => set("category", e.target.value as Form["category"])}>
                    {REEL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </Field>
                <Field label="Character kind">
                  <Select value={form.character_kind} onChange={(e) => set("character_kind", e.target.value as Form["character_kind"])}>
                    {CHARACTER_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                  </Select>
                </Field>
                <Field label="Main characters">
                  <Select value={form.cast_size} onChange={(e) => set("cast_size", Number(e.target.value))}>
                    <option value={1}>1</option><option value={2}>2</option>
                  </Select>
                </Field>
                <Field label="Sort order" hint="Lower shows first"><Input type="number" value={form.sort} onChange={(e) => set("sort", Number(e.target.value))} /></Field>
              </div>
            </div>

            <Field label="Characters" hint="Who the cast is, in general terms. Each user still gets unique designs."><Textarea rows={2} value={form.characters} onChange={(e) => set("characters", e.target.value)} /></Field>
            <Field label="Setting"><Textarea rows={2} value={form.setting} onChange={(e) => set("setting", e.target.value)} /></Field>
            <Field label="Visual style"><Textarea rows={2} value={form.style} onChange={(e) => set("style", e.target.value)} /></Field>
            <Field label="Formula" hint="Shown to users on the template; the story structure that makes it work."><Textarea rows={3} value={form.formula} onChange={(e) => set("formula", e.target.value)} /></Field>
            <Field label="Writer direction" hint="Private notes for the AI: tone, pacing, recurring beats."><Textarea rows={4} value={form.prompt_guide} onChange={(e) => set("prompt_guide", e.target.value)} /></Field>

            <div className="space-y-2">
              <p className="text-[13px] font-medium text-ink-muted">Sample videos (optional, up to 6)</p>
              <div className="flex flex-wrap gap-2">
                {(form.preview_urls ?? []).map((u) => (
                  <div key={u} className="relative h-28 w-[63px] overflow-hidden rounded-lg bg-black">
                    <video src={u} muted playsInline className="h-full w-full object-cover" />
                    <button onClick={() => set("preview_urls", (form.preview_urls ?? []).filter((x) => x !== u))} className="absolute end-1 top-1 rounded-full bg-black/70 p-0.5 text-white" aria-label="Remove sample"><X size={12} aria-hidden /></button>
                  </div>
                ))}
                <button onClick={() => videoInput.current?.click()} disabled={upload !== null}
                  className="grid h-28 w-[63px] place-items-center rounded-lg border border-dashed border-line-strong text-ink-subtle hover:border-accent/60" aria-label="Add sample video">
                  <Plus size={18} aria-hidden />
                </button>
                <input ref={videoInput} type="file" accept={VIDEO_TYPES.join(",")} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadVideo(f); }} />
              </div>
            </div>
            {upload !== null && <Progress value={upload} />}

            <Field label="Disclaimer" hint="Shown with the template, e.g. for AI-generated child-like characters"><Input value={form.disclaimer ?? ""} maxLength={300} onChange={(e) => set("disclaimer", e.target.value || null)} /></Field>
            <label className="flex items-center gap-2.5 text-sm"><Toggle size="sm" checked={form.is_active} onChange={() => set("is_active", !form.is_active)} label="Active" /> Show in the library</label>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
              <Button variant="primary" onClick={save} disabled={saving || upload !== null}>{saving && <Loader2 size={16} className="animate-spin" aria-hidden />} Save template</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
