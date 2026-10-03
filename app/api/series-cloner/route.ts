import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { attachTask, claimCharge, completeCharge, getCharge, getTokenPrice, refundCharge, releaseClaim } from "../../lib/charges";
import { getTaskStatus } from "../../lib/task-status";
import { TranscriptionError, transcribeVideoUrl } from "../../lib/whisper";
import { structured, type LlmKeys } from "../../lib/llm";
import { speak } from "../../lib/elevenlabs";
import { ACTOR_SWAP_LANGUAGES } from "../../lib/actor-swap";
import {
  MAX_IDEA_RUNS, NATIONALITIES, PRICING, SERIES_MAX_VIDEOS, SERIES_MIN_VIDEOS, episodeBasePrice,
  type CastMember, type CharacterProfile, type Customization, type EpisodeScript, type FormulaResult, type Idea,
  type OutputType, type SeriesMode, type VideoVision,
} from "../../lib/series-cloner";

// Whisper + vision, or one Claude call, per request
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STORAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/generation-inputs/`;
const STALE_EPISODE_MS = 30 * 60 * 1000;
const ASPECTS = ["9:16", "16:9", "1:1"] as const;
type Aspect = typeof ASPECTS[number];
const IMAGE_ASPECT: Record<Aspect, string> = { "9:16": "2:3", "16:9": "3:2", "1:1": "1:1" };

// ---------------------------------------------------------------- rows

interface FormulaRow {
  id: string;
  user_id: string;
  charge_id: string | null;
  mode: SeriesMode;
  status: "analyzing" | "ready" | "failed";
  title: string | null;
  source_count: number;
  sources: unknown[];
  result: FormulaResult | null;
  settings: { customization?: Customization; cast?: CastMember[]; style_prompt?: string };
  ideas: Idea[];
  idea_runs: number;
  created_at: string;
}

interface EpisodeRow {
  id: string;
  user_id: string;
  formula_id: string;
  charge_id: string | null;
  idea: Idea;
  output_type: OutputType;
  status: "scripting" | "scripted" | "storyboarding" | "animating" | "avatar" | "done" | "partial" | "failed";
  settings: { language_code: string; accent: string; gender: "female" | "male"; aspect: Aspect; profile_ids: string[] };
  script: EpisodeScript | null;
  sheet_url: string | null;
  frames: { index: number; url: string }[];
  tasks: { sheet?: string; scenes?: string[]; portrait?: string; avatar?: string };
  audio_url: string | null;
  video_url: string | null;
  cost: number;
  refunded: number;
  error: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------- helpers

async function getSetting(key: string): Promise<string> {
  const { data } = await supabase.from("admin_settings").select("value").eq("key", key).single();
  return data?.value ?? "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider responses are untyped
async function safeJson(res: Response): Promise<any> {
  try { const t = await res.text(); return t ? JSON.parse(t) : {}; } catch { return {}; }
}

async function llmKeys(): Promise<LlmKeys> {
  const [claude, openai] = await Promise.all([getSetting("claude_api_key"), getSetting("openai_api_key")]);
  return { claude, openai };
}

const ours = (u: unknown): u is string => typeof u === "string" && u.startsWith(STORAGE_PREFIX);
const languageName = (code: string) => ACTOR_SWAP_LANGUAGES.find((l) => l.code === code)?.name ?? "English";
const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

async function copyToStorage(url: string, path: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't download a generated image (${res.status})`);
  const type = res.headers.get("content-type") ?? "image/png";
  const bytes = new Uint8Array(await res.arrayBuffer());
  const { error } = await supabase.storage.from("generation-inputs").upload(path, bytes, { contentType: type, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return supabase.storage.from("generation-inputs").getPublicUrl(path).data.publicUrl;
}

async function kieImageTask(prompt: string, aspect: Aspect, inputUrls: string[] = []): Promise<string> {
  const key = await getSetting("kie_api_key");
  if (!key) throw new Error("Image generation isn't configured.");
  const body = inputUrls.length
    ? { model: "gpt-image/1.5-image-to-image", input: { prompt, input_urls: inputUrls.slice(0, 4), aspect_ratio: IMAGE_ASPECT[aspect], quality: "medium" } }
    : { model: "gpt-image/1.5-text-to-image", input: { prompt, aspect_ratio: IMAGE_ASPECT[aspect] } };
  const res = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  const data = await safeJson(res);
  const taskId = data.data?.taskId ?? data.data?.task_id;
  if (data.code !== 200 || !taskId) throw new Error(data.msg ?? "Couldn't start image generation.");
  return String(taskId);
}

async function getProfiles(userId: string, ids: string[]): Promise<CharacterProfile[]> {
  if (!ids.length) return [];
  const { data } = await supabase.from("character_profiles").select("*").eq("user_id", userId).in("id", ids.slice(0, 3));
  return (data ?? []) as CharacterProfile[];
}

// ---------------------------------------------------------------- AI: vision

const CHARACTER_ITEM = {
  type: "object",
  properties: {
    label: { type: "string", description: "Short role label, e.g. 'boy acting as a bank manager'" },
    human_type: { type: "string", enum: ["real_adult", "real_child", "real_elderly", "ai_realistic_human", "ai_stylized_human", "not_human"] },
    age_look: { type: "string", enum: ["child", "teen", "adult", "elderly", "unclear"] },
    modifiers: { type: "array", items: { type: "string", enum: ["normal_proportions", "age_swapped", "hybrid_object_head", "animal", "fantasy_creature", "miniaturized", "giant"] } },
    appearance: { type: "string", description: "Generic look: type, build, hair, colours, art style. No identity." },
    outfit: { type: "string" },
    props: { type: "array", items: { type: "string" } },
    color_palette: { type: "array", items: { type: "string" } },
    consistency_markers: { type: "array", items: { type: "string" }, description: "What makes this character recognisable across episodes" },
  },
  required: ["label", "human_type", "age_look", "modifiers", "appearance", "outfit", "props", "color_palette", "consistency_markers"],
  additionalProperties: false,
};

const VISION_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "What happens in the video, 1-3 sentences" },
    characters: { type: "array", items: CHARACTER_ITEM },
    rendering_style: { type: "string", enum: ["real_footage", "photorealistic_ai", "semi_realistic_ai", "stylized_animated"] },
    setting: { type: "string" },
    camera_and_editing: { type: "string" },
    text_overlays: {
      type: "object",
      properties: { present: { type: "boolean" }, style: { type: "string" }, examples: { type: "array", items: { type: "string" } } },
      required: ["present", "style", "examples"],
      additionalProperties: false,
    },
    hook_visual: { type: "string", description: "What the first seconds show" },
    pacing: { type: "string" },
    contains_identifiable_real_people: { type: "boolean" },
  },
  required: ["summary", "characters", "rendering_style", "setting", "camera_and_editing", "text_overlays", "hook_visual", "pacing", "contains_identifiable_real_people"],
  additionalProperties: false,
};

