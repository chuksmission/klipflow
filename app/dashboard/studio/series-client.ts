"use client";
// Browser helpers for the Series Cloner module: authenticated API calls,
// uploads, frame extraction and task polling.
import { supabase } from "../../lib/supabase";

export interface ApiResult<T> { ok: boolean; status: number; data: T & { error?: string } }

async function session() {
  return (await supabase.auth.getSession()).data.session;
}

export async function authedPost<T = Record<string, unknown>>(path: string, body: unknown): Promise<ApiResult<T>> {
  const s = await session();
  if (!s) return { ok: false, status: 401, data: { error: "Please sign in again." } as T & { error?: string } };
  try {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.access_token }, body: JSON.stringify(body) });
    let data = {} as T & { error?: string };
    try { data = await res.json(); } catch { data = { error: `Request failed (${res.status})` } as T & { error?: string }; }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Network error. Check your connection." } as T & { error?: string } };
  }
}

export const seriesApi = <T = Record<string, unknown>>(action: string, body: Record<string, unknown> = {}) =>
  authedPost<T>("/api/series-cloner", { action, ...body });

export async function uploadBlob(blob: Blob, ext: string, folder = "series-cloner"): Promise<string | null> {
  const s = await session();
  if (!s) return null;
  const path = `${folder}/${s.user.id}-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
  const { error } = await supabase.storage.from("generation-inputs").upload(path, blob, { contentType: blob.type || undefined });
  if (error) { console.error("Upload error:", error); return null; }
  return supabase.storage.from("generation-inputs").getPublicUrl(path).data.publicUrl;
}

export function probeVideo(src: string): Promise<{ seconds: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      if (!isFinite(v.duration) || v.duration <= 0) reject(new Error("no duration"));
      else resolve({ seconds: v.duration, width: v.videoWidth, height: v.videoHeight });
    };
    v.onerror = () => reject(new Error("unreadable"));
    v.src = src;
  });
}

/** JPEG frames (max 512px) in time order: two from the opening seconds, the rest spread out. */
export async function extractFrames(file: Blob, duration: number, count: number): Promise<string[]> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video");
    v.preload = "auto"; v.muted = true; v.playsInline = true; v.src = url;
    await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(new Error("unreadable")); });
    const spread = Array.from({ length: Math.max(1, count - 2) }, (_, i) => duration * (0.15 + (0.8 * i) / Math.max(1, count - 3)));
    // Skip times within 0.3s of a frame already kept (very short videos)
    const times: number[] = [];
    for (const raw of [0.4, Math.min(2, duration * 0.1), ...spread]) {
      const t = Math.min(Math.max(0, raw), Math.max(0, duration - 0.15));
      if (times.length < count && times.every((x) => Math.abs(x - t) >= 0.3)) times.push(t);
    }
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 512 / Math.max(v.videoWidth || 512, v.videoHeight || 512));
    canvas.width = Math.round((v.videoWidth || 512) * scale);
    canvas.height = Math.round((v.videoHeight || 512) * scale);
    const ctx = canvas.getContext("2d");
    const out: string[] = [];
    for (const t of times) {
      await new Promise<void>((res) => {
        const done = () => { v.removeEventListener("seeked", done); res(); };
        v.addEventListener("seeked", done); v.currentTime = t; setTimeout(done, 3000);
      });
      if (ctx) { ctx.drawImage(v, 0, 0, canvas.width, canvas.height); out.push(canvas.toDataURL("image/jpeg", 0.72)); }
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polls /api/video-status until done, failed, cancelled or `maxMs` passes. */
export async function pollTask(taskId: string, provider: string, isCancelled: () => boolean, maxMs = 10 * 60 * 1000): Promise<{ url: string | null; reason: string }> {
  const started = Date.now();
  while (true) {
    if (isCancelled()) return { url: null, reason: "Cancelled." };
    if (Date.now() - started > maxMs) return { url: null, reason: "This took longer than 10 minutes, so it was stopped." };
    try {
      const res = await fetch(`/api/video-status?task_id=${encodeURIComponent(taskId)}&provider=${provider}`);
      const sd = await res.json();
      if (sd.completed && sd.video_url) return { url: sd.video_url, reason: "" };
      if (sd.failed) return { url: null, reason: sd.fail_reason ?? "Generation failed." };
    } catch { /* keep polling */ }
    await sleep(provider === "kie" ? 4000 : 6000);
  }
}

export async function downloadUrl(url: string, filename: string) {
  try {
    const b = await (await fetch(url)).blob();
    const href = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = href; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(href);
  } catch { window.open(url, "_blank"); }
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
