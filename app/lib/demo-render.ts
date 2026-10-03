// Server-only: turns a raw walkthrough recording into the final demo video
// with FFmpeg: output size, talking-head corner, burned-in captions, voiceover
// and background music.
import { writeFile } from "node:fs/promises";
import type { SpeechAlignment } from "./elevenlabs";
import { CAPTION_FONT, runFfmpeg } from "./server-ffmpeg";

export interface Caption { start: number; end: number; text: string }

const VOICE_DELAY = 0.4;   // voiceover starts just after the video

/** Caption chunks timed to the voice (from ElevenLabs character timings). */
export function captionsFromAlignment(a: SpeechAlignment): Caption[] {
  const words: { text: string; start: number; end: number }[] = [];
  let cur = "", start = 0, end = 0;
  for (let i = 0; i < a.characters.length; i++) {
    const ch = a.characters[i];
    if (/\s/.test(ch)) { if (cur) words.push({ text: cur, start, end }); cur = ""; continue; }
    if (!cur) start = a.starts[i];
    cur += ch; end = a.ends[i];
  }
  if (cur) words.push({ text: cur, start, end });
  return chunk(words).map((c) => ({ ...c, start: c.start + VOICE_DELAY, end: c.end + VOICE_DELAY }));
}

/** Without a voiceover: the script spread evenly over the video. */
export function captionsEvenly(script: string, seconds: number): Caption[] {
  const raw = script.split(/\s+/).filter(Boolean);
  if (!raw.length) return [];
  const per = (seconds - 1) / raw.length;
  return chunk(raw.map((w, i) => ({ text: w, start: 0.5 + i * per, end: 0.5 + (i + 1) * per })));
}

function chunk(words: { text: string; start: number; end: number }[]): Caption[] {
  const out: Caption[] = [];
  let group: typeof words = [];
  const flush = () => { if (group.length) out.push({ text: group.map((w) => w.text).join(" "), start: group[0].start, end: group[group.length - 1].end }); group = []; };
  for (const w of words) {
    const len = group.reduce((n, g) => n + g.text.length + 1, 0) + w.text.length;
    if (group.length >= 6 || len > 34) flush();
    group.push(w);
    if (/[.!?]$/.test(w.text)) flush();
  }
  flush();
  // Keep each caption on screen until the next one starts (no flicker between chunks)
  for (let i = 0; i < out.length - 1; i++) out[i].end = Math.max(out[i].end, out[i + 1].start);
  return out;
}

// Paths inside a filter graph: forward slashes, escaped drive colons (Windows dev)
const ffPath = (p: string) => `'${p.replace(/\\/g, "/").replace(/:/g, "\\:")}'`;

export interface RenderInput {
  recording: string;
  output: string;
  workdir: (name: string) => string;
  width: number;
  height: number;
  seconds: number;              // final length
  voice?: string;
  music?: string;
  presenter?: string;
  captions: Caption[];
}

export async function renderDemo(r: RenderInput) {
  const args: string[] = ["-i", r.recording];
  let n = 1;
  const voiceIdx = r.voice ? n++ : -1;
  if (r.voice) args.push("-i", r.voice);
  const musicIdx = r.music ? n++ : -1;
  if (r.music) args.push("-stream_loop", "-1", "-i", r.music);
  const presenterIdx = r.presenter ? n++ : -1;
  if (r.presenter) args.push("-i", r.presenter);

  const W = r.width, H = r.height;
  const filters: string[] = [];
  // Fit the recording to the output size, and hold the last frame if the voice runs longer
  filters.push(`[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x0B0B10,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=${Math.ceil(r.seconds)}[v0]`);
  let v = "v0";

  const margin = Math.round(Math.min(W, H) * 0.035);
  let pipHeight = 0;
  if (presenterIdx > 0) {
    const pw = Math.round(Math.min(W, H) * (W > H ? 0.26 : 0.36) / 2) * 2;
    pipHeight = pw;
    filters.push(`[${presenterIdx}:v]scale=${pw}:${pw}:force_original_aspect_ratio=increase,crop=${pw}:${pw},setsar=1[pip]`);
    filters.push(`[${v}][pip]overlay=${W - pw - margin}:${H - pw - margin}:eof_action=pass[v1]`);
    v = "v1";
  }

  if (r.captions.length) {
    const size = Math.round(Math.min(W, H) * (W > H ? 0.042 : 0.05));
    const y = pipHeight ? Math.round(H - pipHeight - margin * 2 - size * 1.6) : Math.round(H * 0.84);
    const draws: string[] = [];
    for (let i = 0; i < r.captions.length; i++) {
      const c = r.captions[i];
      const file = r.workdir(`cap${i}.txt`);
      await writeFile(file, c.text);
      draws.push(`drawtext=fontfile=${ffPath(CAPTION_FONT)}:textfile=${ffPath(file)}:expansion=none:fontsize=${size}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=${Math.round(size * 0.35)}:x=(w-text_w)/2:y=${y}:enable='gte(t,${c.start.toFixed(2)})*lt(t,${c.end.toFixed(2)})'`);
    }
    filters.push(`[${v}]${draws.join(",")}[vc]`);
    v = "vc";
  }

  // Audio: voiceover on top, music low underneath (fades out at the end)
  let audioMap: string[] = [];
  const fadeStart = Math.max(0, r.seconds - 2).toFixed(2);
  if (voiceIdx > 0 && musicIdx > 0) {
    filters.push(`[${voiceIdx}:a]adelay=${VOICE_DELAY * 1000}|${VOICE_DELAY * 1000},apad[va]`);
    filters.push(`[${musicIdx}:a]volume=0.12,afade=t=out:st=${fadeStart}:d=2[ma]`);
    filters.push(`[va][ma]amix=inputs=2:duration=longest:normalize=0[aout]`);
    audioMap = ["-map", "[aout]"];
  } else if (voiceIdx > 0) {
    filters.push(`[${voiceIdx}:a]adelay=${VOICE_DELAY * 1000}|${VOICE_DELAY * 1000},apad[aout]`);
    audioMap = ["-map", "[aout]"];
  } else if (musicIdx > 0) {
    filters.push(`[${musicIdx}:a]volume=0.25,afade=t=out:st=${fadeStart}:d=2[aout]`);
    audioMap = ["-map", "[aout]"];
  } else {
    audioMap = ["-map", "0:a?"];
  }

  args.push(
    "-filter_complex", filters.join(";"),
    "-map", `[${v}]`, ...audioMap,
    "-t", r.seconds.toFixed(2),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart",
    r.output,
  );
  await runFfmpeg(args, 270_000);
}
