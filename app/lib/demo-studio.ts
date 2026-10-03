// Shared Demo Studio definitions (admin page + API route): features, walkthrough
// steps, recording sizes, music presets and pricing.
import { STUDIO_MODULES, type StudioModuleId } from "../components/catalog";

const DEMO_FEATURE_IDS: StudioModuleId[] = [
  "text_to_video", "image_to_video", "ugc_ad", "ai_actor", "voice", "image_ad",
  "video_translator", "video_remix", "ai_actor_swap", "series_cloner", "faceless_reels",
];

export interface DemoFeature { id: string; title: string; available: boolean }

/** Features a demo can show; AI Music Studio is listed but disabled until it's built. */
export const DEMO_FEATURES: DemoFeature[] = [
  ...DEMO_FEATURE_IDS.map((id) => STUDIO_MODULES.find((m) => m.id === id)!).filter(Boolean).map((m) => ({ id: m.id as string, title: m.title, available: true })),
  { id: "ai_music_studio", title: "AI Music Studio (coming soon)", available: false },
];

export const STEP_ACTIONS = ["goto", "click", "type", "press", "select", "upload", "scroll", "hover", "wait", "wait_for_text"] as const;
export type StepAction = typeof STEP_ACTIONS[number];

/** One browser action. `target` is visible text, a label or a path; `css=` prefixes a CSS selector. */
export interface DemoStep {
  action: StepAction;
  target: string;
  value: string;
  seconds: number;
  note: string;
}

export interface StepResult { index: number; ok: boolean; error?: string }

export type Resolution = "1080p" | "720p";
export type DemoAspect = "16:9" | "9:16";

/**
 * Browser viewport (what the site renders at) and output video size.
 * Phone recordings stay below 768px wide so the site shows its mobile layout,
 * then are scaled up.
 */
export function demoSizes(resolution: Resolution, aspect: DemoAspect) {
  if (aspect === "16:9") {
    return resolution === "1080p"
      ? { viewport: { width: 1920, height: 1080 }, output: { width: 1920, height: 1080 } }
      : { viewport: { width: 1280, height: 720 }, output: { width: 1280, height: 720 } };
  }
  return { viewport: { width: 540, height: 960 }, output: resolution === "1080p" ? { width: 1080, height: 1920 } : { width: 720, height: 1280 } };
}

export const MAX_RECORD_SECONDS = 150;

/** Rough on-screen seconds for a step list (shown before recording). */
export function estimateSeconds(steps: DemoStep[]): number {
  let total = 0;
  for (const s of steps) {
    switch (s.action) {
      case "goto": total += 3; break;
      case "type": total += 1 + s.value.length * 0.05; break;
      case "wait": case "wait_for_text": total += Math.min(Math.max(s.seconds, 0), 60); break;
      case "upload": total += 2; break;
      default: total += 1.6;
    }
  }
  return Math.round(total);
}

export const MUSIC_PRESETS = [
  { id: "corporate", label: "Calm corporate", prompt: "Calm, modern corporate background music, soft piano and light synth pads, steady gentle beat, optimistic, unobtrusive" },
  { id: "upbeat_tech", label: "Upbeat tech", prompt: "Upbeat modern tech product demo music, bright plucks, punchy electronic drums, positive and energetic, no vocals" },
  { id: "lofi", label: "Lo-fi chill", prompt: "Relaxed lo-fi hip hop instrumental, warm keys, vinyl texture, soft boom bap drums" },
  { id: "cinematic", label: "Cinematic build", prompt: "Inspiring cinematic underscore, building strings and soft percussion, hopeful and premium" },
  { id: "afrobeats", label: "Afrobeats groove", prompt: "Light Afrobeats instrumental groove, bright guitar licks, shakers and log drums, feel-good and modern" },
] as const;
export type MusicPresetId = typeof MUSIC_PRESETS[number]["id"];

export const DEMO_PRICING = {
  recording: { key: "demo_studio_recording", fallback: 25 },
  voiceover: { key: "demo_studio_voiceover", fallback: 5 },
  presenter: { key: "demo_studio_presenter", fallback: 40 },
  music: { key: "demo_studio_music", fallback: 10 },
} as const;

/** A demo as returned by the API */
export interface DemoVideo {
  id: string;
  title: string;
  feature: string;
  description: string;
  steps: DemoStep[];
  aspect: DemoAspect;
  resolution: Resolution;
  status: "draft" | "recorded" | "rendered" | "failed";
  recording_url: string | null;
  recording_seconds: number | null;
  step_log: StepResult[];
  voice_script: string | null;
  voiceover_url: string | null;
  voiceover_seconds: number | null;
  presenter_task: string | null;
  music_preset: string | null;
  final_url: string | null;
  generation_id: string | null;
  cost: number;
  error: string | null;
  created_at: string;
}
