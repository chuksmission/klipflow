import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { runFfmpeg, workspace } from "../../../lib/server-ffmpeg";

// The first-frame grab reads only the start of the stored video
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STORAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/generation-inputs/`;
const ours = (u: unknown): u is string => typeof u === "string" && u.startsWith(STORAGE_PREFIX);
const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

async function checkAdmin(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await supabase.from("user_profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin ? user : null;
}

// First frame of a stored video as a JPEG thumbnail. FFmpeg reads the URL
// directly, fetching only the bytes it needs rather than the whole file.
async function firstFrame(videoUrl: string): Promise<string> {
  const ws = await workspace("tpl-thumb");
  try {
    const out = ws.file("thumb.jpg");
    await runFfmpeg(["-ss", "0.5", "-i", videoUrl, "-frames:v", "1", "-vf", "scale='min(720,iw)':-2", "-q:v", "3", out], 45_000)
      .catch(() => runFfmpeg(["-i", videoUrl, "-frames:v", "1", "-vf", "scale='min(720,iw)':-2", "-q:v", "3", out], 45_000));
    const bytes = await readFile(out);
    const path = `video-templates/thumb-${Date.now()}-${Math.round(Math.random() * 1e6)}.jpg`;
    const { error } = await supabase.storage.from("generation-inputs").upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    return supabase.storage.from("generation-inputs").getPublicUrl(path).data.publicUrl;
  } finally {
    await ws.cleanup();
  }
}

export async function GET(req: NextRequest) {
  if (!(await checkAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await supabase.from("video_templates").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(req: NextRequest) {
  try {
    if (!(await checkAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- validated field by field below
    const body = await req.json() as Record<string, any>;
    const action = String(body.action ?? "");

    if (action === "save") {
      const title = clip(body.title, 120);
      const category = clip(body.category, 60);
      if (!title) return NextResponse.json({ error: "Give the template a title." }, { status: 400 });
      if (!ours(body.video_url)) return NextResponse.json({ error: "Upload the video first." }, { status: 400 });
      // No thumbnail uploaded: use the video's first frame
      let thumbnail = ours(body.thumbnail_url) ? body.thumbnail_url : null;
      let thumbNote = "";
      if (!thumbnail) {
        thumbnail = await firstFrame(body.video_url).catch((e) => { thumbNote = e instanceof Error ? e.message : "Thumbnail failed"; return null; });
      }
      const row = { title, category, video_url: body.video_url, thumbnail_url: thumbnail, is_active: body.is_active !== false };
      const query = body.id != null
        ? supabase.from("video_templates").update(row).eq("id", body.id)
        : supabase.from("video_templates").insert(row);
      const { data, error } = await query.select("*").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ template: data, warning: thumbNote ? `Saved, but the thumbnail couldn't be created (${thumbNote}).` : undefined });
    }

    if (action === "delete") {
      if (body.id == null) return NextResponse.json({ error: "id is required" }, { status: 400 });
      const { error } = await supabase.from("video_templates").delete().eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Video templates error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong" }, { status: 500 });
  }
}
