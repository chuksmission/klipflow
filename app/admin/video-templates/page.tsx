"use client";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Film, ImagePlus, Loader2, Pencil, Plus, Trash2, UploadCloud, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { resumableUpload } from "../../lib/resumable-upload";
import { Alert, Badge, Button, EmptyState, Field, Input, PageHeader, Progress, cardClass } from "../../components/ui";
import { confirmDialog, toast } from "../../components/ui/Toaster";

interface Template {
  id: number;
  title: string;
  category: string | null;
  video_url: string;
  thumbnail_url: string | null;
  is_active: boolean | null;
  created_at: string;
}

const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_VIDEO = 500 * 1024 * 1024;
const MAX_IMAGE = 5 * 1024 * 1024;
const ext = (f: File, fallback: string) => f.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || fallback;
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)}MB`;

async function api<T>(init: { method?: string; body?: unknown }): Promise<{ ok: boolean; data: T & { error?: string; warning?: string } }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, data: { error: "Please sign in again." } as T & { error?: string } };
  const res = await fetch("/api/admin/video-templates", {
    method: init.method ?? "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
  return { ok: res.ok, data };
}

const emptyForm = { id: null as number | null, title: "", category: "", video_url: "", thumbnail_url: "" };

export default function AdminVideoTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState("");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const localVideo = useMemo(() => (videoFile ? URL.createObjectURL(videoFile) : ""), [videoFile]);
  useEffect(() => () => { if (localVideo) URL.revokeObjectURL(localVideo); }, [localVideo]);
  const videoInput = useRef<HTMLInputElement>(null);
  const thumbInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ templates?: Template[] }>({ method: "GET" }).then((r) => {
      if (r.ok) setTemplates(r.data.templates ?? []);
      else setError(r.data.error ?? "Couldn't load templates.");
      setLoading(false);
    });
  }, []);

  const reset = () => {
    setForm(emptyForm); setVideoFile(null); setThumbFile(null); setThumbPreview(""); setProgress(null); setError("");
  };
  const openNew = () => { reset(); setShowForm(true); };
  const openEdit = (tpl: Template) => {
    reset();
    setForm({ id: tpl.id, title: tpl.title ?? "", category: tpl.category ?? "", video_url: tpl.video_url, thumbnail_url: tpl.thumbnail_url ?? "" });
    setThumbPreview(tpl.thumbnail_url ?? "");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pickVideo = (f: File | undefined) => {
    if (!f) return;
    if (!VIDEO_TYPES.includes(f.type)) { setError("Upload an MP4, MOV or WebM video."); return; }
    if (f.size > MAX_VIDEO) { setError(`Videos can be up to 500MB. This one is ${mb(f.size)}.`); return; }
    setError(""); setVideoFile(f); setForm((s) => ({ ...s, video_url: "", title: s.title || f.name.replace(/\.[^.]+$/, "").slice(0, 120) }));
  };
  const pickThumb = (f: File | undefined) => {
    if (!f) return;
    if (!IMAGE_TYPES.includes(f.type)) { setError("Thumbnails can be JPG, PNG or WebP."); return; }
    if (f.size > MAX_IMAGE) { setError(`Thumbnails can be up to 5MB. This one is ${mb(f.size)}.`); return; }
    setError(""); setThumbFile(f); setThumbPreview(URL.createObjectURL(f));
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault(); setDragging(false);
    pickVideo(e.dataTransfer.files?.[0]);
  };

  const save = async () => {
    if (!form.title.trim()) { setError("Give the template a title."); return; }
    if (!videoFile && !form.video_url) { setError("Add a video."); return; }
    setSaving(true); setError("");
    abort.current = new AbortController();
    try {
      let videoUrl = form.video_url;
      if (videoFile) {
        setProgress(0);
        videoUrl = await resumableUpload(videoFile, "generation-inputs", `video-templates/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext(videoFile, "mp4")}`, setProgress, abort.current.signal);
      }
      let thumbUrl = form.thumbnail_url;
      if (thumbFile) {
        const path = `video-templates/thumb-${Date.now()}.${ext(thumbFile, "jpg")}`;
        const { error: upErr } = await supabase.storage.from("generation-inputs").upload(path, thumbFile, { contentType: thumbFile.type });
        if (upErr) throw new Error(`Thumbnail upload failed: ${upErr.message}`);
        thumbUrl = supabase.storage.from("generation-inputs").getPublicUrl(path).data.publicUrl;
      }
      // A replaced video without a new thumbnail gets a fresh first-frame thumbnail
      if (videoFile && !thumbFile) thumbUrl = "";

      const r = await api<{ template?: Template }>({ body: { action: "save", id: form.id, title: form.title, category: form.category, video_url: videoUrl, thumbnail_url: thumbUrl || null } });
      if (!r.ok || !r.data.template) throw new Error(r.data.error ?? "Couldn't save the template.");
      const tpl = r.data.template;
      setTemplates((list) => (form.id != null ? list.map((x) => (x.id === tpl.id ? tpl : x)) : [tpl, ...list]));
      toast(r.data.warning ?? (form.id != null ? "Template updated." : "Template added."), r.data.warning ? "warning" : "success");
      reset(); setShowForm(false);
    } catch (e) {
      setError(abort.current?.signal.aborted ? "Upload cancelled." : e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false); setProgress(null); abort.current = null;
    }
  };

  const remove = async (tpl: Template) => {
    if (!(await confirmDialog({ title: `Delete "${tpl.title}"?`, description: "It stops showing to users straight away.", confirmLabel: "Delete", destructive: true }))) return;
    const r = await api({ body: { action: "delete", id: tpl.id } });
    if (r.ok) { setTemplates((list) => list.filter((x) => x.id !== tpl.id)); toast("Template deleted.", "success"); }
    else toast(r.data.error ?? "Couldn't delete.", "error");
  };

  const categories = Array.from(new Set(templates.map((t) => t.category).filter(Boolean))) as string[];

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Video Templates"
        description={`${templates.length} ${templates.length === 1 ? "video" : "videos"} shown to users as inspiration`}
        actions={!showForm && <Button variant="primary" onClick={openNew}><Plus size={16} aria-hidden /> Add video</Button>}
      />

      {showForm && (
        <section className={`${cardClass} space-y-5 p-5 md:p-6`}>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{form.id != null ? "Edit template" : "Add video template"}</h2>
            <button onClick={() => { abort.current?.abort(); setShowForm(false); reset(); }} aria-label="Close" className="rounded-lg p-1.5 text-ink-subtle hover:bg-white/5 hover:text-ink"><X size={18} aria-hidden /></button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title"><Input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Luxury fashion reel" /></Field>
            <Field label="Category" hint="Shown as a badge on the card">
              <Input value={form.category} maxLength={60} list="tpl-categories" onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Fashion, Travel, Food..." />
              <datalist id="tpl-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
          </div>

          {/* Video: drag and drop */}
          <Field label="Video" hint="MP4, MOV or WebM, up to 500MB">
            <div
              role="button" tabIndex={0}
              onClick={() => !saving && videoInput.current?.click()}
              onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !saving) videoInput.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={"flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors " + (dragging ? "border-accent bg-accent/10" : "border-line hover:border-line-strong")}
            >
              {videoFile || form.video_url ? (
                <>
                  <video src={localVideo || form.video_url} muted playsInline className="max-h-48 rounded-lg bg-black" />
                  <p className="text-sm text-ink">{videoFile ? `${videoFile.name} · ${mb(videoFile.size)}` : "Current video"}</p>
                  <p className="text-xs text-ink-subtle">Click or drop another file to replace it</p>
                </>
              ) : (
                <>
                  <UploadCloud size={28} className="text-accent-text" aria-hidden />
                  <p className="text-sm font-medium text-ink">Drop a video here or click to choose</p>
                  <p className="text-xs text-ink-subtle">MP4, MOV, WebM · up to 500MB</p>
                </>
              )}
            </div>
            <input ref={videoInput} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={(e) => { pickVideo(e.target.files?.[0]); e.target.value = ""; }} />
          </Field>

          {/* Thumbnail */}
          <Field label="Thumbnail (optional)" hint="JPG, PNG or WebP up to 5MB. Leave empty to use the video's first frame.">
            <div className="flex items-center gap-3">
              {thumbPreview
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={thumbPreview} alt="Thumbnail" className="h-20 w-20 rounded-lg border border-line object-cover" />
                : <span className="grid h-20 w-20 place-items-center rounded-lg border border-dashed border-line text-ink-subtle"><ImagePlus size={20} aria-hidden /></span>}
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => thumbInput.current?.click()} disabled={saving}>{thumbPreview ? "Replace" : "Upload image"}</Button>
                {thumbPreview && <Button variant="ghost" size="sm" onClick={() => { setThumbFile(null); setThumbPreview(""); setForm((s) => ({ ...s, thumbnail_url: "" })); }} disabled={saving}>Use first frame</Button>}
              </div>
            </div>
            <input ref={thumbInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { pickThumb(e.target.files?.[0]); e.target.value = ""; }} />
          </Field>

          {progress !== null && (
            <div className="space-y-1.5">
              <Progress value={Math.round(progress * 100)} />
              <p className="text-xs text-ink-subtle">Uploading video… {Math.round(progress * 100)}%{videoFile ? ` of ${mb(videoFile.size)}` : ""}</p>
            </div>
          )}
          {error && <Alert>{error}</Alert>}

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
              {saving ? (progress !== null && progress < 1 ? "Uploading…" : "Saving…") : form.id != null ? "Save changes" : "Add template"}
            </Button>
            {saving && progress !== null && progress < 1 && <Button variant="ghost" onClick={() => abort.current?.abort()}>Cancel upload</Button>}
          </div>
        </section>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-ink-muted"><Loader2 size={16} className="animate-spin" aria-hidden /> Loading…</div>
      ) : templates.length === 0 ? (
        <EmptyState icon={Film} title="No video templates yet" description="Add reference videos that users can use as inspiration." action={!showForm && <Button variant="primary" onClick={openNew}><Plus size={16} aria-hidden /> Add video</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => <TemplateCard key={tpl.id} tpl={tpl} onEdit={() => openEdit(tpl)} onDelete={() => remove(tpl)} />)}
        </div>
      )}
    </div>
  );
}

function TemplateCard({ tpl, onEdit, onDelete }: { tpl: Template; onEdit: () => void; onDelete: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  return (
    <article
      className={`${cardClass} group overflow-hidden`}
      onMouseEnter={() => video.current?.play().catch(() => {})}
      onMouseLeave={() => { const v = video.current; if (v) { v.pause(); v.currentTime = 0; } }}
    >
      <div className="relative aspect-video bg-black">
        <video ref={video} src={tpl.video_url} poster={tpl.thumbnail_url ?? undefined} muted loop playsInline preload="none" className="h-full w-full object-cover" />
        {tpl.is_active === false && <span className="absolute start-2 top-2"><Badge tone="warning">Hidden</Badge></span>}
      </div>
      <div className="space-y-3 p-3.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink" title={tpl.title}>{tpl.title}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {tpl.category && <Badge tone="accent">{tpl.category}</Badge>}
            <Badge>{new Date(tpl.created_at).toLocaleDateString()}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onEdit}><Pencil size={14} aria-hidden /> Edit</Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-400 hover:text-red-300"><Trash2 size={14} aria-hidden /> Delete</Button>
        </div>
      </div>
    </article>
  );
}
