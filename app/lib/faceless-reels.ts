// Faceless Reels: shared definitions for the Studio module, its API and the
// admin template manager. Templates live in the reel_templates table; the
// seeds below are what supabase/faceless_reels.sql inserts.

export type ReelMode = "template" | "own" | "oneoff";

/** Character families a template (or an own series) is built on. */
export const CHARACTER_KINDS = ["fruit_head", "object_head", "food", "animated", "mini_adult", "custom"] as const;
export type CharacterKind = typeof CHARACTER_KINDS[number];

export const REEL_CATEGORIES = ["drama", "comedy", "educational", "motivational", "cultural", "trending"] as const;
export type ReelCategory = typeof REEL_CATEGORIES[number];

export interface ReelTemplate {
  id: string;
  slug: string;
  name: string;
  category: ReelCategory;
  character_kind: CharacterKind;
  characters: string;      // who appears, e.g. "Two fruit-head figures"
  setting: string;
  style: string;           // rendering style
  formula: string;         // story beats every episode follows
  prompt_guide: string;    // extra direction for writers and image/video prompts
  image_preview_url: string | null;
  preview_urls: string[];
  disclaimer: string | null;
  cast_size: number;       // main characters with reference sheets (1-2)
  sort: number;
  is_active: boolean;
}

/** Visual tags that make two characters look alike (or not). */
export interface Fingerprint {
  gender: string;
  skin_tone: string;
  hair: string;            // colour + style, or "none" for object heads
  head: string;            // the fruit/object/food for hybrid heads, "human" otherwise
  outfit_colors: string[];
  outfit_style: string;
  accessories: string[];
  distinctive: string[];
}

export interface CharacterDesign {
  name: string;
  role: string;
  personality: string;
  look: string;            // self-contained appearance prompt, 40-80 words
  outfit: string;
  fingerprint: Fingerprint;
}

export interface ReelScene {
  shot: string;            // camera framing and what we see
  action: string;
  dialogue: string;        // spoken line(s), "" if none
  speaker: string;
  reaction: string;        // reaction shot after the beat ("" if none)
  overlay: string;         // 1-3 word bold caps overlay, "" if none
  seconds: number;
}

export interface EpisodeScript {
  title: string;
  hook: string;            // first 3 seconds
  scenes: ReelScene[];
  music_mood: string;
  ending: string;          // cliffhanger or resolution
  caption: string;         // social caption with hashtags
}

export interface EpisodeOutline { number: number; title: string; summary: string; ending: string }

export interface SeriesBible {
  title: string;
  logline: string;
  tone: string;
  world: string;           // setting details that stay consistent
  characters: CharacterDesign[];
  arc: string;             // overall story arc, 10-20 episodes
  episode_1: EpisodeScript;
  outlines: EpisodeOutline[];   // episodes 2-5
  directions: string[];         // ideas for episode 6+
}

// ---- reference sheet: 8 images per character ----

export const SHEET_VIEWS = [
  { id: "front", label: "Front view, full body, standing, arms relaxed" },
  { id: "three_quarter", label: "Three-quarter view, full body" },
  { id: "side", label: "Side profile view, full body" },
  { id: "back", label: "Back view, full body" },
  { id: "happy", label: "Close-up portrait, neutral to happy expression" },
  { id: "suspicious", label: "Close-up portrait, suspicious side-eye expression" },
  { id: "angry", label: "Close-up portrait, angry yelling expression, mouth open" },
  { id: "shocked", label: "Close-up portrait, disgusted or shocked expression" },
] as const;

// ---- pricing (token_pricing keys; fallbacks match the brief) ----

export const REEL_PRICING = {
  oneoff: { key: "faceless_reels_oneoff", fallback: 60 },
  episode: { key: "faceless_reels_episode", fallback: 50 },
  bible: { key: "faceless_reels_bible", fallback: 30 },
  concept: { key: "faceless_reels_concept", fallback: 20 },
  sheet: { key: "faceless_reels_sheet", fallback: 20 },
} as const;

export const REEL_DURATIONS = [15, 30, 45, 60] as const;
export const MINI_ADULT_DISCLAIMER = "Characters are fully AI-generated. No real children are used.";

// ---- character uniqueness ----

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const words = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 2));

function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let n = 0;
  a.forEach((x) => { if (b.has(x)) n++; });
  return n / Math.min(a.size, b.size);
}

/** 0..1: how alike two characters look (1 = indistinguishable). */
export function fingerprintSimilarity(a: Fingerprint, b: Fingerprint): number {
  const same = (x: string, y: string) => (norm(x) && norm(x) === norm(y) ? 1 : overlap(words(x), words(y)) >= 0.6 ? 0.6 : 0);
  const parts: [number, number][] = [
    [same(a.head, b.head), 3],
    [same(a.skin_tone, b.skin_tone), 2],
    [same(a.hair, b.hair), 2],
    [same(a.gender, b.gender), 1],
    [overlap(new Set(a.outfit_colors.map(norm)), new Set(b.outfit_colors.map(norm))), 2],
    [same(a.outfit_style, b.outfit_style), 1.5],
    [overlap(new Set(a.accessories.map(norm)), new Set(b.accessories.map(norm))), 1],
    [overlap(new Set(a.distinctive.map(norm)), new Set(b.distinctive.map(norm))), 1],
  ];
  const total = parts.reduce((s, [, w]) => s + w, 0);
  return parts.reduce((s, [v, w]) => s + v * w, 0) / total;
}

