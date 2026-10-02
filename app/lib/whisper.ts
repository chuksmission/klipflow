// Server-side Whisper transcription shared by Ad Remix and Video Remix.
// Only import from API routes (it uses the OpenAI key).

export const WHISPER_MAX_BYTES = 25 * 1024 * 1024; // OpenAI transcription upload limit

export interface TranscriptSegment { start: number; end: number; text: string }
export interface Transcript { text: string; language: string | null; duration: number | null; segments: TranscriptSegment[] }

export class TranscriptionError extends Error {}

export async function transcribeVideoUrl(openaiKey: string, videoUrl: string): Promise<Transcript> {
  const fileRes = await fetch(videoUrl);
  if (!fileRes.ok) throw new TranscriptionError("Couldn't download the uploaded video for transcription.");
  const blob = await fileRes.blob();
  if (blob.size > WHISPER_MAX_BYTES) {
    throw new TranscriptionError("Video is over 25MB, the transcription limit. Compress it or trim it and try again.");
  }
  const ext = (videoUrl.split("?")[0].split(".").pop() ?? "mp4").toLowerCase();

  const form = new FormData();
  form.append("file", blob, `video.${ext}`);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: form,
  });
  let data: { text?: string; language?: string; duration?: number; segments?: TranscriptSegment[]; error?: { message?: string } } = {};
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw new TranscriptionError(data.error?.message ?? `Whisper failed (${res.status})`);

  return {
    text: data.text ?? "",
    language: data.language ?? null,
    duration: data.duration ?? null,
    segments: (data.segments ?? []).map((s: TranscriptSegment) => ({ start: s.start, end: s.end, text: s.text?.trim() ?? "" })),
  };
}