const VISION_SYSTEM = `You analyse short-form videos for a creator tool. You see frames from one video in time order (the first frames cover the opening seconds) and its transcript. Describe the characters, visuals and on-screen text precisely so the creator can make an ORIGINAL series in the same style.

Character detection:
- List every recurring on-screen character.
- human_type: real_adult / real_child / real_elderly are real filmed people. ai_realistic_human is an AI-generated photoreal human (tells: flawless skin, uncanny smoothness, morphing hands or text, impossible consistency). ai_stylized_human is an AI human with a 3D, cartoon or illustrated look. not_human is an animal, object or creature.
- modifiers: age_swapped means children or babies performing adult roles, jobs, dialogue or settings (a toddler CEO, a child doctor), or adults shown as babies. hybrid_object_head means a human body with a fruit, vegetable, object or animal head. miniaturized or giant means unusual scale against the environment. animal and fantasy_creature as named. normal_proportions when none apply.
- Describe appearance generically (type, approximate age look, build, hair, colours, clothing, art style). Never name, identify or guess the identity of anyone, and never describe a real person's face in identifying detail.
- contains_identifiable_real_people is true if any character is a real filmed person rather than AI.

Text overlays: font style, colours, placement and frequency, with up to 3 quoted examples.
Be concrete. Say "unclear" rather than guessing.`;

// ---------------------------------------------------------------- AI: formula

const CAST_ITEM = {
  type: "object",
  properties: {
    name: { type: "string" },
    role: { type: "string" },
    look: { type: "string", description: "Self-contained visual description for image prompts, 30-60 words" },
    outfit: { type: "string" },
    props: { type: "array", items: { type: "string" } },
    palette: { type: "array", items: { type: "string" } },
  },
  required: ["name", "role", "look", "outfit", "props", "palette"],
  additionalProperties: false,
};

const FORMULA_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Working name for the creator's new series" },
    formula: {
      type: "object",
      properties: {
        series_type: { type: "string" },
        character_type: { type: "string" },
        format: { type: "string", description: "Typical duration and structure" },
        hook_style: { type: "string" },
        text_overlay_style: { type: "string" },
        episode_structure: { type: "string", description: "The beats every episode follows, in order" },
        consistency_elements: { type: "array", items: { type: "string" } },
        tone: { type: "string" },
      },
      required: ["series_type", "character_type", "format", "hook_style", "text_overlay_style", "episode_structure", "consistency_elements", "tone"],
      additionalProperties: false,
    },
    detection: {
      type: "object",
      properties: {
        summary_label: { type: "string", description: "Completes 'We detected: ...', e.g. 'AI-generated kids acting as adults in a photorealistic style'" },
        human_type: { type: "string", enum: ["real_adult", "real_child", "real_elderly", "ai_realistic_human", "ai_stylized_human", "not_human"] },
        modifiers: { type: "array", items: { type: "string", enum: ["normal_proportions", "age_swapped", "hybrid_object_head", "animal", "fantasy_creature", "miniaturized", "giant"] } },
        rendering_style: { type: "string", enum: ["real_footage", "photorealistic_ai", "semi_realistic_ai", "stylized_animated"] },
        contains_real_people: { type: "boolean" },
      },
      required: ["summary_label", "human_type", "modifiers", "rendering_style", "contains_real_people"],
      additionalProperties: false,
    },
    cast: { type: "array", items: CAST_ITEM },
    style_prompt: { type: "string", description: "Visual style anchor for every prompt, 30-60 words, no character details" },
    alternative_concepts: {
      type: "array",
      items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" } }, required: ["title", "description"], additionalProperties: false },
    },
  },
  required: ["title", "formula", "detection", "cast", "style_prompt", "alternative_concepts"],
  additionalProperties: false,
};

const FORMULA_SYSTEM = `You are a showrunner who reverse-engineers viral short-form video series. From analyses of the source videos (frames read by a vision model) and their transcripts, you extract the repeatable formula and design an ORIGINAL cast for the creator.

Rules:
- The formula is practical and specific: series type, character type, typical length and structure, hook pattern, text overlay style, the beats each episode follows, the elements that stay consistent across episodes, and tone.
- Detection reflects what the sources actually show (character type, modifiers, rendering style).
- The new cast keeps the same concept (same kind of characters, modifiers and rendering style) but every character is brand new: own name, look, outfit and colour palette. Never copy the source characters' faces or distinctive identity, and never resemble real people or celebrities.
- Characters who are children, or age-swapped, stay wholesome and age-appropriate.
- 1 to 4 cast members; the lead first.
- style_prompt describes rendering style, lighting, camera, colour grade and setting type only.
- alternative_concepts: exactly 5 fresh character concepts that would work with the same formula.
- If there is only one source video, treat it as episode one of a potential series.`;

// ---------------------------------------------------------------- AI: ideas + scripts

const IDEA_ITEM = {
  type: "object",
  properties: {
    title: { type: "string" },
    hook: { type: "string", description: "The opening line or moment" },
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: { beat: { type: "string" }, visual: { type: "string" }, dialogue: { type: "string" } },
        required: ["beat", "visual", "dialogue"],
        additionalProperties: false,
      },
    },
    character_direction: { type: "string" },
    text_overlays: { type: "array", items: { type: "string" } },
    ending: { type: "string", description: "Cliffhanger or punchline ending option" },
  },
  required: ["title", "hook", "scenes", "character_direction", "text_overlays", "ending"],
  additionalProperties: false,
};