/** Above this, a new character is too close to an existing one and is redesigned. */
export const SIMILARITY_LIMIT = 0.72;

export const fingerprintLine = (f: Fingerprint) =>
  [f.gender, f.head !== "human" ? `${f.head} head` : "", f.skin_tone, f.hair, f.outfit_style, f.outfit_colors.join("/"), f.accessories.join(", "), f.distinctive.join(", ")]
    .filter(Boolean).join("; ");

// ---- template seeds (also inserted by supabase/faceless_reels.sql) ----

type Seed = Omit<ReelTemplate, "id" | "image_preview_url" | "preview_urls" | "is_active">;

// Shared direction drawn from the reference videos: vertical, fast cuts every
// 1.5-3s, reaction shots after every beat, 1-3 word bold caps overlays, a hook
// line in the first second, short punchy dialogue, cliffhanger endings.
export const TEMPLATE_SEEDS: Seed[] = [
  { slug: "fruit-head-couple-drama", cast_size: 2, name: "Fruit Head Couple Drama", category: "drama", character_kind: "fruit_head", sort: 10,
    characters: "Two fruit-head figures in a relationship (human bodies, glossy realistic fruit heads with expressive faces)",
    setting: "Modern home interior: living room, kitchen, bedroom", style: "Photorealistic 3D render, soft cinematic lighting, shallow depth of field",
    formula: "Conflict → misunderstanding → escalation → resolution or cliffhanger",
    prompt_guide: "Soap-opera melodrama played straight. Open on the accusation line. Close-ups on faces between lines, slow push-ins on reveals. End on a twist line or a door closing.", disclaimer: null },
  { slug: "object-head-office-drama", cast_size: 2, name: "Object Head Office Drama", category: "drama", character_kind: "object_head", sort: 20,
    characters: "Office workers with everyday tech objects for heads: phone-head, laptop-head, printer-head",
    setting: "Corporate open-plan office, meeting room, break room", style: "Photorealistic 3D, cool office lighting",
    formula: "Workplace conflict → escalation → twist",
    prompt_guide: "Deadpan workplace comedy-drama. Screens on the heads show emotions (emoji-like icons, battery levels). Cut to coworkers reacting.", disclaimer: null },
  { slug: "animated-neighborhood-drama", cast_size: 2, name: "Animated Neighborhood Drama", category: "drama", character_kind: "animated", sort: 30,
    characters: "Stylized 3D animated neighbours with exaggerated proportions",
    setting: "Suburban street, front lawns, porches, fences", style: "Pixar-adjacent 3D animation, warm saturated colours",
    formula: "Neighbour conflict → drama → resolution",
    prompt_guide: "Petty feud energy: over-the-fence stares, curtains twitching, dramatic zooms. Keep each line short and quotable.", disclaimer: null },
  { slug: "mini-adult-kids", cast_size: 2, name: "Mini Adult Kids", category: "comedy", character_kind: "mini_adult", sort: 40,
    characters: "AI-generated toddlers dressed and acting like grown adults: streetwear, chains, suits, sunglasses",
    setting: "Real-world adult scenarios: diners, sidewalks, backyards, offices, parties", style: "Photorealistic AI characters, handheld phone-camera look, natural light",
    formula: "Kids in an adult situation → comedy contrast → escalation → punchline",
    prompt_guide: "Two-hander banter: one kid proposes a bad idea, the other warns 'Don't.', it happens anyway, an adult or another kid delivers the verdict. Openers like 'Bro…' as a question about something on screen. Cut to faces reacting after every line.",
    disclaimer: "Characters are fully AI-generated. No real children are used." },
  { slug: "food-character-daily-life", cast_size: 1, name: "Food Character Daily Life", category: "comedy", character_kind: "food", sort: 50,
    characters: "Anthropomorphic food items with faces, arms and legs (a burger, a croissant, a sushi roll)",
    setting: "Everyday human places: commute, gym, supermarket, office", style: "Photorealistic 3D, bright natural lighting",
    formula: "Food character in the human world → absurd situations → humour",
    prompt_guide: "Lean into food puns and physical comedy (melting, crumbs, sauce). Humans react in the background.", disclaimer: null },
  { slug: "object-romance", cast_size: 2, name: "Object Romance", category: "drama", character_kind: "object_head", sort: 60,
    characters: "Everyday objects as lovers (a coffee mug and a teaspoon, a sneaker and a sock)",
    setting: "Various romantic locations: café, rainy street, rooftop", style: "Photorealistic 3D, romantic warm grade",
    formula: "Love story → obstacle → dramatic resolution",
    prompt_guide: "Play it like a romance trailer: slow motion, longing looks, a dramatic obstacle (the dishwasher, the washing machine).", disclaimer: null },
  { slug: "fruit-head-explainer", cast_size: 1, name: "Fruit Head Explainer", category: "educational", character_kind: "fruit_head", sort: 70,
    characters: "A professional fruit-head presenter in smart clothes",
    setting: "Clean modern studio or office with a screen", style: "Photorealistic 3D, bright studio lighting",
    formula: "Hook → explanation → surprising fact → call to action",
    prompt_guide: "Fast explainer: a bold claim in the first second, 2-3 punchy points with on-screen keywords, a surprising fact, a follow CTA.", disclaimer: null },
  { slug: "animated-news-reporter", cast_size: 2, name: "Animated News Reporter", category: "educational", character_kind: "animated", sort: 80,
    characters: "A stylized news anchor and a field reporter",
    setting: "News studio with screens, on-location street shots", style: "3D animation, broadcast lighting, lower-third graphics",
    formula: "Breaking news → story → opinion → outro",
    prompt_guide: "Mock-serious news tone about everyday or trending topics. 'BREAKING' overlay in the hook, cut to the field reporter, end with a sign-off line.", disclaimer: null },
  { slug: "object-head-entrepreneur", cast_size: 1, name: "Object Head Entrepreneur", category: "motivational", character_kind: "object_head", sort: 90,
    characters: "A briefcase-head or money-bag-head entrepreneur and the people around them",
    setting: "Small office, city streets, luxury settings", style: "Photorealistic 3D, cinematic grade",
    formula: "Struggle → breakthrough → success tip → inspire",
    prompt_guide: "Rise-and-grind arc in seconds: rejection, late nights, the turning point, the win. One concrete tip at the end.", disclaimer: null },
  { slug: "fruit-head-life-advice", cast_size: 2, name: "Fruit Head Life Advice", category: "motivational", character_kind: "fruit_head", sort: 100,
    characters: "A wise elder fruit character and a younger listener",
    setting: "Peaceful nature: a bench by a lake, a garden, a porch at sunset", style: "Soft 3D render, golden hour",
    formula: "Life lesson → short story → wisdom → actionable tip",
    prompt_guide: "Calm, warm voice. One short parable, a line of wisdom, and one thing to do today.", disclaimer: null },
  { slug: "traditional-tale-retold", cast_size: 2, name: "Traditional Tale Retold", category: "cultural", character_kind: "object_head", sort: 110,
    characters: "Object-head characters in traditional dress from the tale's culture",
    setting: "Traditional village or palace, fused with modern details", style: "Artistic 3D, rich colours",
    formula: "Classic story → modern twist → moral lesson",
    prompt_guide: "Retell a well-known folk tale or fable respectfully, add one modern twist, end on the moral.", disclaimer: null },
  { slug: "historical-drama", cast_size: 2, name: "Historical Drama", category: "cultural", character_kind: "object_head", sort: 120,
    characters: "Period-appropriate object-head figures (quill-head scribes, crown-head rulers)",
    setting: "Historical locations of the chosen era", style: "Cinematic 3D, period lighting",
    formula: "Historical event → dramatised scene → educational reveal",
    prompt_guide: "Dramatise a real historical moment without depicting real people's likenesses: characters are object heads. End with the real fact.", disclaimer: null },
  { slug: "pov-story", cast_size: 1, name: "POV Story", category: "trending", character_kind: "object_head", sort: 130,
    characters: "First-person POV with object-head characters around the viewer",
    setting: "Varies by story", style: "Photorealistic 3D, first-person camera",
    formula: "'POV: you are…' → story → twist",
    prompt_guide: "The camera is the viewer. Characters talk to the lens. The twist lands in the last 3 seconds.", disclaimer: null },
  { slug: "roast-reaction", cast_size: 2, name: "Roast / Reaction", category: "trending", character_kind: "object_head", sort: 140,
    characters: "Expressive object heads reacting on a panel",
    setting: "Reaction studio: couch, ring light, screen", style: "3D expressive, studio lighting",
    formula: "Setup → escalating reactions → punchline",
    prompt_guide: "Each line tops the last. Quick cuts between panel members' faces. The punchline gets the biggest reaction.", disclaimer: null },
  { slug: "before-after-transformation", cast_size: 1, name: "Before/After Transformation", category: "trending", character_kind: "fruit_head", sort: 150,
    characters: "A fruit or object head going through a transformation",
    setting: "Fits the transformation: gym, closet, kitchen, studio", style: "3D cinematic",
    formula: "Problem → journey (montage) → transformation reveal",
    prompt_guide: "Start low (messy, tired), montage of effort with on-screen day counters, slow-motion reveal at the end.", disclaimer: null },
];
