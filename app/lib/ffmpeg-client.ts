"use client";
// In-browser video processing (ffmpeg.wasm) for AI Actor Swap: split long
// videos into Runway-sized chunks, extract audio for transcription, join the
// generated chunks back together and restore the original soundtrack.
// The ~30MB ffmpeg core is fetched from the CDN only when first needed.
import type { FFmpeg } from "@ffmpeg/ffmpeg";

const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";

let instance: Promise<FFmpeg> | null = null;

export function loadFFmpeg(onLog?: (line: string) => void): Promise<FFmpeg> {
  if (!instance) {
    instance = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import("@ffmpeg/ffmpeg"), import("@ffmpeg/util")]);
      const ffmpeg = new FFmpeg();
      if (onLog) ffmpeg.on("log", ({ message }) => onLog(message));
      await ffmpeg.load({
        // Worker served as a static file (public/ffmpeg, copied from @ffmpeg/ffmpeg
        // 0.12.15 dist/esm) so the bundler doesn't rewrite its dynamic core import
        classWorkerURL: `${window.location.origin}/ffmpeg/worker.js`,
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ffmpeg;
    })().catch((err) => { instance = null; throw err; });
  }
  return instance;
}

async function writeInput(ffmpeg: FFmpeg, name: string, source: Blob | string) {
  const { fetchFile } = await import("@ffmpeg/util");
  await ffmpeg.writeFile(name, await fetchFile(source));
}

async function readBlob(ffmpeg: FFmpeg, name: string, type: string): Promise<Blob> {
  const data = await ffmpeg.readFile(name);
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  return new Blob([bytes], { type });
}

async function cleanup(ffmpeg: FFmpeg, names: string[]) {
  for (const n of names) { try { await ffmpeg.deleteFile(n); } catch { /* not present */ } }
}

/** Equal-length chunks no longer than maxSeconds (re-encoded so cuts are exact). */
export async function splitVideo(file: Blob, duration: number, maxSeconds = 29, onProgress?: (p: number) => void): Promise<Blob[]> {
  const ffmpeg = await loadFFmpeg();
  const count = Math.max(1, Math.ceil(duration / maxSeconds));
  const length = duration / count;
  await writeInput(ffmpeg, "src.mp4", file);
  const out: Blob[] = [];
  try {
    for (let i = 0; i < count; i++) {
      const name = `chunk${i}.mp4`;
      await ffmpeg.exec([
        "-ss", (i * length).toFixed(3), "-i", "src.mp4", "-t", length.toFixed(3),
        "-vf", "scale='min(1280,iw)':-2", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20",
        "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", name,
      ]);
      out.push(await readBlob(ffmpeg, name, "video/mp4"));
      await cleanup(ffmpeg, [name]);
      onProgress?.((i + 1) / count);
    }
  } finally {
    await cleanup(ffmpeg, ["src.mp4"]);
  }
  return out;
}

/** Audio track only (small mp3), for transcription of large videos. */
export async function extractAudio(file: Blob): Promise<Blob> {
  const ffmpeg = await loadFFmpeg();
  await writeInput(ffmpeg, "src_a.mp4", file);
  try {
    await ffmpeg.exec(["-i", "src_a.mp4", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "48k", "audio.mp3"]);
    return await readBlob(ffmpeg, "audio.mp3", "audio/mpeg");
  } finally {
    await cleanup(ffmpeg, ["src_a.mp4", "audio.mp3"]);
  }
}

/**
 * Join generated clips (URLs or blobs) into one video. When `audioFrom` is
 * given, its soundtrack replaces the clips' audio (used to keep the original
 * voice when only the face changes). `keepAudio` keeps each clip's own sound
 * instead (scene dialogue), when the clips share one format.
 */
export async function joinClips(clips: (Blob | string)[], audioFrom?: Blob | string, keepAudio = false): Promise<Blob> {
  const ffmpeg = await loadFFmpeg();
  const names: string[] = [];
  try {
    for (let i = 0; i < clips.length; i++) {
      const name = `part${i}.mp4`;
      await writeInput(ffmpeg, name, clips[i]);
      names.push(name);
    }
    // Fast path: Runway returns every chunk in the same format, so a stream copy
    // join takes about a second. Fall back to re-encoding (never upscaling).
    await ffmpeg.writeFile("list.txt", names.map((n) => `file '${n}'`).join("\n"));
    names.push("list.txt");
    let code = await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", ...(keepAudio && !audioFrom ? [] : ["-an"]), "joined.mp4"]);
    if (code !== 0) {
      await cleanup(ffmpeg, ["joined.mp4"]);
      const inputs = names.filter((n) => n.endsWith(".mp4")).flatMap((n) => ["-i", n]);
      const parts = names.filter((n) => n.endsWith(".mp4"));
      const filter = parts.map((_, i) => `[${i}:v]scale='min(1280,iw)':-2,setsar=1,fps=24,format=yuv420p[v${i}]`).join(";")
        + ";" + parts.map((_, i) => `[v${i}]`).join("") + `concat=n=${parts.length}:v=1:a=0[outv]`;
      code = await ffmpeg.exec([...inputs, "-filter_complex", filter, "-map", "[outv]", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20", "-an", "joined.mp4"]);
      if (code !== 0) throw new Error("Couldn't join the video clips.");
    }
    names.push("joined.mp4");

    if (!audioFrom) return await readBlob(ffmpeg, "joined.mp4", "video/mp4");

    await writeInput(ffmpeg, "orig.mp4", audioFrom);
    names.push("orig.mp4");
    await ffmpeg.exec(["-i", "joined.mp4", "-i", "orig.mp4", "-map", "0:v:0", "-map", "1:a:0?", "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", "final.mp4"]);
    names.push("final.mp4");
    return await readBlob(ffmpeg, "final.mp4", "video/mp4");
  } finally {
    await cleanup(ffmpeg, names);
  }
}
