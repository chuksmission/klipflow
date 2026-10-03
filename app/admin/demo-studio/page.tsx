"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown, ArrowUp, CheckCircle2, Clapperboard, Coins, Download, Film, Loader2, Music, Plus, Save, Settings2,
  Sparkles, Star, Trash2, Upload, UserRound, Wand2, XCircle,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { SHOWCASE_CATEGORIES } from "../../components/catalog";
import {
  DEMO_FEATURES, MAX_RECORD_SECONDS, MUSIC_PRESETS, STEP_ACTIONS, demoSizes, estimateSeconds,
  type DemoAspect, type DemoStep, type DemoVideo, type Resolution,
} from "../../lib/demo-studio";
import LanguageAccentSelector, { DEFAULT_LANGUAGE, type LanguageChoice } from "../../components/LanguageAccentSelector";
import { Alert, Badge, Button, Field, Input, PageHeader, Progress, Select, Textarea, Toggle, cardClass } from "../../components/ui";

interface Config {
  browserless: boolean; demo_email: string; demo_password_set: boolean; sample_video_url: string; sample_image_url: string;
  elevenlabs: boolean; heygen: boolean; ai: boolean;
}
interface Status {
  balance: number;
  prices: Record<string, number>;
  config: Config;
  music: Record<string, string | null>;
  demos: { id: string; title: string; feature: string; status: string; final_url: string | null; created_at: string }[];
}
type Busy = "" | "plan" | "save_steps" | "record" | "voiceover" | "music" | "presenter" | "render" | "save" | "feature";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token } : null;
}

async function api<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<{ ok: boolean; data: T & { error?: string } }> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, data: { error: "Please sign in again." } as T & { error?: string } };
  try {
    const res = await fetch("/api/admin/demo-studio", { method: "POST", headers, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "Network error." } as T & { error?: string } };
  }
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const blankStep = (): DemoStep => ({ action: "click", target: "", value: "", seconds: 0, note: "" });