const IDEAS_SCHEMA = {
  type: "object",
  properties: {
    cast: { type: "array", items: CAST_ITEM, description: "The cast to use, adapted to the customization" },
    style_prompt: { type: "string" },
    ideas: { type: "array", items: IDEA_ITEM },
  },
  required: ["cast", "style_prompt", "ideas"],
  additionalProperties: false,
};

const SCRIPT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    caption: { type: "string", description: "Social caption with 3-5 hashtags" },
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          visual_prompt: { type: "string" },
          dialogue: { type: "string" },
          speaker: { type: "string" },
          on_screen_text: { type: "string" },
        },
        required: ["visual_prompt", "dialogue", "speaker", "on_screen_text"],
        additionalProperties: false,
      },
    },
    narration: { type: "string" },
  },
  required: ["title", "caption", "scenes", "narration"],
  additionalProperties: false,
};

const SAFETY = `- Never reference or imitate real people, celebrities, brands or copyrighted characters.
- Characters who are children or age-swapped stay wholesome and age-appropriate: no romance, violence, danger or adult themes involving them.`;

function languageRules(c: { language_code: string; accent: string }) {
  const lang = languageName(c.language_code);
  return `- Dialogue, on-screen text and captions are in ${lang}${c.accent ? `, with a natural ${c.accent} flavour in word choice and phrasing (never caricature or phonetic spelling)` : ""}.
- Everything else (titles, beats, visual descriptions, direction) is in English.`;
}

function castBlock(cast: CastMember[], style: string) {
  return `Cast:\n${cast.map((c) => `- ${c.name} (${c.role}): ${c.look} Outfit: ${c.outfit}. Props: ${c.props.join(", ") || "none"}. Palette: ${c.palette.join(", ") || "-"}.`).join("\n")}\nVisual style: ${style}`;
}

function characterInstruction(c: Customization, result: FormulaResult, profiles: CharacterProfile[]): string {
  switch (c.character_mode) {
    case "nationality":
      return `Recast the characters as ${c.nationality}: names, styling, setting details and everyday culture should feel authentically ${c.nationality}, respectfully and without stereotypes. Keep the same character concept and rendering style.`;
    case "concept": {
      const concept = result.alternative_concepts[c.concept_index];
      return concept ? `Use this character concept instead of the original one: ${concept.title}: ${concept.description}. Design a fitting new cast.` : "Keep the same character concept with the new original cast.";
    }
    case "reference":
      return "The lead character will be generated from a reference image the creator uploaded, used for outfit, colours and art style only (the face is new and original). Keep the lead's description general enough to match that image, and design the rest of the cast to fit.";
    case "profiles":
      return `Use the creator's saved characters as the cast, exactly as described (keep their names):\n${profiles.map((p) => `- ${p.name}: ${p.style_description}`).join("\n")}`;
    default:
      return "Keep the same character concept and the new original cast as designed.";
  }
}

// ---------------------------------------------------------------- episodes: settle

async function settleEpisode(ep: EpisodeRow, outcome: "done" | "partial", patch: Partial<EpisodeRow> = {}) {
  let refunded = 0;
  if (ep.charge_id) {
    const charge = await getCharge(ep.charge_id);
    if (outcome === "partial" && charge && (charge.status === "charged" || charge.status === "partially_refunded")) {
      // The script was delivered; refund everything beyond it
      const scriptPrice = await getTokenPrice(PRICING.script.key, PRICING.script.fallback);
      const amount = charge.amount - charge.refunded_amount - scriptPrice;
      if (amount > 0) {
        const r = await refundCharge(ep.charge_id, ep.user_id, amount);
        refunded = r.refunded ?? 0;
      }
    }
    await completeCharge(ep.charge_id, ep.user_id, ep.id);
  }
  const update = { ...patch, status: outcome, refunded: ep.refunded + refunded, updated_at: new Date().toISOString() };
  await supabase.from("series_episodes").update(update).eq("id", ep.id);
  Object.assign(ep, update);
}

// Collects the storyboard from the provider (results are read by the server,
// never taken from the client) and settles the episode's charge.
async function finishStoryboard(ep: EpisodeRow, giveUp: boolean): Promise<"pending" | "settled"> {
  const scenes = ep.tasks.scenes ?? [];
  const statuses = await Promise.all(scenes.map((t) => (t ? getTaskStatus(t, "kie").catch(() => null) : Promise.resolve({ failed: true, completed: false, video_url: null }))));
  if (!giveUp && statuses.some((st) => st && !st.completed && !st.failed)) return "pending";
  const frames: { index: number; url: string }[] = [];
  for (let i = 0; i < statuses.length; i++) {
    const st = statuses[i];
    if (st?.completed && st.video_url) {
      frames.push({ index: i, url: await copyToStorage(st.video_url, `series-cloner/${ep.id}/frame-${i}.png`).catch(() => st.video_url!) });
    }
  }
  let sheetUrl: string | null = null;
  if (ep.tasks.sheet) {
    const st = await getTaskStatus(ep.tasks.sheet, "kie").catch(() => null);
    if (st?.completed && st.video_url) sheetUrl = await copyToStorage(st.video_url, `series-cloner/${ep.id}/sheet.png`).catch(() => st.video_url!);
  }
  if (!frames.length) {
    await settleEpisode(ep, "partial", { sheet_url: sheetUrl, error: "The storyboard images couldn't be created." });
  } else {
    await settleEpisode(ep, "done", { frames, sheet_url: sheetUrl });
    if (ep.output_type === "video") {
      // Storyboard paid; scene clips are charged separately as they start
      await supabase.from("series_episodes").update({ status: "animating" }).eq("id", ep.id);
      ep.status = "animating";
    }
  }
  return "settled";
}

// Episodes abandoned mid-way (page closed) are settled the next time they're
// loaded, delivering whatever the providers finished
async function settleStale(episodes: EpisodeRow[]) {
  for (const ep of episodes) {
    if (!["scripted", "storyboarding", "avatar"].includes(ep.status) || ep.output_type === "script") continue;
    if (Date.now() - new Date(ep.updated_at).getTime() < STALE_EPISODE_MS) continue;
    if (ep.status === "storyboarding") { await finishStoryboard(ep, true); continue; }
    if (ep.status === "avatar" && ep.tasks.avatar) {
      const st = await getTaskStatus(ep.tasks.avatar, "heygen_v3").catch(() => null);
      if (st?.completed && st.video_url) { await settleEpisode(ep, "done", { video_url: st.video_url }); continue; }
    }
    await settleEpisode(ep, "partial", { error: "Stopped before finishing." });
  }
}

