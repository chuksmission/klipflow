// Server-side handling of the Studio's "Output Language & Accent" choice.
import { ACTOR_SWAP_LANGUAGES } from "./actor-swap";

export interface OutputLanguage { code: string; name: string; accent: string }

/** Validated language from a request body, or null when none was chosen. */
export function parseOutputLanguage(language: unknown, accent: unknown): OutputLanguage | null {
  const lang = ACTOR_SWAP_LANGUAGES.find((l) => l.code === language);
  if (!lang) return null;
  const a = typeof accent === "string" && lang.accents.includes(accent) ? accent : "";
  return { code: lang.code, name: lang.name, accent: a };
}

const accentPhrase = (l: OutputLanguage) => (l.accent ? ` with a natural ${l.accent} accent` : "");

/** For video models with native audio: what the characters' speech sounds like. */
export const speechInstruction = (l: OutputLanguage) =>
  `All spoken dialogue and narration is in ${l.name}${accentPhrase(l)}.`;

/** For images: any visible text is written in the chosen language. */
export const imageTextInstruction = (l: OutputLanguage) =>
  `Any text that appears in the image is written in ${l.name}.`;

/** For AI writing tools (prompt expander, script writer, showcase prompts). */
export const writingInstruction = (l: OutputLanguage) =>
  `Write in ${l.name}${l.accent ? `, using natural word choice and phrasing for a ${l.accent} speaker (never phonetic spelling or caricature)` : ""}.`;
