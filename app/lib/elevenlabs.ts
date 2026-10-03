// Server-side ElevenLabs text to speech with a voice picked by language,
// accent and gender (shared by AI Actor Swap and Series Cloner).
import type { VoiceGender } from "./actor-swap";

// Languages eleven_multilingual_v2 speaks; others use eleven_v3
const ELEVEN_V2_LANGS = new Set(["en", "ja", "zh", "de", "hi", "fr", "ko", "pt", "it", "es", "id", "nl", "tr", "fil", "pl", "sv", "bg", "ro", "ar", "cs", "el", "fi", "hr", "ms", "sk", "da", "ta", "uk", "ru"]);
const ACCENT_QUERY: Record<string, string> = {
  "American (neutral)": "american", "American Southern": "southern american", "African American": "african american",
  "British (RP)": "british", "British (Cockney)": "cockney", "Australian": "australian", "Irish": "irish", "Scottish": "scottish",
  "Indian English": "indian", "Nigerian English": "nigerian", "Jamaican": "jamaican", "Canadian": "canadian",
  "South African": "south african", "New Zealand": "new zealand",
};
const FALLBACK_VOICES: Record<VoiceGender, string> = { female: "21m00Tcm4TlvDq8ikWAM", male: "pNInz6obpgDQGcFmaJgB" };

async function safeJson(res: Response) {
  try { const t = await res.text(); return t ? JSON.parse(t) : {}; } catch { return {}; }
}

async function pickVoice(key: string, lang: string, accent: string | null, gender: VoiceGender) {
  const headers = { "xi-api-key": key, Accept: "application/json" };
  const attempts: Record<string, string>[] = [
    { language: lang, gender, ...(accent ? { accent: ACCENT_QUERY[accent] ?? accent.toLowerCase().replace(/\s*\(.*\)/, "") } : {}) },
    { language: lang, gender },
    { language: lang },
  ];
  for (const q of attempts) {
    const params = new URLSearchParams({ ...q, page_size: "5", sort: "usage_character_count_1y" });
    const res = await fetch(`https://api.elevenlabs.io/v1/shared-voices?${params}`, { headers });
    const data = await safeJson(res);
    const v = data.voices?.[0];
    if (v?.voice_id) return { voice_id: v.voice_id as string, owner: v.public_owner_id as string | undefined, name: v.name as string };
  }
  return { voice_id: FALLBACK_VOICES[gender], owner: undefined, name: "default" };
}

function synthesize(key: string, voiceId: string, text: string, lang: string): Promise<Response> {
  return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: ELEVEN_V2_LANGS.has(lang) ? "eleven_multilingual_v2" : "eleven_v3" }),
  });
}

/** MP3 bytes of `text` spoken in `lang` by a voice matching the accent and gender. */
export async function speak(key: string, text: string, lang: string, accent: string | null, gender: VoiceGender): Promise<Uint8Array> {
  const voice = await pickVoice(key, lang, accent, gender);
  let res = await synthesize(key, voice.voice_id, text, lang);
  if (!res.ok && voice.owner) {
    // Shared voices may need adding to the account before use
    const add = await fetch(`https://api.elevenlabs.io/v1/voices/add/${voice.owner}/${voice.voice_id}`, {
      method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ new_name: `KF ${voice.name}`.slice(0, 40) }),
    });
    const added = await safeJson(add);
    res = await synthesize(key, added.voice_id ?? voice.voice_id, text, lang);
  }
  if (!res.ok) { const e = await safeJson(res); throw new Error(e.detail?.message ?? (typeof e.detail === "string" ? e.detail : "Voice generation failed.")); }
  return new Uint8Array(await res.arrayBuffer());
}

export interface SpeechAlignment { characters: string[]; starts: number[]; ends: number[] }

/** Like speak(), plus per-character timings (used to time captions to the voice). */
export async function speakWithTimestamps(key: string, text: string, lang: string, accent: string | null, gender: VoiceGender): Promise<{ audio: Uint8Array; alignment: SpeechAlignment | null }> {
  const voice = await pickVoice(key, lang, accent, gender);
  const call = (voiceId: string) => fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ text, model_id: ELEVEN_V2_LANGS.has(lang) ? "eleven_multilingual_v2" : "eleven_v3" }),
  });
  let res = await call(voice.voice_id);
  if (!res.ok && voice.owner) {
    const add = await fetch(`https://api.elevenlabs.io/v1/voices/add/${voice.owner}/${voice.voice_id}`, {
      method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ new_name: `KF ${voice.name}`.slice(0, 40) }),
    });
    const added = await safeJson(add);
    res = await call(added.voice_id ?? voice.voice_id);
  }
  const data = await safeJson(res);
  if (!res.ok || !data.audio_base64) throw new Error(data.detail?.message ?? (typeof data.detail === "string" ? data.detail : "Voice generation failed."));
  const a = data.alignment ?? data.normalized_alignment;
  return {
    audio: new Uint8Array(Buffer.from(data.audio_base64, "base64")),
    alignment: a?.characters ? { characters: a.characters, starts: a.character_start_times_seconds, ends: a.character_end_times_seconds } : null,
  };
}
