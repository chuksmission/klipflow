// Server-side FFmpeg (ffmpeg-static binary) for API routes that render video:
// temp workspaces, downloads, running ffmpeg and probing durations.
// Only import from API routes; see next.config.ts for bundling.
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

export const CAPTION_FONT = path.join(process.cwd(), "assets", "fonts", "Inter-Bold.ttf");

export async function workspace(prefix: string) {
  const dir = await mkdtemp(path.join(tmpdir(), `${prefix}-`));
  return { dir, file: (name: string) => path.join(dir, name), cleanup: () => rm(dir, { recursive: true, force: true }) };
}

export async function download(url: string, dest: string, maxBytes = 400 * 1024 * 1024) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't download media (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new Error("Media file is too large.");
  await writeFile(dest, buf);
}

/** Runs ffmpeg; rejects with the tail of stderr on failure. */
export function runFfmpeg(args: string[], timeoutMs = 240_000): Promise<string> {
  if (!ffmpegPath) return Promise.reject(new Error("FFmpeg isn't available on this server."));
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath as string, ["-hide_banner", "-y", ...args]);
    let log = "";
    proc.stderr.on("data", (d) => { log = (log + d.toString()).slice(-20_000); });
    const timer = setTimeout(() => { proc.kill("SIGKILL"); reject(new Error("Video processing took too long.")); }, timeoutMs);
    proc.on("error", (e) => { clearTimeout(timer); reject(e); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(log);
      else reject(new Error(`FFmpeg failed: ${log.split("\n").filter(Boolean).slice(-3).join(" | ")}`));
    });
  });
}

/** Duration in seconds, read from ffmpeg's input summary (no ffprobe needed). */
export async function mediaSeconds(file: string): Promise<number> {
  const log = await new Promise<string>((resolve) => {
    const proc = spawn(ffmpegPath as string, ["-hide_banner", "-i", file]);
    let out = "";
    proc.stderr.on("data", (d) => { out += d.toString(); });
    proc.on("close", () => resolve(out));
    proc.on("error", () => resolve(out));
  });
  const m = log.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

/** Size, duration and whether there's an audio track, from ffmpeg's input summary. */
export async function probeMedia(file: string): Promise<{ seconds: number; width: number; height: number; hasAudio: boolean }> {
  const log = await new Promise<string>((resolve) => {
    const proc = spawn(ffmpegPath as string, ["-hide_banner", "-i", file]);
    let out = "";
    proc.stderr.on("data", (d) => { out += d.toString(); });
    proc.on("close", () => resolve(out));
    proc.on("error", () => resolve(out));
  });
  const d = log.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const v = log.match(/Video:.*?,\s(\d{2,5})x(\d{2,5})/);
  return {
    seconds: d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0,
    width: v ? Number(v[1]) : 0,
    height: v ? Number(v[2]) : 0,
    hasAudio: /Stream #.*Audio:/.test(log),
  };
}