// ---------------------------------------------------------------- handler

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if ((await getSetting("series_cloner_enabled")) !== "true") {
      return NextResponse.json({ error: "Series Cloner isn't available right now." }, { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- validated field by field below
    const body = await req.json() as Record<string, any>;
    const action = String(body.action ?? "");

    const loadFormula = async (): Promise<FormulaRow | null> => {
      if (typeof body.formula_id !== "string") return null;
      const { data } = await supabase.from("series_formulas").select("*").eq("id", body.formula_id).eq("user_id", user.id).maybeSingle();
      return data as FormulaRow | null;
    };
    const loadEpisode = async (): Promise<EpisodeRow | null> => {
      if (typeof body.episode_id !== "string") return null;
      const { data } = await supabase.from("series_episodes").select("*").eq("id", body.episode_id).eq("user_id", user.id).maybeSingle();
      return data as EpisodeRow | null;
    };
    const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });
    // Episode steps after the script run on the charge attached to that episode
    const episodeChargeOk = async (ep: EpisodeRow) => {
      if (!ep.charge_id) return false;
      const charge = await getCharge(ep.charge_id);
      return !!charge && charge.status === "charged" && charge.task_id === `episode:${ep.id}`;
    };

    // ================================================================ library
    if (action === "library") {
      // Analyses abandoned mid-way (page closed) are refunded in full
      const { data: stuck } = await supabase.from("series_formulas").select("id, charge_id")
        .eq("user_id", user.id).eq("status", "analyzing").lt("created_at", new Date(Date.now() - STALE_EPISODE_MS).toISOString());
      for (const f of stuck ?? []) {
        if (f.charge_id) await refundCharge(f.charge_id, user.id);
        await supabase.from("series_formulas").update({ status: "failed", error: "Not finished", updated_at: new Date().toISOString() }).eq("id", f.id);
      }
      const [{ data: formulas }, { data: profiles }] = await Promise.all([
        supabase.from("series_formulas").select("id, mode, status, title, source_count, created_at").eq("user_id", user.id).neq("status", "failed").order("created_at", { ascending: false }).limit(30),
        supabase.from("character_profiles").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      ]);
      return NextResponse.json({ formulas: formulas ?? [], profiles: profiles ?? [] });
    }

    if (action === "get") {
      const f = await loadFormula();
      if (!f) return notFound();
      const { data } = await supabase.from("series_episodes").select("*").eq("formula_id", f.id).eq("user_id", user.id).order("created_at", { ascending: false }).limit(60);
      const episodes = (data ?? []) as EpisodeRow[];
      await settleStale(episodes);
      return NextResponse.json({ formula: f, episodes });
    }

    // ================================================================ analysis
    if (action === "start") {
      const mode: SeriesMode = body.mode === "series" ? "series" : "single";
      const count = Number(body.source_count);
      if (mode === "single" ? count !== 1 : !(count >= SERIES_MIN_VIDEOS && count <= SERIES_MAX_VIDEOS)) {
        return NextResponse.json({ error: mode === "single" ? "Upload one video." : `Upload ${SERIES_MIN_VIDEOS} to ${SERIES_MAX_VIDEOS} videos.` }, { status: 400 });
      }
      if (!(await getSetting("openai_api_key"))) return NextResponse.json({ error: "Series Cloner isn't configured yet." }, { status: 503 });
      const price = await getTokenPrice(PRICING[mode].key, PRICING[mode].fallback);
      const claim = await claimCharge(body.charge_id, price, user.id);
      if (claim.error) return NextResponse.json({ error: claim.error }, { status: 402 });

      const { data, error } = await supabase.from("series_formulas")
        .insert({ user_id: user.id, charge_id: body.charge_id, mode, source_count: count })
        .select("id").single();
      if (error || !data) {
        console.error("series_formulas insert:", error);
        await releaseClaim(body.charge_id);
        return NextResponse.json({ error: "Couldn't start the analysis. Run supabase/series_cloner.sql if this persists." }, { status: 500 });
      }
      await attachTask(body.charge_id, `formula:${data.id}`, "series_cloner");
      return NextResponse.json({ formula_id: data.id });
    }

    if (action === "analyze_video") {
      const f = await loadFormula();
      if (!f) return notFound();
      if (f.status !== "analyzing") return NextResponse.json({ error: "This analysis has finished." }, { status: 409 });
      const frames: string[] = (Array.isArray(body.frames) ? body.frames : [])
        .filter((d: unknown) => typeof d === "string" && d.startsWith("data:image/") && d.length < 400_000).slice(0, 8);
      if (!frames.length) return NextResponse.json({ error: "Couldn't read frames from this video." }, { status: 400 });
      const openaiKey = await getSetting("openai_api_key");
      const keys = { claude: await getSetting("claude_api_key"), openai: openaiKey };

      // Transcript (audio track extracted in the browser) and vision run together
      const transcriptP = ours(body.audio_url)
        ? transcribeVideoUrl(openaiKey, body.audio_url).catch((err) => {
            if (err instanceof TranscriptionError) return null;
            throw err;
          })
        : Promise.resolve(null);
      const seconds = Math.round(Number(body.seconds) || 0);
      const visionP = structured<VideoVision>(keys, {
        name: "video_vision", prefer: "openai", schema: VISION_SCHEMA, system: VISION_SYSTEM, images: frames,
        text: `Video "${clip(body.name, 80) || "untitled"}", ${seconds} seconds, ${frames.length} frames in time order. Transcript is analysed separately; describe what you see.`,
      });
      const [transcript, vision] = await Promise.all([transcriptP, visionP]);
      return NextResponse.json({ transcript: transcript?.text ?? "", vision });
    }

    if (action === "formula") {
      const f = await loadFormula();
      if (!f) return notFound();
      if (f.status === "ready") return NextResponse.json({ formula: f });
      if (f.status !== "analyzing") return NextResponse.json({ error: "This analysis failed." }, { status: 409 });
      const videos: { name: string; seconds: number; transcript: string; vision: VideoVision }[] = (Array.isArray(body.videos) ? body.videos : [])
        .slice(0, SERIES_MAX_VIDEOS)
        .map((v: Record<string, unknown>) => ({ name: clip(v.name, 80), seconds: Math.round(Number(v.seconds) || 0), transcript: clip(v.transcript, 4000), vision: v.vision as VideoVision }))
        .filter((v: { vision: unknown }) => v.vision && typeof v.vision === "object");
      if (videos.length < (f.mode === "series" ? SERIES_MIN_VIDEOS : 1)) {
        return NextResponse.json({ error: f.mode === "series" ? `At least ${SERIES_MIN_VIDEOS} videos need to be analysed.` : "The video couldn't be analysed." }, { status: 400 });
      }

      const text = [
        `${f.mode === "series" ? `A series of ${videos.length} videos` : "One video"} to reverse-engineer.`,
        ...videos.map((v, i) => `### Video ${i + 1}${v.name ? ` (${v.name})` : ""}, ${v.seconds}s\nVision analysis: ${JSON.stringify(v.vision)}\nTranscript: ${v.transcript || "(no speech)"}`),
        "Extract the formula, detection and a new original cast.",
      ].join("\n\n");
      const result = await structured<FormulaResult>(await llmKeys(), { name: "series_formula", schema: FORMULA_SCHEMA, system: FORMULA_SYSTEM, text, effort: "medium" });
      result.alternative_concepts = result.alternative_concepts.slice(0, 5);
      result.cast = result.cast.slice(0, 4);

      // A refund that raced this request wins: don't hand out the result
      const charge = f.charge_id ? await getCharge(f.charge_id) : null;
      if (!charge || charge.status !== "charged") {
        await supabase.from("series_formulas").update({ status: "failed", error: "Refunded", updated_at: new Date().toISOString() }).eq("id", f.id);
        return NextResponse.json({ error: "This analysis was cancelled." }, { status: 409 });
      }
      const sources = videos.map((v) => ({ name: v.name, seconds: v.seconds, transcript: v.transcript, vision: v.vision }));
      const { data: saved } = await supabase.from("series_formulas")
        .update({ status: "ready", title: clip(result.title, 120), result, sources, settings: { cast: result.cast, style_prompt: result.style_prompt }, updated_at: new Date().toISOString() })
        .eq("id", f.id).select("*").single();
      // Analysis delivered: the charge can no longer be refunded
      await completeCharge(f.charge_id!, user.id, f.id);
      return NextResponse.json({ formula: saved });
    }

    // ================================================================ ideas
    if (action === "ideas") {
      const f = await loadFormula();
      if (!f || f.status !== "ready" || !f.result) return notFound();
      if (f.idea_runs >= MAX_IDEA_RUNS) return NextResponse.json({ error: "You've used all the idea refreshes for this analysis." }, { status: 429 });
      const batch = body.batch === 1 ? 1 : 0;
      const c = body.customization ?? {};
      const customization: Customization = {
        character_mode: ["keep", "nationality", "concept", "reference", "profiles"].includes(c.character_mode) ? c.character_mode : "keep",
        nationality: NATIONALITIES.includes(c.nationality) ? c.nationality : "",
        concept_index: Math.min(4, Math.max(0, Math.round(Number(c.concept_index) || 0))),
        reference_url: ours(c.reference_url) ? c.reference_url : null,
        profile_ids: Array.isArray(c.profile_ids) ? c.profile_ids.filter((x: unknown) => typeof x === "string").slice(0, 3) : [],
        language_code: ACTOR_SWAP_LANGUAGES.some((l) => l.code === c.language_code) ? c.language_code : "en",
        accent: clip(c.accent, 60),
        gender: c.gender === "male" ? "male" : "female",
        topic: clip(c.topic, 500),
      };
      if (customization.character_mode === "nationality" && !customization.nationality) return NextResponse.json({ error: "Choose a nationality." }, { status: 400 });
      if (customization.character_mode === "reference" && !customization.reference_url) return NextResponse.json({ error: "Upload a reference image." }, { status: 400 });
      const profiles = customization.character_mode === "profiles" ? await getProfiles(user.id, customization.profile_ids) : [];
      if (customization.character_mode === "profiles" && !profiles.length) return NextResponse.json({ error: "Choose at least one saved character." }, { status: 400 });

      // Batch 1 continues batch 0 with the cast it settled on
      const cast = batch === 1 && f.settings.cast ? f.settings.cast : f.result.cast;
      const style = batch === 1 && f.settings.style_prompt ? f.settings.style_prompt : f.result.style_prompt;
      const kind = f.mode === "single"
        ? (batch === 0
            ? "Write 1 idea: the RECREATION of the source video with the new cast. Keep its exact beats, pacing and structure; change all wording and specifics."
            : "Write 5 VARIATIONS of the recreated video: each a different scenario using the same formula and cast.")
        : `Write 5 new episode ideas for the series${batch === 1 ? ", different from those already written" : ""}.`;
      const previous = batch === 1 ? f.ideas.map((i) => `- ${i.title}`).join("\n") : "";
      const system = `You write ready-to-produce short-form episodes that follow a proven series formula with an original cast.

Rules:
- Follow the formula's hook style, structure, pacing, text overlay style and tone. Change the stories.
- Every idea is clearly distinct.
- Use only the cast you return. ${batch === 1 ? "Return the cast and style exactly as given." : "Return the cast adapted to the character direction below (or unchanged if no change is asked)."}
- 4 to 6 scenes per idea, each about 5 seconds.
${languageRules(customization)}
${SAFETY}`;
      const text = [
        `Series formula: ${JSON.stringify(f.result.formula)}`,
        `What was detected in the sources: ${f.result.detection.summary_label}.`,
        castBlock(cast, style),
        `Character direction: ${batch === 1 ? "keep the cast as given." : characterInstruction(customization, f.result, profiles)}`,
        customization.topic ? `Topic: apply the formula to the creator's topic or product: ${customization.topic}` : "Topic: keep the kinds of scenarios found in the sources.",
        `Source summaries:\n${(f.sources as { vision?: VideoVision }[]).map((s, i) => `${i + 1}. ${s.vision?.summary ?? ""}`).join("\n")}`,
        previous ? `Ideas already written (don't repeat):\n${previous}` : "",
        kind,
      ].filter(Boolean).join("\n\n");

      const out = await structured<{ cast: CastMember[]; style_prompt: string; ideas: Idea[] }>(await llmKeys(), { name: "series_ideas", schema: IDEAS_SCHEMA, system, text, effort: "low" });
      const ideas = out.ideas.slice(0, 5);
      const settings = batch === 0
        ? { customization, cast: out.cast.slice(0, 4), style_prompt: out.style_prompt || style }
        : { ...f.settings, customization: f.settings.customization ?? customization };
      const allIdeas = batch === 0 ? ideas : [...f.ideas, ...ideas];
      await supabase.from("series_formulas").update({ ideas: allIdeas, settings, idea_runs: f.idea_runs + 1, updated_at: new Date().toISOString() }).eq("id", f.id);
      return NextResponse.json({ ideas: allIdeas, settings, runs_left: MAX_IDEA_RUNS - f.idea_runs - 1 });
    }

    // ================================================================ episode: script
    if (action === "script") {
      const f = await loadFormula();
      if (!f || f.status !== "ready" || !f.result) return notFound();
      const idx = Math.round(Number(body.idea_index));
      const idea = f.ideas[idx];
      if (!idea) return NextResponse.json({ error: "Choose an episode idea." }, { status: 400 });
      const output: OutputType = ["script", "storyboard", "video", "avatar"].includes(body.output) ? body.output : "script";
      const aspect: Aspect = ASPECTS.includes(body.aspect) ? body.aspect : "9:16";
      const cz = f.settings.customization;
      const language_code = ACTOR_SWAP_LANGUAGES.some((l) => l.code === body.language_code) ? body.language_code : (cz?.language_code ?? "en");
      const accent = clip(body.accent, 60) || cz?.accent || "";
      const gender = body.gender === "male" ? "male" : body.gender === "female" ? "female" : (cz?.gender ?? "female");
      if ((output === "storyboard" || output === "video") && !(await getSetting("kie_api_key"))) {
        return NextResponse.json({ error: "Storyboards aren't configured yet." }, { status: 503 });
      }
      if (output === "avatar") {
        const [hg, el] = await Promise.all([getSetting("heygen_api_key"), getSetting("elevenlabs_api_key")]);
        if (!hg || !el) return NextResponse.json({ error: "Avatar videos aren't configured yet." }, { status: 503 });
      }

      const prices = {
        script: await getTokenPrice(PRICING.script.key, PRICING.script.fallback),
        storyboard: await getTokenPrice(PRICING.storyboard.key, PRICING.storyboard.fallback),
        avatar: await getTokenPrice(PRICING.avatar.key, PRICING.avatar.fallback),
      };
      const cost = episodeBasePrice(output, prices);
      const claim = await claimCharge(body.charge_id, cost, user.id);
      if (claim.error) return NextResponse.json({ error: claim.error }, { status: 402 });

      const settings = { language_code, accent, gender, aspect, profile_ids: cz?.character_mode === "profiles" ? cz.profile_ids : [] };
      const { data: row, error } = await supabase.from("series_episodes")
        .insert({ user_id: user.id, formula_id: f.id, charge_id: body.charge_id, idea, output_type: output, settings, cost })
        .select("*").single();
      if (error || !row) { await releaseClaim(body.charge_id); return NextResponse.json({ error: "Couldn't start this episode." }, { status: 500 }); }
      const ep = row as EpisodeRow;

      const cast = f.settings.cast ?? f.result.cast;
      const style = f.settings.style_prompt ?? f.result.style_prompt;
      const system = `You turn an episode idea into a production script for AI image and video generation.

Rules:
- 4 to 6 scenes, about 5 seconds each, following the idea's beats.
- visual_prompt: English, a self-contained prompt of 40-90 words: the visual style, which cast members appear with their key look and outfit details, action, expression, setting and camera framing. Use names only alongside full descriptions. No on-screen text, captions, subtitles or logos in the picture.
- dialogue: what is spoken in the scene, at most about 14 words so it fits 5 seconds; an empty string if nobody speaks.
- speaker: the cast member speaking, "narrator", or an empty string.
- on_screen_text: the short text overlay for the scene, in the formula's overlay style.
- narration: every spoken line in order as one paragraph (used when a single presenter performs the episode).
${languageRules({ language_code, accent })}
${SAFETY}`;
      const text = [
        `Series formula: ${JSON.stringify(f.result.formula)}`,
        castBlock(cast, style),
        `Episode idea: ${JSON.stringify(idea)}`,
        output === "avatar" ? "This episode will be performed by the lead character talking to camera, so make the narration work as a monologue." : "",
        `Aspect ratio: ${aspect}.`,
      ].filter(Boolean).join("\n\n");

      let script: EpisodeScript;
      try {
        script = await structured<EpisodeScript>(await llmKeys(), { name: "episode_script", schema: SCRIPT_SCHEMA, system, text, effort: "low" });
        script.scenes = script.scenes.slice(0, 6);
      } catch (err) {
        await releaseClaim(body.charge_id);
        await supabase.from("series_episodes").update({ status: "failed", error: "Script failed", updated_at: new Date().toISOString() }).eq("id", ep.id);
        throw err;
      }

      if (output === "script") {
        await supabase.from("series_episodes").update({ script, status: "done", updated_at: new Date().toISOString() }).eq("id", ep.id);
        await completeCharge(body.charge_id, user.id, ep.id);
        return NextResponse.json({ episode: { ...ep, script, status: "done" } });
      }
      await supabase.from("series_episodes").update({ script, status: "scripted", updated_at: new Date().toISOString() }).eq("id", ep.id);
      await attachTask(body.charge_id, `episode:${ep.id}`, "series_cloner");
      return NextResponse.json({ episode: { ...ep, script, status: "scripted" } });
    }

    // ================================================================ episode: storyboard
    if (action === "storyboard_sheet" || action === "storyboard_scenes") {
      const ep = await loadEpisode();
      if (!ep || !ep.script) return notFound();
      if (!["storyboard", "video"].includes(ep.output_type) || !["scripted", "storyboarding"].includes(ep.status)) return NextResponse.json({ error: "Storyboard isn't available for this episode." }, { status: 409 });
      if (!(await episodeChargeOk(ep))) return NextResponse.json({ error: "Payment required" }, { status: 402 });
      const { data: fRow } = await supabase.from("series_formulas").select("*").eq("id", ep.formula_id).single();
      const f = fRow as FormulaRow;
      const cast = f.settings.cast ?? f.result!.cast;
      const style = f.settings.style_prompt ?? f.result!.style_prompt;
      const profiles = await getProfiles(user.id, ep.settings.profile_ids ?? []);
      const reference = f.settings.customization?.character_mode === "reference" ? f.settings.customization.reference_url : null;

      if (action === "storyboard_sheet") {
        // Saved profiles already are the reference: no sheet needed
        if (profiles.length) {
          await supabase.from("series_episodes").update({ status: "storyboarding", updated_at: new Date().toISOString() }).eq("id", ep.id);
          return NextResponse.json({ task_id: null });
        }
        const sheetPrompt = `Character reference sheet for an original short-form series. ${cast.map((c) => `${c.name}: ${c.look} Wearing ${c.outfit}.`).join(" ")} All characters standing side by side, full body, front view, neutral expressions, evenly lit plain light background, consistent proportions. ${style} Original fictional characters who do not resemble any real person. No text, labels or logos.`;
        const prompt = reference
          ? `Using the reference image only for outfit, colours and art style (create a new, original face that does not resemble the person in it): ${sheetPrompt}`
          : sheetPrompt;
        const taskId = await kieImageTask(prompt.slice(0, 3800), ep.settings.aspect === "16:9" ? "16:9" : "1:1", reference ? [reference] : []);
        await supabase.from("series_episodes").update({ status: "storyboarding", tasks: { ...ep.tasks, sheet: taskId }, updated_at: new Date().toISOString() }).eq("id", ep.id);
        return NextResponse.json({ task_id: taskId });
      }

      // storyboard_scenes: the sheet (or saved profiles) anchors every frame
      let refs = profiles.map((p) => p.reference_image_url);
      if (!refs.length) {
        if (!ep.tasks.sheet) return NextResponse.json({ error: "Create the character sheet first." }, { status: 409 });
        const st = await getTaskStatus(ep.tasks.sheet, "kie");
        if (!st.completed || !st.video_url) return NextResponse.json({ error: st.failed ? "The character sheet failed." : "The character sheet isn't ready yet." }, { status: 409 });
        refs = [st.video_url];
      }
      const started = await Promise.allSettled(ep.script.scenes.map((s) => {
        const prompt = `Using the characters exactly as they appear in the reference image${refs.length > 1 ? "s" : ""} (same faces, bodies, outfits, proportions and art style), create this scene: ${s.visual_prompt} ${style} No text, captions or logos.`;
        return kieImageTask(prompt.slice(0, 3800), ep.settings.aspect, refs);
      }));
      // A scene that couldn't start is kept as "" so indexes still match scenes
      const scenes = started.map((r) => (r.status === "fulfilled" ? r.value : ""));
      await supabase.from("series_episodes").update({ tasks: { ...ep.tasks, scenes }, updated_at: new Date().toISOString() }).eq("id", ep.id);
      if (!scenes.some(Boolean)) throw new Error("Couldn't start the storyboard images.");
      return NextResponse.json({ task_ids: scenes });
    }

    if (action === "storyboard_done") {
      const ep = await loadEpisode();
      if (!ep) return notFound();
      if (ep.status !== "storyboarding") return NextResponse.json({ episode: ep });
      const outcome = await finishStoryboard(ep, body.give_up === true);
      if (outcome === "pending") return NextResponse.json({ error: "Some frames are still rendering." }, { status: 409 });
      return NextResponse.json({ episode: ep });
    }

    if (action === "video_done") {
      const ep = await loadEpisode();
      if (!ep || ep.output_type !== "video") return notFound();
      if (!ours(body.video_url)) return NextResponse.json({ error: "Invalid video" }, { status: 400 });
      await supabase.from("series_episodes").update({ video_url: body.video_url, status: "done", updated_at: new Date().toISOString() }).eq("id", ep.id);
      return NextResponse.json({ ok: true });
    }

    // ================================================================ episode: avatar
    if (action === "avatar_prepare") {
      const ep = await loadEpisode();
      if (!ep || !ep.script || ep.output_type !== "avatar" || ep.status !== "scripted") return notFound();
      if (!(await episodeChargeOk(ep))) return NextResponse.json({ error: "Payment required" }, { status: 402 });
      const { data: fRow } = await supabase.from("series_formulas").select("*").eq("id", ep.formula_id).single();
      const f = fRow as FormulaRow;
      const lead = (f.settings.cast ?? f.result!.cast)[0];
      const style = f.settings.style_prompt ?? f.result!.style_prompt;
      const profiles = await getProfiles(user.id, ep.settings.profile_ids ?? []);
      const reference = f.settings.customization?.character_mode === "reference" ? f.settings.customization.reference_url : null;
      const refs = profiles.length ? [profiles[0].reference_image_url] : reference ? [reference] : [];

      const portraitPrompt = `${refs.length ? `Using the ${profiles.length ? "character exactly as they appear in the reference image" : "reference image only for outfit, colours and art style, with a new original face"}: ` : ""}Portrait of ${lead?.name ?? "the presenter"}: ${lead?.look ?? ""} Wearing ${lead?.outfit ?? ""}. Facing the camera, head and shoulders, mouth closed, neutral friendly expression, eyes open, clear face, plain softly lit background. ${style} Original fictional character, no text.`;
      const elKey = await getSetting("elevenlabs_api_key");
      const [portraitTask, audio] = await Promise.all([
        kieImageTask(portraitPrompt.slice(0, 3800), ep.settings.aspect, refs),
        speak(elKey, ep.script.narration.slice(0, 4500), ep.settings.language_code, ep.settings.accent || null, ep.settings.gender),
      ]);
      const path = `series-cloner/${ep.id}/voice.mp3`;
      const { error } = await supabase.storage.from("generation-inputs").upload(path, audio, { contentType: "audio/mpeg", upsert: true });
      if (error) throw new Error(`Storage upload failed: ${error.message}`);
      const audioUrl = supabase.storage.from("generation-inputs").getPublicUrl(path).data.publicUrl;
      await supabase.from("series_episodes").update({ status: "avatar", audio_url: audioUrl, tasks: { ...ep.tasks, portrait: portraitTask }, updated_at: new Date().toISOString() }).eq("id", ep.id);
      return NextResponse.json({ task_id: portraitTask });
    }

    if (action === "avatar_start") {
      const ep = await loadEpisode();
      if (!ep || ep.output_type !== "avatar" || ep.status !== "avatar" || !ep.tasks.portrait || !ep.audio_url) return notFound();
      if (ep.tasks.avatar) return NextResponse.json({ task_id: ep.tasks.avatar, provider: "heygen_v3" });
      if (!(await episodeChargeOk(ep))) return NextResponse.json({ error: "Payment required" }, { status: 402 });
      const st = await getTaskStatus(ep.tasks.portrait, "kie");
      if (!st.completed || !st.video_url) return NextResponse.json({ error: st.failed ? "The presenter image failed." : "The presenter image isn't ready yet." }, { status: 409 });
      const key = await getSetting("heygen_api_key");

      // HeyGen v3 animates the generated portrait with the episode's own voice track
      const portraitUrl = await copyToStorage(st.video_url, `series-cloner/${ep.id}/presenter.png`).catch(() => st.video_url!);
      const res = await fetch("https://api.heygen.com/v3/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key, Accept: "application/json" },
        body: JSON.stringify({
          type: "image",
          image: { type: "url", url: portraitUrl },
          audio_url: ep.audio_url,
          aspect_ratio: ep.settings.aspect,
          resolution: "720p",
          title: `KlipflowAI series episode ${ep.id}`,
        }),
      });
      const data = await safeJson(res);
      const videoId = data.data?.video_id ?? data.video_id;
      if (!res.ok || !videoId) {
        const err = data.error;
        throw new Error((typeof err === "string" ? err : err?.message) ?? data.message ?? `HeyGen error (${res.status})`);
      }
      await supabase.from("series_episodes").update({ tasks: { ...ep.tasks, avatar: videoId }, updated_at: new Date().toISOString() }).eq("id", ep.id);
      return NextResponse.json({ task_id: videoId, provider: "heygen_v3" });
    }

    if (action === "avatar_done" || action === "avatar_failed") {
      const ep = await loadEpisode();
      if (!ep || ep.output_type !== "avatar") return notFound();
      if (ep.status === "done" || ep.status === "partial") return NextResponse.json({ episode: ep });
      if (action === "avatar_done") {
        if (!ep.tasks.avatar) return NextResponse.json({ error: "Not started" }, { status: 409 });
        const st = await getTaskStatus(ep.tasks.avatar, "heygen_v3");
        if (!st.completed || !st.video_url) return NextResponse.json({ error: "The video isn't ready yet." }, { status: 409 });
        await settleEpisode(ep, "done", { video_url: st.video_url });
      } else {
        // Only once the avatar really can't finish: not started, or HeyGen says failed
        if (ep.tasks.avatar) {
          const st = await getTaskStatus(ep.tasks.avatar, "heygen_v3").catch(() => null);
          if (st?.completed) return NextResponse.json({ error: "The video finished; reload to see it." }, { status: 409 });
          if (!st?.failed && Date.now() - new Date(ep.updated_at).getTime() < 10 * 60 * 1000) {
            return NextResponse.json({ error: "The video is still processing." }, { status: 409 });
          }
        }
        await settleEpisode(ep, "partial", { error: clip(body.reason, 200) || "The avatar video couldn't be created." });
      }
      return NextResponse.json({ episode: ep });
    }

    if (action === "storyboard_failed") {
      const ep = await loadEpisode();
      if (!ep || !["storyboard", "video"].includes(ep.output_type)) return notFound();
      if (!["scripted", "storyboarding"].includes(ep.status)) return NextResponse.json({ episode: ep });
      // If any frame still rendered, keep it rather than refunding
      if (ep.tasks.scenes?.length) {
        const statuses = await Promise.all(ep.tasks.scenes.filter(Boolean).map((t) => getTaskStatus(t, "kie").catch(() => null)));
        if (statuses.some((s) => s?.completed)) return NextResponse.json({ error: "Some frames finished; finishing the storyboard instead." }, { status: 409 });
        if (statuses.some((s) => s && !s.completed && !s.failed) && Date.now() - new Date(ep.updated_at).getTime() < 10 * 60 * 1000) {
          return NextResponse.json({ error: "The storyboard is still rendering." }, { status: 409 });
        }
      }
      await settleEpisode(ep, "partial", { error: clip(body.reason, 200) || "The storyboard couldn't be created." });
      return NextResponse.json({ episode: ep });
    }

    // ================================================================ character profiles
    if (action === "save_profile") {
      const name = clip(body.name, 60);
      if (!name) return NextResponse.json({ error: "Give the character a name." }, { status: 400 });
      let imageUrl: string | null = null;
      let formulaId: string | null = null;
      if (typeof body.episode_id === "string") {
        const ep = await loadEpisode();
        if (!ep) return notFound();
        formulaId = ep.formula_id;
        imageUrl = body.source === "sheet" ? ep.sheet_url : ep.frames.find((fr) => fr.index === Number(body.frame_index))?.url ?? null;
      } else if (ours(body.image_url)) {
        imageUrl = body.image_url;
      }
      if (!ours(imageUrl)) return NextResponse.json({ error: "Choose an image for this character." }, { status: 400 });
      const { count } = await supabase.from("character_profiles").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      if ((count ?? 0) >= 50) return NextResponse.json({ error: "You can save up to 50 characters. Delete one first." }, { status: 400 });
      const { data, error } = await supabase.from("character_profiles").insert({
        user_id: user.id, name, reference_image_url: imageUrl, style_description: clip(body.style_description, 1200),
        character_type: clip(body.character_type, 120) || null, source_formula_id: formulaId,
      }).select("*").single();
      if (error) return NextResponse.json({ error: "Couldn't save the character." }, { status: 500 });
      return NextResponse.json({ profile: data });
    }

    if (action === "delete_profile") {
      if (typeof body.profile_id !== "string") return notFound();
      await supabase.from("character_profiles").delete().eq("id", body.profile_id).eq("user_id", user.id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Series cloner error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