export default function DemoStudioPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<Busy>("");
  const [elapsed, setElapsed] = useState(0);

  // Settings
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uploadingSample, setUploadingSample] = useState<"" | "video" | "image">("");
  const sampleVideoRef = useRef<HTMLInputElement>(null);
  const sampleImageRef = useRef<HTMLInputElement>(null);

  // Steps 1-3
  const [description, setDescription] = useState("");
  const [feature, setFeature] = useState("series_cloner");
  const [resolution, setResolution] = useState<Resolution>("1080p");
  const [aspect, setAspect] = useState<DemoAspect>("16:9");

  // Current demo
  const [demo, setDemo] = useState<DemoVideo | null>(null);
  const [steps, setSteps] = useState<DemoStep[]>([]);
  const [stepsDirty, setStepsDirty] = useState(false);

  // Polish
  const [script, setScript] = useState("");
  const [voiceLang, setVoiceLang] = useState<LanguageChoice>(DEFAULT_LANGUAGE);
  const [gender, setGender] = useState<"female" | "male">("female");
  const [captions, setCaptions] = useState(true);
  const [musicPreset, setMusicPreset] = useState("");
  const [usePresenter, setUsePresenter] = useState(false);
  const [avatars, setAvatars] = useState<{ id: string; name: string }[]>([]);
  const [avatarId, setAvatarId] = useState("");
  const [presenterState, setPresenterState] = useState<"" | "rendering" | "ready" | "failed">("");

  // Save + feature
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [featCategory, setFeatCategory] = useState<string>(SHOWCASE_CATEGORIES[0].id);
  const [featTitle, setFeatTitle] = useState("");
  const [featSort, setFeatSort] = useState("0");
  const [featured, setFeatured] = useState(false);

  const loadStatus = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch("/api/admin/demo-studio", { headers });
    const data = await res.json().catch(() => null);
    if (res.ok && data) { setStatus(data); setEmail((e) => e || data.config.demo_email); }
    else setError(data?.error ?? "Couldn't load Demo Studio.");
  }, []);

  useEffect(() => {
    let cancelled = false;
    authHeaders().then((headers) => headers && fetch("/api/admin/demo-studio", { headers }))
      .then((res) => res ? res.json().then((data) => ({ ok: res.ok, data })) : null)
      .then((r) => {
        if (cancelled || !r) return;
        if (r.ok) { setStatus(r.data); setEmail(r.data.config.demo_email); } else setError(r.data?.error ?? "Couldn't load Demo Studio.");
      })
      .catch(() => { if (!cancelled) setError("Couldn't load Demo Studio."); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const begin = (b: Busy) => { setBusy(b); setElapsed(0); setError(""); setNotice(""); };
  const end = () => setBusy("");

  const showDemo = (d: DemoVideo) => {
    setDemo(d); setSteps(d.steps); setStepsDirty(false); setScript(d.voice_script ?? ""); setGenerationId(d.generation_id);
    setResolution(d.resolution); setAspect(d.aspect); setFeature(d.feature); setDescription(d.description);
    setPresenterState(d.presenter_task ? "rendering" : ""); setFeatured(false); setFeatTitle(d.title);
  };

  // ---------------------------------------------------------------- settings
  const saveSettings = async () => {
    const r = await api({ action: "save_settings", email, ...(password ? { password } : {}) });
    if (!r.ok) { setError(r.data.error ?? "Couldn't save."); return; }
    setPassword(""); setNotice("Demo account saved."); void loadStatus();
  };

  const uploadSample = async (kind: "video" | "image", e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (kind === "video" && (!f.type.startsWith("video/") || f.size > 100 * 1024 * 1024)) { setError("Sample video must be a video under 100MB."); return; }
    if (kind === "image" && (!f.type.startsWith("image/") || f.size > 10 * 1024 * 1024)) { setError("Sample image must be an image under 10MB."); return; }
    setUploadingSample(kind);
    const path = `demo-studio/samples/${kind}-${Date.now()}.${f.name.split(".").pop()?.toLowerCase() || (kind === "video" ? "mp4" : "jpg")}`;
    const { error: upErr } = await supabase.storage.from("generation-inputs").upload(path, f, { contentType: f.type });
    setUploadingSample("");
    if (upErr) { setError(`Upload failed: ${upErr.message}`); return; }
    const url = supabase.storage.from("generation-inputs").getPublicUrl(path).data.publicUrl;
    const r = await api({ action: "save_settings", [kind === "video" ? "sample_video_url" : "sample_image_url"]: url });
    if (r.ok) { setNotice(`Sample ${kind} saved.`); void loadStatus(); }
  };

  // ---------------------------------------------------------------- 1-4
  const plan = async () => {
    if (!description.trim()) { setError("Describe the walkthrough first."); return; }
    begin("plan");
    const r = await api<{ demo?: DemoVideo }>({ action: "plan", description, feature, aspect, resolution });
    end();
    if (!r.ok || !r.data.demo) { setError(r.data.error ?? "Couldn't plan the steps."); return; }
    showDemo(r.data.demo);
    void loadStatus();
  };

  const editStep = (i: number, patch: Partial<DemoStep>) => { setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x))); setStepsDirty(true); };
  const moveStep = (i: number, d: -1 | 1) => {
    setSteps((s) => { const n = [...s]; const j = i + d; if (j < 0 || j >= n.length) return s; [n[i], n[j]] = [n[j], n[i]]; return n; });
    setStepsDirty(true);
  };
  const saveSteps = async (): Promise<boolean> => {
    if (!demo) return false;
    const r = await api<{ demo?: DemoVideo }>({ action: "update", demo_id: demo.id, steps, voice_script: script, aspect, resolution });
    if (!r.ok || !r.data.demo) { setError(r.data.error ?? "Couldn't save the steps."); return false; }
    setDemo(r.data.demo); setStepsDirty(false);
    return true;
  };

  const record = async () => {
    if (!demo) return;
    if (stepsDirty && !(await saveSteps())) return;
    begin("record");
    const r = await api<{ demo?: DemoVideo }>({ action: "record", demo_id: demo.id });
    end();
    if (!r.ok || !r.data.demo) { setError(r.data.error ?? "Recording failed."); void loadStatus(); return; }
    setDemo(r.data.demo);
    const failed = r.data.demo.step_log.filter((l) => !l.ok).length;
    setNotice(failed ? `Recorded, but ${failed} step(s) didn't run. Fix them below and record again if needed.` : "Recorded.");
    void loadStatus();
  };

  // ---------------------------------------------------------------- 5
  const makeVoiceover = async () => {
    if (!demo) return;
    begin("voiceover");
    const r = await api<{ demo?: DemoVideo }>({ action: "voiceover", demo_id: demo.id, script, language: voiceLang.language, accent: voiceLang.accent, gender });
    end();
    if (!r.ok || !r.data.demo) { setError(r.data.error ?? "Voiceover failed."); void loadStatus(); return; }
    setDemo(r.data.demo); setPresenterState(""); setNotice("Voiceover ready."); void loadStatus();
  };

  const prepareMusic = async () => {
    if (!musicPreset) return;
    begin("music");
    const r = await api<{ url?: string }>({ action: "music", preset: musicPreset });
    end();
    if (!r.ok || !r.data.url) { setError(r.data.error ?? "Music failed."); }
    void loadStatus();
  };

  const loadAvatars = async () => {
    if (avatars.length) return;
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch("/api/admin/ad-remix", { method: "POST", headers, body: JSON.stringify({ action: "heygen_options" }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.avatars) { setAvatars(data.avatars); setAvatarId((a) => a || data.avatars[0]?.id || ""); }
    else setError(data.error ?? "Couldn't load HeyGen presenters.");
  };

  const pollPresenter = useCallback(async (taskId: string, demoId: string) => {
    setPresenterState("rendering");
    const started = Date.now();
    while (Date.now() - started < 10 * 60 * 1000) {
      await new Promise((r) => setTimeout(r, 8000));
      const res = await fetch(`/api/video-status?task_id=${encodeURIComponent(taskId)}&provider=heygen_v3`).catch(() => null);
      const sd = res ? await res.json().catch(() => ({})) : {};
      if (sd.completed) { setPresenterState("ready"); return; }
      if (sd.failed) {
        setPresenterState("failed");
        await api({ action: "presenter_failed", demo_id: demoId });
        setError(`The presenter failed (${sd.fail_reason ?? "HeyGen error"}). Tokens refunded.`);
        void loadStatus();
        return;
      }
    }
    setError("The presenter is taking longer than 10 minutes. Try rendering again later.");
  }, [loadStatus]);

  const makePresenter = async () => {
    if (!demo || !avatarId) return;
    begin("presenter");
    const r = await api<{ demo?: DemoVideo; task_id?: string }>({ action: "presenter", demo_id: demo.id, avatar_id: avatarId });
    end();
    if (!r.ok || !r.data.demo || !r.data.task_id) { setError(r.data.error ?? "Couldn't start the presenter."); void loadStatus(); return; }
    setDemo(r.data.demo); void loadStatus();
    void pollPresenter(r.data.task_id, r.data.demo.id);
  };

  const render = async () => {
    if (!demo) return;
    if (usePresenter && presenterState !== "ready") { setError("Wait for the presenter to finish, or switch it off."); return; }
    begin("render");
    const r = await api<{ demo?: DemoVideo }>({ action: "render", demo_id: demo.id, captions, music_preset: musicPreset || null, presenter: usePresenter, voiceover: !!demo.voiceover_url });
    end();
    if (!r.ok || !r.data.demo) { setError(r.data.error ?? "Render failed."); return; }
    setDemo(r.data.demo); setGenerationId(null); setFeatured(false);
  };

  // ---------------------------------------------------------------- 6
  const saveToGallery = async () => {
    if (!demo) return;
    begin("save");
    const r = await api<{ demo?: DemoVideo; generation_id?: string | number }>({ action: "save", demo_id: demo.id });
    end();
    if (!r.ok || r.data.generation_id == null) { setError(r.data.error ?? "Couldn't save."); return; }
    setGenerationId(String(r.data.generation_id)); setNotice("Saved to the gallery as a demo video.");
  };

  const featureOnHomepage = async () => {
    if (!generationId) return;
    begin("feature");
    const headers = await authHeaders();
    const res = headers ? await fetch("/api/admin/generations", {
      method: "PATCH", headers,
      body: JSON.stringify({ id: generationId, is_featured: true, featured_category: featCategory, featured_title: featTitle || demo?.title, featured_sort: parseInt(featSort, 10) || 0 }),
    }) : null;
    end();
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { setError(data.error ?? "Couldn't feature this video."); return; }
    setFeatured(true);
  };

  const removeDemo = async (id: string) => {
    if (!window.confirm("Delete this demo? Saved gallery copies are kept.")) return;
    await api({ action: "delete", demo_id: id });
    if (demo?.id === id) { setDemo(null); setSteps([]); }
    void loadStatus();
  };

  // ---------------------------------------------------------------- render

  const cfg = status?.config;
  const prices = status?.prices ?? {};
  const estimate = estimateSeconds(steps);
  const sizes = demoSizes(resolution, aspect);
  const featureInfo = DEMO_FEATURES.find((f) => f.id === feature);
  const busyLabel: Record<Exclude<Busy, "">, string> = {
    plan: "Claude is planning the steps…", save_steps: "Saving…", record: "Recording in a cloud browser (signing in, then running every step)…",
    voiceover: "Creating the voiceover…", music: "Composing the music preset (first time only)…", presenter: "Starting the presenter…",
    render: "Rendering the final video…", save: "Saving…", feature: "Featuring…",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demo Studio"
        description="Record “how it works” screen videos of klipflowai.com for ads and the homepage."
        actions={status && <Badge tone="accent"><Coins size={13} aria-hidden /> {status.balance} showcase tokens</Badge>}
      />

      {/* Setup */}
      <section className={`${cardClass} p-5`}>
        <button onClick={() => setSettingsOpen(!settingsOpen)} className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={settingsOpen}>
          <span className="flex items-center gap-2 font-semibold"><Settings2 size={17} className="text-accent-text" aria-hidden /> Setup</span>
          <span className="flex flex-wrap justify-end gap-1.5">
            <Badge tone={cfg?.browserless ? "success" : "warning"}>Browserless {cfg?.browserless ? "ready" : "missing"}</Badge>
            <Badge tone={cfg?.demo_password_set && cfg?.demo_email ? "success" : "warning"}>Demo account {cfg?.demo_password_set && cfg?.demo_email ? "set" : "missing"}</Badge>
          </span>
        </button>
        {(settingsOpen || (cfg && (!cfg.browserless || !cfg.demo_password_set))) && (
          <div className="mt-4 space-y-4">
            {!cfg?.browserless && <Alert tone="warning">Add your Browserless API key in <Link href="/admin/ai-providers" className="underline">Admin → AI Providers</Link>. Session recording needs a paid Browserless plan.</Alert>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Demo account email" hint="A normal user account you created for demos. It needs tokens for any step that generates.">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="demo@klipflowai.com" autoComplete="off" />
              </Field>
              <Field label="Demo account password" hint={cfg?.demo_password_set ? "Saved (stored as a secret, never shown). Type to replace it." : "Stored as a secret setting; never sent back to the browser."}>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={cfg?.demo_password_set ? "••••••••" : "Password"} autoComplete="new-password" />
              </Field>
            </div>
            <Button variant="secondary" onClick={saveSettings} disabled={!email.trim()}><Save size={15} aria-hidden /> Save demo account</Button>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["video", "image"] as const).map((kind) => (
                <div key={kind} className="rounded-xl border border-line bg-canvas p-3.5 text-sm">
                  <p className="font-medium text-ink">Sample {kind} for upload steps</p>
                  <p className="mt-0.5 text-xs text-ink-subtle">{(kind === "video" ? cfg?.sample_video_url : cfg?.sample_image_url) ? "Saved." : "None yet: upload steps will be skipped."}</p>
                  <input ref={kind === "video" ? sampleVideoRef : sampleImageRef} type="file" accept={kind === "video" ? "video/mp4,video/quicktime,video/webm" : "image/jpeg,image/png,image/webp"} className="hidden" onChange={(e) => uploadSample(kind, e)} />
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => (kind === "video" ? sampleVideoRef : sampleImageRef).current?.click()} disabled={!!uploadingSample}>
                    {uploadingSample === kind ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Upload size={14} aria-hidden />} Upload sample {kind}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Steps 1-3 */}
      <section className={`${cardClass} space-y-4 p-5`}>
        <h2 className="font-semibold">1. Describe the walkthrough</h2>
        <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={3000}
          placeholder="Go to Video Studio, click Series Cloner, upload a video, select English to French, click analyze and show the formula card" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="2. Feature">
            <Select value={feature} onChange={(e) => setFeature(e.target.value)}>
              {DEMO_FEATURES.map((f) => <option key={f.id} value={f.id} disabled={!f.available}>{f.title}</option>)}
            </Select>
          </Field>
          <Field label="3. Resolution">
            <Select value={resolution} onChange={(e) => setResolution(e.target.value as Resolution)}>
              <option value="1080p">1080p</option>
              <option value="720p">720p</option>
            </Select>
          </Field>
          <Field label="Aspect ratio">
            <Select value={aspect} onChange={(e) => setAspect(e.target.value as DemoAspect)}>
              <option value="16:9">16:9 desktop</option>
              <option value="9:16">9:16 mobile</option>
            </Select>
          </Field>
        </div>
        <p className="text-xs text-ink-subtle">
          Output {sizes.output.width}×{sizes.output.height}
          {aspect === "9:16" ? ` (the site's mobile layout is captured at ${sizes.viewport.width}×${sizes.viewport.height} and scaled up)` : ""} · recordings up to {fmt(MAX_RECORD_SECONDS)}
        </p>
        <Button variant="primary" onClick={plan} disabled={!!busy || !featureInfo?.available || !cfg?.ai}>
          {busy === "plan" ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Sparkles size={16} aria-hidden />} Plan steps with Claude
        </Button>
      </section>

      {busy && (
        <section className={`${cardClass} space-y-3 p-5`} aria-live="polite">
          <p className="flex items-center gap-2 text-sm text-ink"><Loader2 size={16} className="animate-spin text-accent-text" aria-hidden /> {busyLabel[busy]}</p>
          <Progress value={busy === "record" ? Math.min(95, (elapsed / Math.max(30, estimate + 40)) * 100) : busy === "render" ? Math.min(95, elapsed * 1.5) : 50} />
          <p className="text-xs text-ink-subtle">{fmt(elapsed)} elapsed · keep this page open</p>
        </section>
      )}
      {error && <Alert>{error}</Alert>}
      {notice && !error && <Alert tone="success">{notice}</Alert>}

      {/* Step 4: review steps + record */}
      {demo && (
        <section className={`${cardClass} space-y-4 p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">4. Review the steps · {demo.title}</h2>
            <Badge>~{fmt(estimate)} on screen</Badge>
          </div>
          <p className="text-xs text-ink-subtle">The recording signs in to the demo account first (not recorded), then runs these steps in order. A step that can&apos;t run is skipped and listed after recording.</p>
          <ol className="space-y-2">
            {steps.map((s, i) => {
              const log = demo.step_log?.find((l) => l.index === i);
              return (
                <li key={i} className="rounded-xl border border-line bg-canvas p-3">
                  <div className="grid gap-2 sm:grid-cols-[2rem_9rem_1fr_1fr_5rem_auto] sm:items-center">
                    <span className="text-xs text-ink-subtle">{i + 1}.</span>
                    <Select value={s.action} onChange={(e) => editStep(i, { action: e.target.value as DemoStep["action"] })} aria-label={`Step ${i + 1} action`}>
                      {STEP_ACTIONS.map((a) => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
                    </Select>
                    <Input value={s.target} onChange={(e) => editStep(i, { target: e.target.value })} placeholder={s.action === "goto" ? "/dashboard/studio" : "Visible text or label"} aria-label={`Step ${i + 1} target`} />
                    <Input value={s.value} onChange={(e) => editStep(i, { value: e.target.value })} placeholder={s.action === "upload" ? "video or image" : "Text / key / option"} aria-label={`Step ${i + 1} value`} />
                    <Input type="number" min={0} max={90} value={s.seconds} onChange={(e) => editStep(i, { seconds: Number(e.target.value) })} aria-label={`Step ${i + 1} seconds`} />
                    <div className="flex gap-1">
                      <button onClick={() => moveStep(i, -1)} aria-label="Move up" className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink-muted hover:text-ink"><ArrowUp size={14} aria-hidden /></button>
                      <button onClick={() => moveStep(i, 1)} aria-label="Move down" className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink-muted hover:text-ink"><ArrowDown size={14} aria-hidden /></button>
                      <button onClick={() => { setSteps((x) => x.filter((_, j) => j !== i)); setStepsDirty(true); }} aria-label="Delete step" className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink-muted hover:text-red-400"><Trash2 size={14} aria-hidden /></button>
                    </div>
                  </div>
                  {(s.note || log) && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs">
                      {log && (log.ok ? <CheckCircle2 size={13} className="text-emerald-400" aria-hidden /> : <XCircle size={13} className="text-red-400" aria-hidden />)}
                      <span className={log && !log.ok ? "text-red-400" : "text-ink-subtle"}>{log && !log.ok ? log.error : s.note}</span>
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setSteps((s) => [...s, blankStep()]); setStepsDirty(true); }}><Plus size={15} aria-hidden /> Add step</Button>
            {stepsDirty && <Button variant="secondary" size="sm" onClick={() => void saveSteps()} disabled={!!busy}><Save size={15} aria-hidden /> Save steps</Button>}
          </div>
          <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-ink-subtle">{prices.recording ?? 25} showcase tokens per recording, refunded if it fails.</p>
            <Button variant="primary" onClick={record} disabled={!!busy || !steps.length || !cfg?.browserless || !cfg?.demo_password_set}>
              <Clapperboard size={16} aria-hidden /> {demo.recording_url ? "Record again" : "Record"}
            </Button>
          </div>
          {demo.recording_url && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">Raw recording · {fmt(demo.recording_seconds ?? 0)}</p>
              <video src={demo.recording_url} controls playsInline className="max-h-[60vh] w-full rounded-xl border border-line bg-black" />
            </div>
          )}
        </section>
      )}

      {/* Step 5: polish */}
      {demo?.recording_url && (
        <section className={`${cardClass} space-y-5 p-5`}>
          <h2 className="font-semibold">5. Polish (optional)</h2>

          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium text-ink"><Wand2 size={15} className="text-accent-text" aria-hidden /> AI voiceover</p>
            <Textarea rows={4} value={script} onChange={(e) => setScript(e.target.value)} maxLength={4000} placeholder="What the narrator says over the demo" />
            <LanguageAccentSelector value={voiceLang} onChange={setVoiceLang} label="Voice language & accent" />
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label="Voice">
                {(["female", "male"] as const).map((g) => (
                  <button key={g} role="radio" aria-checked={gender === g} onClick={() => setGender(g)} className={"h-8 rounded-md px-4 text-sm font-medium capitalize transition-colors " + (gender === g ? "bg-raised text-ink" : "text-ink-muted hover:text-ink")}>{g}</button>
                ))}
              </div>
              <Button variant="secondary" size="sm" onClick={makeVoiceover} disabled={!!busy || !script.trim() || !cfg?.elevenlabs}>
                {demo.voiceover_url ? "Recreate voiceover" : "Create voiceover"} · {prices.voiceover ?? 5}
              </Button>
              {demo.voiceover_url && <audio src={demo.voiceover_url} controls className="h-9" />}
            </div>
            {!cfg?.elevenlabs && <p className="text-xs text-ink-subtle">Needs an ElevenLabs key in AI Providers.</p>}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas p-3.5">
            <div>
              <p className="text-sm font-medium">Captions</p>
              <p className="text-xs text-ink-subtle">{demo.voiceover_url ? "Timed to the voiceover." : "From the script, spread over the video."}</p>
            </div>
            <Toggle checked={captions} onChange={() => setCaptions(!captions)} label="Captions" />
          </div>

          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium text-ink"><Music size={15} className="text-accent-text" aria-hidden /> Background music</p>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={musicPreset} onChange={(e) => setMusicPreset(e.target.value)} className="max-w-xs" aria-label="Music preset">
                <option value="">No music</option>
                {MUSIC_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}{status?.music[p.id] ? "" : " (needs preparing)"}</option>)}
              </Select>
              {musicPreset && !status?.music[musicPreset] && (
                <Button variant="secondary" size="sm" onClick={prepareMusic} disabled={!!busy || !cfg?.elevenlabs}>Prepare preset · {prices.music ?? 10}</Button>
              )}
              {musicPreset && status?.music[musicPreset] && <audio src={status.music[musicPreset]!} controls className="h-9" />}
            </div>
            <p className="text-xs text-ink-subtle">Each preset is composed once with ElevenLabs Music and reused. It plays quietly under the voice.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas p-3.5">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium"><UserRound size={15} className="text-accent-text" aria-hidden /> Talking-head presenter</p>
                <p className="text-xs text-ink-subtle">A HeyGen presenter speaks the voiceover in the corner. Needs the voiceover first; rendering takes a few minutes.</p>
              </div>
              <Toggle checked={usePresenter} onChange={() => { setUsePresenter(!usePresenter); if (!usePresenter) void loadAvatars(); }} label="Presenter" />
            </div>
            {usePresenter && (
              <div className="flex flex-wrap items-center gap-2">
                <Select value={avatarId} onChange={(e) => setAvatarId(e.target.value)} className="max-w-xs" aria-label="Presenter">
                  {!avatars.length && <option value="">Loading presenters…</option>}
                  {avatars.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
                <Button variant="secondary" size="sm" onClick={makePresenter} disabled={!!busy || !demo.voiceover_url || !avatarId || presenterState === "rendering" || !cfg?.heygen}>
                  {demo.presenter_task ? "Recreate presenter" : "Create presenter"} · {prices.presenter ?? 40}
                </Button>
                {presenterState === "rendering" && <Badge><Loader2 size={12} className="animate-spin" aria-hidden /> Rendering</Badge>}
                {presenterState === "ready" && <Badge tone="success">Ready</Badge>}
                {presenterState === "failed" && <Badge tone="danger">Failed</Badge>}
              </div>
            )}
          </div>

          <div className="border-t border-line pt-4">
            <Button variant="primary" onClick={render} disabled={!!busy}><Film size={16} aria-hidden /> Render final video</Button>
          </div>
        </section>
      )}

      {/* Step 6: save + feature */}
      {demo?.final_url && (
        <section className={`${cardClass} space-y-4 p-5`}>
          <h2 className="font-semibold">6. Your demo video</h2>
          <video src={demo.final_url} controls playsInline className="max-h-[70vh] w-full rounded-xl border border-line bg-black" />
          <div className="flex flex-wrap gap-2">
            <a href={demo.final_url} download className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-raised px-4 text-sm text-ink hover:border-line-strong"><Download size={15} aria-hidden /> Download</a>
            <Button variant="primary" onClick={saveToGallery} disabled={!!busy || !!generationId}>
              {generationId ? <><CheckCircle2 size={15} aria-hidden /> Saved to gallery</> : <><Save size={15} aria-hidden /> Save to gallery</>}
            </Button>
          </div>
          {generationId && (
            featured ? <Alert tone="success">Featured on the homepage.</Alert> : (
              <div className="grid gap-3 rounded-xl border border-line bg-canvas p-3.5 sm:grid-cols-[1fr_1fr_6rem_auto] sm:items-end">
                <Field label="Category">
                  <Select value={featCategory} onChange={(e) => setFeatCategory(e.target.value)}>
                    {SHOWCASE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </Select>
                </Field>
                <Field label="Title"><Input value={featTitle} onChange={(e) => setFeatTitle(e.target.value)} placeholder={demo.title} /></Field>
                <Field label="Sort"><Input type="number" value={featSort} onChange={(e) => setFeatSort(e.target.value)} /></Field>
                <Button variant="secondary" onClick={featureOnHomepage} disabled={!!busy}><Star size={15} aria-hidden /> Feature</Button>
              </div>
            )
          )}
        </section>
      )}

      {/* History */}
      {!!status?.demos.length && (
        <section className={`${cardClass} space-y-3 p-5`}>
          <h2 className="font-semibold">Recent demos</h2>
          <ul className="divide-y divide-line">
            {status.demos.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5 text-sm">
                <button onClick={async () => { const r = await api<{ demo?: DemoVideo }>({ action: "get", demo_id: d.id }); if (r.data.demo) showDemo(r.data.demo); }} className="min-w-0 flex-1 truncate text-left text-ink hover:text-accent-text">{d.title}</button>
                <Badge>{DEMO_FEATURES.find((f) => f.id === d.feature)?.title ?? d.feature}</Badge>
                <Badge tone={d.status === "rendered" ? "success" : "neutral"}>{d.status}</Badge>
                <button onClick={() => removeDemo(d.id)} aria-label={`Delete ${d.title}`} className="text-ink-subtle hover:text-red-400"><Trash2 size={14} aria-hidden /></button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
