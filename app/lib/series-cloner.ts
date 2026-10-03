// Shared Series Cloner definitions (used by the Studio module and the API
// route): limits, pricing, the shapes of analysis results and episodes.
import type { VoiceGender } from "./actor-swap";

export const SERIES_MIN_VIDEOS = 3;
export const SERIES_MAX_VIDEOS = 10;
export const SOURCE_MAX_SECONDS = 180;
export const SOURCE_MAX_BYTES = 200 * 1024 * 1024;
export const MAX_IDEA_RUNS = 8;          // idea generations included with one analysis
export const SCENE_CLIP_SECONDS = "5";   // each full-video scene is one 5s clip

export type SeriesMode = "single" | "series";
export type OutputType = "script" | "storyboard" | "video" | "avatar";

// ---------------------------------------------------------------- pricing

export const PRICING = {
  single: { key: "series_cloner_single", fallback: 80 },
  series: { key: "series_cloner_series", fallback: 150 },
  script: { key: "series_cloner_script", fallback: 20 },
  storyboard: { key: "series_cloner_storyboard", fallback: 30 },
  avatar: { key: "series_cloner_avatar", fallback: 60 },
} as const;

export interface EpisodePrices { script: number; storyboard: number; avatar: number }

export const pricesFrom = (p: Record<string, number>): EpisodePrices => ({
  script: p[PRICING.script.key] ?? PRICING.script.fallback,
  storyboard: p[PRICING.storyboard.key] ?? PRICING.storyboard.fallback,
  avatar: p[PRICING.avatar.key] ?? PRICING.avatar.fallback,
});

/**
 * Tokens charged up front for an episode. A storyboard includes its script; a
 * full video is a storyboard plus one model-priced clip per scene (charged per
 * scene as each clip starts); an avatar video is a script plus the avatar.
 */
export function episodeBasePrice(output: OutputType, p: EpisodePrices): number {
  if (output === "script") return p.script;
  if (output === "avatar") return p.script + p.avatar;
  return p.storyboard;
}

// ---------------------------------------------------------------- analysis

export type HumanType = "real_adult" | "real_child" | "real_elderly" | "ai_realistic_human" | "ai_stylized_human" | "not_human";
export type Modifier = "normal_proportions" | "age_swapped" | "hybrid_object_head" | "animal" | "fantasy_creature" | "miniaturized" | "giant";
export type RenderingStyle = "real_footage" | "photorealistic_ai" | "semi_realistic_ai" | "stylized_animated";

export const HUMAN_TYPE_LABELS: Record<HumanType, string> = {
  real_adult: "Real adults", real_child: "Real children", real_elderly: "Real elderly people",
  ai_realistic_human: "AI humans (realistic)", ai_stylized_human: "AI humans (stylized)", not_human: "Non-human characters",
};
export const MODIFIER_LABELS: Record<Modifier, string> = {
  normal_proportions: "Normal proportions", age_swapped: "Age-swapped (kids as adults)", hybrid_object_head: "Hybrid (object or fruit head)",
  animal: "Animal characters", fantasy_creature: "Fantasy creatures", miniaturized: "Miniature scale", giant: "Giant scale",
};
export const RENDERING_LABELS: Record<RenderingStyle, string> = {
  real_footage: "Real video footage", photorealistic_ai: "Photorealistic AI", semi_realistic_ai: "Semi-realistic AI", stylized_animated: "Stylized or animated",
};

/** GPT-4o Vision's reading of one source video */
export interface VideoVision {
  summary: string;
  characters: {
    label: string;
    human_type: HumanType;
    age_look: "child" | "teen" | "adult" | "elderly" | "unclear";
    modifiers: Modifier[];
    appearance: string;
    outfit: string;
    props: string[];
    color_palette: string[];
    consistency_markers: string[];
  }[];
  rendering_style: RenderingStyle;
  setting: string;
  camera_and_editing: string;
  text_overlays: { present: boolean; style: string; examples: string[] };
  hook_visual: string;
  pacing: string;
  contains_identifiable_real_people: boolean;
}

export interface FormulaCard {
  series_type: string;
  character_type: string;
  format: string;
  hook_style: string;
  text_overlay_style: string;
  episode_structure: string;
  consistency_elements: string[];
  tone: string;
}

export interface Detection {
  summary_label: string;
  human_type: HumanType;
  modifiers: Modifier[];
  rendering_style: RenderingStyle;
  contains_real_people: boolean;
}

export interface CastMember {
  name: string;
  role: string;
  look: string;
  outfit: string;
  props: string[];
  palette: string[];
}

export interface Concept { title: string; description: string }

export interface FormulaResult {
  title: string;
  formula: FormulaCard;
  detection: Detection;
  cast: CastMember[];
  style_prompt: string;
  alternative_concepts: Concept[];
}

// ---------------------------------------------------------------- customization + ideas

export type CharacterMode = "keep" | "nationality" | "concept" | "reference" | "profiles";

export interface Customization {
  character_mode: CharacterMode;
  nationality: string;
  concept_index: number;
  reference_url: string | null;
  profile_ids: string[];
  language_code: string;
  accent: string;
  gender: VoiceGender;
  topic: string;
}

export interface Idea {
  title: string;
  hook: string;
  scenes: { beat: string; visual: string; dialogue: string }[];
  character_direction: string;
  text_overlays: string[];
  ending: string;
}

// ---------------------------------------------------------------- episodes

export interface EpisodeScript {
  title: string;
  caption: string;
  scenes: { visual_prompt: string; dialogue: string; speaker: string; on_screen_text: string }[];
  narration: string;
}

export interface CharacterProfile {
  id: string;
  name: string;
  reference_image_url: string;
  style_description: string;
  character_type: string | null;
  created_at: string;
}

export const NATIONALITIES = [
  "American", "British", "Nigerian", "Ghanaian", "Kenyan", "South African", "French", "German", "Italian", "Spanish",
  "Russian", "Indian", "Pakistani", "Chinese", "Japanese", "Korean", "Filipino", "Vietnamese", "Brazilian", "Mexican",
  "Colombian", "Egyptian", "Moroccan", "Saudi / Gulf", "Turkish", "Jamaican",
];

/** An episode as returned by the API */
export interface EpisodeView {
  id: string;
  formula_id: string;
  idea: Idea;
  output_type: OutputType;
  status: "scripting" | "scripted" | "storyboarding" | "animating" | "avatar" | "done" | "partial" | "failed";
  settings: { language_code: string; accent: string; gender: VoiceGender; aspect: "9:16" | "16:9" | "1:1"; profile_ids: string[] };
  script: EpisodeScript | null;
  sheet_url: string | null;
  frames: { index: number; url: string }[];
  video_url: string | null;
  cost: number;
  refunded: number;
  error: string | null;
  created_at: string;
}

/** A formula as returned by the API */
export interface FormulaView {
  id: string;
  mode: SeriesMode;
  status: "analyzing" | "ready" | "failed";
  title: string | null;
  source_count: number;
  result: FormulaResult | null;
  settings: { customization?: Customization; cast?: CastMember[]; style_prompt?: string };
  ideas: Idea[];
  idea_runs: number;
  created_at: string;
}
