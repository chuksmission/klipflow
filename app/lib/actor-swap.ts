// Shared AI Actor Swap definitions (used by the Studio module and the API route):
// languages and accents, background presets, limits and per-second pricing.
import { perSecondCost } from "./duration-pricing";

export const ACTOR_SWAP_MAX_SECONDS = 120;
export const ACT_TWO_CHUNK_SECONDS = 29;   // Runway Act-Two accepts up to 30s per job

export interface LanguageOption { name: string; code: string; accents: string[] }

// Accent labels are shown to users and also used to pick a matching ElevenLabs voice.
export const ACTOR_SWAP_LANGUAGES: LanguageOption[] = [
  { name: "English", code: "en", accents: ["American (neutral)", "American Southern", "African American", "British (RP)", "British (Cockney)", "Australian", "Irish", "Scottish", "Indian English", "Nigerian English", "Jamaican", "Canadian", "South African", "New Zealand"] },
  { name: "French", code: "fr", accents: ["Parisian", "Canadian French", "African French", "Belgian"] },
  { name: "Spanish", code: "es", accents: ["Mexican", "Spain", "Colombian", "Argentinian", "Cuban", "Venezuelan"] },
  { name: "Arabic", code: "ar", accents: ["Egyptian", "Gulf / Saudi", "Levantine", "Moroccan"] },
  { name: "Portuguese", code: "pt", accents: ["Brazilian", "European Portuguese", "Angolan"] },
  { name: "Hindi", code: "hi", accents: ["Standard Hindi", "Mumbai"] },
  { name: "Mandarin", code: "zh", accents: ["Standard Mandarin", "Taiwanese Mandarin"] },
  { name: "Russian", code: "ru", accents: ["Standard Russian"] },
  { name: "Japanese", code: "ja", accents: ["Standard Japanese (Tokyo)", "Kansai"] },
  { name: "Korean", code: "ko", accents: ["Standard Korean (Seoul)", "Busan"] },
  { name: "German", code: "de", accents: ["Standard German", "Austrian", "Swiss German"] },
  { name: "Italian", code: "it", accents: ["Standard Italian", "Southern Italian"] },
  { name: "Bulgarian", code: "bg", accents: ["Standard Bulgarian"] },
  { name: "Turkish", code: "tr", accents: ["Istanbul Turkish"] },
  { name: "Dutch", code: "nl", accents: ["Netherlands Dutch", "Flemish"] },
  { name: "Polish", code: "pl", accents: ["Standard Polish"] },
  { name: "Swahili", code: "sw", accents: ["Kenyan", "Tanzanian"] },
  { name: "Yoruba", code: "yo", accents: ["Standard Yoruba"] },
  { name: "Hausa", code: "ha", accents: ["Standard Hausa"] },
  { name: "Afrikaans", code: "af", accents: ["South African Afrikaans"] },
];

export const BACKGROUND_PRESETS = [
  { id: "office", label: "Modern office", prompt: "a bright modern office with soft daylight, plants and glass walls, softly blurred" },
  { id: "studio", label: "TV studio", prompt: "a professional TV studio set with soft key lighting and a dark backdrop with subtle lights" },
  { id: "city", label: "Outdoor city", prompt: "a city street at golden hour with shallow depth of field and bokeh lights" },
  { id: "blur", label: "Abstract blur", prompt: "an abstract softly blurred gradient background in muted violet and blue tones" },
  { id: "plain", label: "Plain colour", prompt: "a clean, evenly lit plain light-grey studio backdrop" },
  { id: "luxury", label: "Luxury interior", prompt: "an elegant luxury living room with warm lamps, marble and velvet furniture, softly blurred" },
] as const;

export type BackgroundMode = "model" | "upload" | "preset" | "describe";
export type VoiceGender = "female" | "male";

export interface ActorSwapChoices {
  changeFace: boolean;
  changeVoice: boolean;
  background: BackgroundMode;
}

export interface ActorSwapRates {
  language: number;    // tokens per minute, voice/language only
  face: number;        // tokens per minute, new face with original voice
  full: number;        // tokens per minute, new face + language/voice
  background: number;  // add-on per minute when the background is replaced
}

export const DEFAULT_RATES: ActorSwapRates = { language: 30, face: 50, full: 80, background: 20 };

export function ratesFrom(pricing: Record<string, number>): ActorSwapRates {
  return {
    language: pricing["actor_swap_language"] ?? DEFAULT_RATES.language,
    face: pricing["actor_swap_face"] ?? DEFAULT_RATES.face,
    full: pricing["actor_swap_full"] ?? DEFAULT_RATES.full,
    background: pricing["actor_swap_background"] ?? DEFAULT_RATES.background,
  };
}

/** Per-minute rate for a combination of choices (0 if nothing changes). */
export function ratePerMinute(c: ActorSwapChoices, r: ActorSwapRates): number {
  if (!c.changeFace && !c.changeVoice) return 0;
  const base = c.changeFace ? (c.changeVoice ? r.full : r.face) : r.language;
  return base + (c.changeFace && c.background !== "model" ? r.background : 0);
}

/**
 * Billed per second of source video, with a minimum of 15 seconds' worth to
 * cover the fixed AI steps (transcription, translation, image editing).
 */
export function actorSwapCost(c: ActorSwapChoices, r: ActorSwapRates, seconds: number): number {
  return perSecondCost(ratePerMinute(c, r), seconds);
}

/** Tokens to refund when the face succeeded but the language/voice part failed. */
export function voicePortion(c: ActorSwapChoices, r: ActorSwapRates, seconds: number): number {
  if (!c.changeFace || !c.changeVoice) return 0;
  const total = actorSwapCost(c, r, seconds);
  const faceOnly = actorSwapCost({ ...c, changeVoice: false }, r, seconds);
  return Math.max(0, total - faceOnly);
}

export function chunkCount(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / ACT_TWO_CHUNK_SECONDS));
}
