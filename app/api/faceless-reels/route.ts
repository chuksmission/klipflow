import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";
import { attachTask, claimCharge, completeCharge, getCharge, getTokenPrice, refundCharge, releaseClaim } from "../../lib/charges";
import { getTaskStatus } from "../../lib/task-status";
import { structured, type LlmKeys } from "../../lib/llm";
import { CONTENT_RULES, generateStorylines, llmKeys } from "../../lib/reel-storylines";
import { nanoBananaTask } from "../../lib/kie-image";
import { CAPTION_FONT, download, probeMedia, runFfmpeg, workspace } from "../../lib/server-ffmpeg";
import { ACTOR_SWAP_LANGUAGES } from "../../lib/actor-swap";
import {
  CHARACTER_KINDS, REEL_DURATIONS, REEL_PRICING, SHEET_VIEWS, SIMILARITY_LIMIT, fingerprintLine, fingerprintSimilarity,
  type CharacterDesign, type CharacterKind, type EpisodeScript, type Fingerprint, type ReelMode, type ReelScene, type ReelTemplate, type SeriesBible,
} from "../../lib/faceless-reels";

// Claude calls (10-40s) and the final join of up to 60s of video
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "generation-inputs";
const MAX_EDITS = 3;
const POOL_REFILL_RATIO = 0.2;
const POOL_BATCH = 6;

// ---------------------------------------------------------------- rows

interface CastMember {
  design: CharacterDesign;
  preview_task?: string;
  preview_url?: string;
  edits: number;
  sheet_tasks?: string[];
  sheet_urls?: (string | null)[];
  profile_id?: string;
}

interface Assignment {
  id: string;
  user_id: string;
  mode: ReelMode;
  template_id: string | null;
  storyline_id: string | null;
  character_kind: CharacterKind;
  title: string | null;
  concept: string;
  language: string;
  accent: string;
  status: "designing" | "sheeting" | "cast_ready" | "ready" | "failed";
  cast: CastMember[];
  bible: SeriesBible | null;
  charge_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Episode {
  id: string;
  user_id: string;
  assignment_id: string;
  number: number;
  status: "scripted" | "rendering" | "done" | "partial" | "failed";
  script: EpisodeScript;
  duration: number;
  model: string | null;
  charge_id: string | null;
  tasks: string[];
  video_url: string | null;
  cost: number;
  refunded: number;
  error: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------- helpers

async function getSetting(key: string): Promise<string> {
  const { data } = await supabase.from("admin_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? "";
}
const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");
const languageName = (code: string) => ACTOR_SWAP_LANGUAGES.find((l) => l.code === code)?.name ?? "English";
const now = () => new Date().toISOString();
const price = (p: { key: string; fallback: number }) => getTokenPrice(p.key, p.fallback);

async function copyToStorage(url: string, path: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const { error } = await supabase.storage.from(BUCKET).upload(path, new Uint8Array(await res.arrayBuffer()), { contentType: res.headers.get("content-type") ?? "image/png", upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function saveAssignment(a: Assignment, patch: Partial<Assignment>) {
  Object.assign(a, patch, { updated_at: now() });
  await supabase.from("user_reel_assignments").update({ ...patch, updated_at: a.updated_at }).eq("id", a.id);
}
async function saveEpisode(e: Episode, patch: Partial<Episode>) {
  Object.assign(e, patch, { updated_at: now() });
  await supabase.from("reel_episodes").update({ ...patch, updated_at: e.updated_at }).eq("id", e.id);
}

/** The video models that can follow character reference images, best first. */
async function videoModel(): Promise<{ id: string; kie: string; maxClip: number } | null> {
  const options = [
    { id: "seedance-2-5", kie: "bytedance/seedance-2-5", maxClip: 30, key: "seedance25_enabled" },
    { id: "seedance-2", kie: "bytedance/seedance-2", maxClip: 15, key: "seedance2_enabled" },
    { id: "seedance-2-fast", kie: "bytedance/seedance-2-fast", maxClip: 15, key: "seedance2_fast_enabled" },
  ];
  for (const o of options) if ((await getSetting(o.key)) === "true") return o;
  return null;
}

// ---------------------------------------------------------------- content rules

const kindLabel: Record<CharacterKind, string> = {
  fruit_head: "fruit-head characters: human bodies with realistic, glossy fruit heads that have expressive faces",
  object_head: "object-head characters: human bodies with everyday objects as heads, with expressive faces",
  food: "anthropomorphic food characters with faces, arms and legs",
  animated: "stylized 3D animated characters, Pixar-adjacent",
  mini_adult: "photorealistic AI-generated toddler characters dressed and behaving like grown adults (streetwear, chains, suits, sunglasses); fully AI-generated, not real children",
  custom: "original characters in the creator's described style",
};

// ---------------------------------------------------------------- schemas

const FINGERPRINT_SCHEMA = {
  type: "object",
  properties: {
    gender: { type: "string" }, skin_tone: { type: "string" }, hair: { type: "string" }, head: { type: "string", description: "fruit/object/food for hybrid heads, otherwise 'human'" },
    outfit_colors: { type: "array", items: { type: "string" } }, outfit_style: { type: "string" },
    accessories: { type: "array", items: { type: "string" } }, distinctive: { type: "array", items: { type: "string" } },
  },
  required: ["gender", "skin_tone", "hair", "head", "outfit_colors", "outfit_style", "accessories", "distinctive"],
  additionalProperties: false,
};
const CHARACTER_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" }, role: { type: "string" }, personality: { type: "string" },
    look: { type: "string", description: "Self-contained appearance prompt, 40-80 words: body, head, face, hair, skin, build, art style" },
    outfit: { type: "string" }, fingerprint: FINGERPRINT_SCHEMA,
  },
  required: ["name", "role", "personality", "look", "outfit", "fingerprint"],
  additionalProperties: false,
};
const CAST_SCHEMA = { type: "object", properties: { cast: { type: "array", items: CHARACTER_SCHEMA } }, required: ["cast"], additionalProperties: false };

const SCENE_SCHEMA = {
  type: "object",
  properties: {
    shot: { type: "string", description: "Framing and what we see, e.g. 'Extreme close-up of Jax, side-eye'" },
    action: { type: "string" }, dialogue: { type: "string" }, speaker: { type: "string" },
    reaction: { type: "string", description: "The reaction shot that follows this beat, '' if none" },
    overlay: { type: "string", description: "1-3 word bold caps overlay, '' if none" },
    seconds: { type: "number" },
  },
  required: ["shot", "action", "dialogue", "speaker", "reaction", "overlay", "seconds"],
  additionalProperties: false,
};
const SCRIPT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" }, hook: { type: "string" }, scenes: { type: "array", items: SCENE_SCHEMA },
    music_mood: { type: "string" }, ending: { type: "string" }, caption: { type: "string" },
  },
  required: ["title", "hook", "scenes", "music_mood", "ending", "caption"],
  additionalProperties: false,
};
const OUTLINE_SCHEMA = {
  type: "object",
  properties: { number: { type: "number" }, title: { type: "string" }, summary: { type: "string" }, ending: { type: "string" } },
  required: ["number", "title", "summary", "ending"], additionalProperties: false,
};
const BIBLE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" }, logline: { type: "string" }, tone: { type: "string" }, world: { type: "string" },
    characters: { type: "array", items: CHARACTER_SCHEMA }, arc: { type: "string" },
    episode_1: SCRIPT_SCHEMA, outlines: { type: "array", items: OUTLINE_SCHEMA }, directions: { type: "array", items: { type: "string" } },
  },
  required: ["title", "logline", "tone", "world", "characters", "arc", "episode_1", "outlines", "directions"],
  additionalProperties: false,
};
// What the reference videos taught: write for the edit, not just the story
const SCRIPT_RULES = (seconds: number) => `Script rules (short-form vertical reels):
- The hook is the first 3 seconds and the most important line: a question or a confused reaction about something on screen, spoken in the first second ("Bro… why is your mom hiding pink candy?"), or an in-the-middle-of-action cold open. No intros.
- Cut every 1.5-3 seconds. Mostly close-ups and medium close-ups of faces.
- REACTION-FIRST CAMERA RULE: after every funny, weird or awkward line, unexpected action, reveal or punchline, cut to a character reacting before the next important beat. Reactions are part of the joke. Put that shot in "reaction".
- Dialogue is short and punchy: 2-8 words per line, natural slang where it fits the characters. Ping-pong exchanges.
- overlay: 1-3 words, bold caps, for key moments only (they're burned in lower-middle).
- Total length about ${seconds} seconds: scene "seconds" add up to it.
- End with a cliffhanger line that sets up the next episode, or a punchline verdict for a standalone reel.`;

// ---------------------------------------------------------------- AI: cast design

async function existingFingerprints(kind: CharacterKind): Promise<Fingerprint[]> {
  const { data } = await supabase.from("character_profiles").select("fingerprint").eq("character_kind", kind)
    .not("fingerprint", "is", null).order("created_at", { ascending: false }).limit(400);
  return (data ?? []).map((r) => r.fingerprint as Fingerprint).filter((f) => f && typeof f === "object" && f.head !== undefined);
}

/**
 * Designs `count` new characters for this template or kind, deliberately
 * different from every character already created on the platform for the same
 * kind (so no two users share a look), redesigning any that come out too close.
 */
async function designCast(kind: CharacterKind, count: number, context: string, keys: LlmKeys, edit?: { current: CharacterDesign; request: string; others: CharacterDesign[] }): Promise<CharacterDesign[]> {
  const existing = await existingFingerprints(kind);
  const sample = existing.slice(0, 120).map((f, i) => `${i + 1}. ${fingerprintLine(f)}`).join("\n");
  let feedback = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const system = `You design original recurring characters for short-form "faceless" video series: ${kindLabel[kind]}.

Every character you design must be visually DISTINCT from all existing characters listed (each belongs to another creator): vary ethnicity/skin tone, hair colour and style, ${kind === "fruit_head" || kind === "object_head" || kind === "food" ? "the fruit/object/food itself, " : ""}outfit colours and style, accessories and distinctive features. Cast members also differ clearly from each other.
"look" is a self-contained image prompt (40-80 words). The fingerprint lists the visual tags precisely and briefly.
${CONTENT_RULES}`;
    const text = [
      context,
      edit
        ? `Revise this character following the creator's request, keeping everything they didn't ask to change:\n${JSON.stringify(edit.current)}\nRequest: "${edit.request}"\nOther cast members (stay distinct from them): ${edit.others.map((o) => fingerprintLine(o.fingerprint)).join(" | ") || "none"}\nReturn exactly 1 character.`
        : `Design ${count} new character${count > 1 ? "s" : ""}.`,
      sample ? `Existing characters of this kind (do NOT resemble any):\n${sample}` : "No existing characters of this kind yet.",
      feedback,
    ].filter(Boolean).join("\n\n");
    const out = await structured<{ cast: CharacterDesign[] }>(keys, { name: "reel_cast", schema: CAST_SCHEMA, system, text, effort: "low" });
    const cast = out.cast.slice(0, edit ? 1 : count);
    if (cast.length < (edit ? 1 : count)) { feedback = `You returned ${cast.length}; return exactly ${edit ? 1 : count}.`; continue; }
    // Too close to an existing character (or to each other)? Redesign those.
    const clashes = cast.map((c, i) => {
      const worst = Math.max(0, ...existing.map((f) => fingerprintSimilarity(c.fingerprint, f)), ...cast.filter((_, j) => j !== i).map((o) => fingerprintSimilarity(c.fingerprint, o.fingerprint)));
      return worst > SIMILARITY_LIMIT ? `${c.name} (${fingerprintLine(c.fingerprint)}) is too similar to an existing character` : "";
    }).filter(Boolean);
    if (!clashes.length || attempt === 2) return cast;
    feedback = `Redesign: ${clashes.join("; ")}. Change skin tone, hair, outfit colours and accessories substantially.`;
  }
  throw new Error("Couldn't design a unique character.");
}

const previewPrompt = (c: CharacterDesign, kind: CharacterKind, style: string) =>
  `Full-body character portrait of an original character for a short-form video series. ${c.look} Wearing ${c.outfit}. Standing, facing the camera, neutral confident expression, plain softly lit studio background, entire body visible head to toe. ${style || (kind === "mini_adult" ? "Photorealistic, natural light, sharp detail." : "Photorealistic 3D render, soft studio lighting.")} ${kind === "mini_adult" ? "Fully AI-generated character, not a real child. " : ""}Original fictional character who does not resemble any real person. No text.`;

async function startPreview(c: CharacterDesign, kind: CharacterKind, style: string, previous?: string): Promise<string> {
  const key = await getSetting("kie_api_key");
  const prompt = previous
    ? `Update this character to match the new description exactly, keeping the same art style and framing. ${previewPrompt(c, kind, style)}`
    : previewPrompt(c, kind, style);
  return nanoBananaTask(key, prompt, previous ? [previous] : [], "9:16");
}

// ---------------------------------------------------------------- storylines (exclusive)

/** Claims an unassigned storyline for this user; no other user can get it. */
async function assignStoryline(t: ReelTemplate, userId: string, keys: LlmKeys) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: candidates } = await supabase.from("reel_storylines").select("id").eq("template_id", t.id).eq("status", "available").limit(25);
    if (!candidates?.length) { await generateStorylines(t, POOL_BATCH, keys); continue; }
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    // Atomic claim: only succeeds while it's still available
    const { data } = await supabase.from("reel_storylines").update({ status: "assigned", assigned_to: userId, assigned_at: now() })
      .eq("id", pick.id).eq("status", "available").select("*").maybeSingle();
    if (data) return data as { id: string; title: string; logline: string; character_names: string[]; setting_details: string; episode_arc: string[] };
  }
  throw new Error("Couldn't assign a storyline. Try again.");
}

/** Tops the pool up in the background when under 20% of it is still free. */
function refillPoolLater(t: ReelTemplate, keys: LlmKeys) {
  after(async () => {
    try {
      const [{ count: total }, { count: free }] = await Promise.all([
        supabase.from("reel_storylines").select("id", { count: "exact", head: true }).eq("template_id", t.id),
        supabase.from("reel_storylines").select("id", { count: "exact", head: true }).eq("template_id", t.id).eq("status", "available"),
      ]);
      if ((total ?? 0) === 0 || (free ?? 0) / (total ?? 1) < POOL_REFILL_RATIO) await generateStorylines(t, POOL_BATCH, keys);
    } catch (e) { console.error("Storyline refill:", e); }
  });
}

// ---------------------------------------------------------------- scripts

function castBlock(a: Assignment) {
  return a.cast.map((m) => `- ${m.design.name} (${m.design.role}; ${m.design.personality}): ${m.design.look} Outfit: ${m.design.outfit}.`).join("\n");
}
function languageRules(a: { language: string; accent: string }) {
  return `- Spoken dialogue, overlays and the caption are in ${languageName(a.language)}${a.accent ? ` with a natural ${a.accent} flavour (never phonetic spelling)` : ""}. Everything else (shots, actions, reactions, titles) is in English.`;
}

function validScript(s: unknown, maxSeconds: number): EpisodeScript | null {
  if (!s || typeof s !== "object") return null;
  const r = s as Record<string, unknown>;
  const scenes = Array.isArray(r.scenes) ? (r.scenes as Record<string, unknown>[]).slice(0, 40).map((x): ReelScene => ({
    shot: clip(x.shot, 400), action: clip(x.action, 400), dialogue: clip(x.dialogue, 300), speaker: clip(x.speaker, 60),
    reaction: clip(x.reaction, 300), overlay: clip(x.overlay, 30), seconds: Math.min(10, Math.max(0.5, Number(x.seconds) || 2)),
  })).filter((x) => x.shot || x.dialogue) : [];
  if (!scenes.length) return null;
  const total = scenes.reduce((n, x) => n + x.seconds, 0);
  if (total > maxSeconds * 1.15) scenes.forEach((x) => { x.seconds = Math.max(0.5, (x.seconds * maxSeconds) / total); });
  return { title: clip(r.title, 160), hook: clip(r.hook, 300), scenes, music_mood: clip(r.music_mood, 160), ending: clip(r.ending, 300), caption: clip(r.caption, 600) };
}

// ---------------------------------------------------------------- rendering

/** Splits scenes into clips no longer than the model allows. */
function planClips(script: EpisodeScript, maxClip: number): ReelScene[][] {
  const clips: ReelScene[][] = [];
  let current: ReelScene[] = [];
  let length = 0;
  for (const s of script.scenes) {
    if (current.length && length + s.seconds > maxClip) { clips.push(current); current = []; length = 0; }
    current.push(s); length += s.seconds;
  }
  if (current.length) clips.push(current);
  return clips;
}

/** Up to 9 reference images: per character its front, 3/4, happy and angry views (or the preview). */
function referenceImages(a: Assignment): { urls: string[]; legend: string } {
  const per = a.cast.length > 1 ? 4 : 8;
  const pickViews = ["front", "three_quarter", "happy", "angry", "side", "suspicious", "shocked", "back"];
  const urls: string[] = [];
  const legend: string[] = [];
  for (const m of a.cast) {
    const sheet = m.sheet_urls ?? [];
    const chosen = pickViews.map((v) => sheet[SHEET_VIEWS.findIndex((x) => x.id === v)]).filter((u): u is string => !!u).slice(0, per);
    const imgs = chosen.length ? chosen : m.preview_url ? [m.preview_url] : [];
    if (!imgs.length) continue;
    const from = urls.length + 1;
    urls.push(...imgs);
    legend.push(`${m.design.name}: @image${from}${imgs.length > 1 ? `-@image${urls.length}` : ""} (reference images ${from}${imgs.length > 1 ? `-${urls.length}` : ""})`);
  }
  return { urls: urls.slice(0, 9), legend: legend.join("; ") };
}

function clipPrompt(a: Assignment, scenes: ReelScene[], legend: string, style: string, seconds: number) {
  let t = 0;
  const shots = scenes.map((s, i) => {
    const start = t; t += s.seconds;
    return `Shot ${i + 1} (${start.toFixed(1)}-${t.toFixed(1)}s): ${s.shot}. ${s.action}${s.dialogue ? ` ${s.speaker || "The character"} says: "${s.dialogue}"` : ""}${s.reaction ? ` Then cut to reaction: ${s.reaction}.` : ""}`;
  });
  return [
    `Vertical 9:16 short-form reel, ${seconds} seconds, fast cuts between shots exactly as listed, natural lip-synced dialogue in ${languageName(a.language)}${a.accent ? ` with a ${a.accent} accent` : ""}.`,
    `Characters must look exactly like their reference images (same face, head, body, outfit, colours): ${legend}.`,
    a.cast.map((m) => `${m.design.name}: ${m.design.look} Outfit: ${m.design.outfit}.`).join(" "),
    `Style: ${style}. ${a.bible?.world ? `World: ${a.bible.world}.` : ""}`,
    ...shots,
    "No on-screen text, captions, subtitles or logos.",
  ].join("\n");
}

async function startVideo(model: { kie: string }, prompt: string, refs: string[], seconds: number): Promise<string> {
  const key = await getSetting("kie_api_key");
  const res = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: model.kie,
      input: { prompt: prompt.slice(0, 19000), reference_image_urls: refs, generate_audio: true, aspect_ratio: "9:16", duration: Math.round(seconds) },
    }),
  });
  let data: { code?: number; msg?: string; data?: { taskId?: string } } = {};
  try { data = await res.json(); } catch { /* handled below */ }
  if (data.code !== 200 || !data.data?.taskId) throw new Error(data.msg ?? "Couldn't start the video.");
  return data.data.taskId;
}

// Same quoting as the Demo Studio renderer; overlay text goes through textfiles
const ffPath = (p: string) => `'${p.replace(/\\/g, "/").replace(/:/g, "\\:")}'`;

/** Joins the clips and burns the bold caps overlays at their scene times. */
async function finishVideo(ep: Episode, clipUrls: string[], overlays: { text: string; start: number; end: number }[], latinScript: boolean): Promise<string> {
  const ws = await workspace("reel");
  try {
    const files = clipUrls.map((_, i) => ws.file(`clip${i}.mp4`));
    await Promise.all(clipUrls.map((u, i) => download(u, files[i])));
    const probes = await Promise.all(files.map(probeMedia));
    const inputs = files.flatMap((f) => ["-i", f]);
    const norm = files.map((_, i) => `[${i}:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,fps=30[v${i}];${probes[i].hasAudio ? `[${i}:a]aresample=48000,aformat=channel_layouts=stereo[a${i}]` : `anullsrc=r=48000:cl=stereo,atrim=0:${probes[i].seconds.toFixed(2)}[a${i}]`}`).join(";");
    const concat = `${files.map((_, i) => `[v${i}][a${i}]`).join("")}concat=n=${files.length}:v=1:a=1[cv][ca]`;
    // Inter Bold covers Latin and Cyrillic; other scripts skip the burned overlays
    const texts = overlays.map((_, i) => ws.file(`overlay${i}.txt`));
    if (latinScript) await Promise.all(overlays.map((o, i) => writeFile(texts[i], o.text.toUpperCase())));
    const draw = latinScript && overlays.length
      ? `;[cv]${overlays.map((o, i) => `drawtext=fontfile=${ffPath(CAPTION_FONT)}:textfile=${ffPath(texts[i])}:expansion=none:fontsize=64:fontcolor=white:borderw=5:bordercolor=black:x=(w-text_w)/2:y=h*0.66:enable='gte(t,${o.start.toFixed(2)})*lt(t,${o.end.toFixed(2)})'`).join(",")}[outv]`
      : `;[cv]null[outv]`;
    const out = ws.file("reel.mp4");
    await runFfmpeg([...inputs, "-filter_complex", norm + ";" + concat + draw, "-map", "[outv]", "-map", "[ca]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-c:a", "aac", "-movflags", "+faststart", out], 240_000);
    const path = `faceless-reels/${ep.id}.mp4`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, await readFile(out), { contentType: "video/mp4", upsert: true });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } finally {
    await ws.cleanup();
  }
}

// ---------------------------------------------------------------- handler

export async function GET() {
  // Template browsing is free and public (the Studio still checks the module switch)
  const { data } = await supabase.from("reel_templates").select("*").eq("is_active", true).order("sort", { ascending: true });
  return NextResponse.json({ templates: data ?? [] }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((await getSetting("faceless_reels_enabled")) !== "true") return NextResponse.json({ error: "Faceless Reels isn't available right now." }, { status: 403 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- validated field by field below
    const body = await req.json() as Record<string, any>;
    const action = String(body.action ?? "");
    const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

    const loadAssignment = async (): Promise<Assignment | null> => {
      if (typeof body.assignment_id !== "string") return null;
      const { data } = await supabase.from("user_reel_assignments").select("*").eq("id", body.assignment_id).eq("user_id", user.id).maybeSingle();
      return data as Assignment | null;
    };
    const loadEpisode = async (): Promise<Episode | null> => {
      if (typeof body.episode_id !== "string") return null;
      const { data } = await supabase.from("reel_episodes").select("*").eq("id", body.episode_id).eq("user_id", user.id).maybeSingle();
      return data as Episode | null;
    };
    const loadTemplate = async (id: unknown): Promise<ReelTemplate | null> => {
      if (typeof id !== "string") return null;
      const { data } = await supabase.from("reel_templates").select("*").eq("id", id).maybeSingle();
      return data as ReelTemplate | null;
    };

    // ================================================================ library
    if (action === "library") {
      const { data } = await supabase.from("user_reel_assignments").select("id, mode, template_id, title, status, character_kind, cast, created_at")
        .eq("user_id", user.id).neq("status", "failed").order("created_at", { ascending: false }).limit(40);
      return NextResponse.json({
        series: (data ?? []).map((a) => ({ ...a, cast: ((a.cast ?? []) as CastMember[]).map((m) => ({ name: m.design.name, preview_url: m.preview_url ?? null })) })),
      });
    }

    if (action === "get") {
      const a = await loadAssignment();
      if (!a) return notFound();
      const { data } = await supabase.from("reel_episodes").select("*").eq("assignment_id", a.id).eq("user_id", user.id).order("number", { ascending: true });
      const template = a.template_id ? await loadTemplate(a.template_id) : null;
      return NextResponse.json({ assignment: a, episodes: data ?? [], template });
    }

    // ================================================================ 1. create + design the cast
    if (action === "create") {
      const mode: ReelMode = ["template", "own", "oneoff"].includes(body.mode) ? body.mode : "template";
      const template = mode === "template" ? await loadTemplate(body.template_id) : null;
      if (mode === "template" && (!template || !template.is_active)) return NextResponse.json({ error: "Choose a template." }, { status: 400 });
      const kind: CharacterKind = template?.character_kind ?? (CHARACTER_KINDS.includes(body.character_kind) ? body.character_kind : "fruit_head");
      const concept = clip(body.concept, 1500);
      if (mode === "own" && concept.length < 10) return NextResponse.json({ error: "Describe your series concept." }, { status: 400 });
      const language = ACTOR_SWAP_LANGUAGES.some((l) => l.code === body.language) ? body.language : "en";
      const accent = clip(body.accent, 60);
      if (!(await getSetting("kie_api_key"))) return NextResponse.json({ error: "Faceless Reels isn't configured yet." }, { status: 503 });

      const castSize = template?.cast_size ?? (mode === "oneoff" ? (body.cast_size === 2 ? 2 : 1) : (body.cast_size === 1 ? 1 : 2));
      const cost = mode === "oneoff" ? await price(REEL_PRICING.oneoff) : (await price(REEL_PRICING.sheet)) * castSize;
      const claim = await claimCharge(body.charge_id, cost, user.id);
      if (claim.error) return NextResponse.json({ error: claim.error }, { status: 402 });

      try {
        const keys = await llmKeys();
        const context = template
          ? `Template: ${template.name}. Characters: ${template.characters}. Setting: ${template.setting}. Style: ${template.style}. Formula: ${template.formula}.`
          : `Character style: ${kindLabel[kind]}.${concept ? ` Series concept: ${concept}` : ""}${clip(body.scenario, 800) ? ` Scenario: ${clip(body.scenario, 800)}` : ""}`;
        const designs = await designCast(kind, castSize, `${context}${clip(body.hint, 300) ? `\nCreator's optional note: ${clip(body.hint, 300)}` : ""}`, keys);
        const style = template?.style ?? "";
        const tasks = await Promise.all(designs.map((d) => startPreview(d, kind, style)));
        const cast: CastMember[] = designs.map((d, i) => ({ design: d, preview_task: tasks[i], edits: 0 }));
        const { data, error } = await supabase.from("user_reel_assignments").insert({
          user_id: user.id, mode, template_id: template?.id ?? null, character_kind: kind, concept: [concept, clip(body.scenario, 800)].filter(Boolean).join("\n"),
          language, accent, status: "designing", cast, charge_id: body.charge_id, title: template?.name ?? null,
          duration: REEL_DURATIONS.includes(Number(body.duration) as typeof REEL_DURATIONS[number]) ? Number(body.duration) : 30,
        }).select("*").single();
        if (error || !data) throw new Error("Couldn't start. Run supabase/faceless_reels.sql if this persists.");
        await attachTask(body.charge_id, `reel:${data.id}`, "faceless_reels");
        return NextResponse.json({ assignment: data });
      } catch (err) {
        await releaseClaim(body.charge_id);
        throw err;
      }
    }

    // Collects finished preview images
    if (action === "cast_status") {
      const a = await loadAssignment();
      if (!a) return notFound();
      let changed = false;
      for (const [i, m] of a.cast.entries()) {
        if (m.preview_task && !m.preview_url) {
          const st = await getTaskStatus(m.preview_task, "kie").catch(() => null);
          if (st?.completed && st.video_url) { m.preview_url = await copyToStorage(st.video_url, `faceless-reels/${a.id}/c${i}-${m.edits}.png`).catch(() => st.video_url!); changed = true; }
          else if (st?.failed) { m.preview_task = undefined; changed = true; }
        }
      }
      if (a.status === "sheeting") {
        for (const m of a.cast) {
          if (!m.sheet_tasks) continue;
          m.sheet_urls ??= m.sheet_tasks.map(() => null);
          for (const [j, t] of m.sheet_tasks.entries()) {
            if (m.sheet_urls[j] || !t) continue;
            const st = await getTaskStatus(t, "kie").catch(() => null);
            if (st?.completed && st.video_url) { m.sheet_urls[j] = await copyToStorage(st.video_url, `faceless-reels/${a.id}/${m.design.name.replace(/\W+/g, "")}-${SHEET_VIEWS[j].id}.png`).catch(() => st.video_url!); changed = true; }
            else if (st?.failed) { m.sheet_tasks[j] = ""; changed = true; }
          }
        }
        const pending = a.cast.some((m) => m.sheet_tasks?.some((t, j) => t && !m.sheet_urls?.[j]));
        const stale = Date.now() - new Date(a.updated_at).getTime() > 10 * 60 * 1000;
        if (!pending || (stale && body.give_up === true)) {
          // Save each character (locked to this user) with its reference sheet
          for (const m of a.cast) {
            const sheet = (m.sheet_urls ?? []).filter((u): u is string => !!u);
            const front = sheet[0] ?? m.preview_url;
            if (!front || m.profile_id) continue;
            const { data: p } = await supabase.from("character_profiles").insert({
              user_id: user.id, name: m.design.name, reference_image_url: front, style_description: `${m.design.look} Outfit: ${m.design.outfit}.`,
              character_type: a.character_kind, character_kind: a.character_kind, template_id: a.template_id, reel_assignment_id: a.id,
              fingerprint: m.design.fingerprint, design: m.design, reference_sheet: m.sheet_urls ?? [],
            }).select("id").single();
            if (p) m.profile_id = p.id;
          }
          const missing = a.cast.reduce((n, m) => n + (m.sheet_urls ?? []).filter((u) => !u).length, 0);
          // Charge settles: images that never rendered are refunded pro rata
          if (a.charge_id && a.mode !== "oneoff") {
            const total = a.cast.length * SHEET_VIEWS.length;
            const charge = await getCharge(a.charge_id);
            if (charge && missing > 0) await refundCharge(a.charge_id, user.id, Math.floor((charge.amount * missing) / total)).catch(() => {});
            await completeCharge(a.charge_id, user.id, a.id);
          }
          await saveAssignment(a, { cast: a.cast, status: "cast_ready" });
          return NextResponse.json({ assignment: a });
        }
      }
      if (changed) await saveAssignment(a, { cast: a.cast });
      // Every preview failed: nothing delivered, refund in full
      if (a.status === "designing" && a.cast.every((m) => !m.preview_task && !m.preview_url)) {
        if (a.charge_id) await refundCharge(a.charge_id, user.id).catch(() => {});
        await saveAssignment(a, { status: "failed" });
        return NextResponse.json({ assignment: a, error: "The character images couldn't be created. Your tokens were refunded." });
      }
      return NextResponse.json({ assignment: a });
    }

    // Simple text edits: "make her a girl", "change outfit to red"
    if (action === "edit_character") {
      const a = await loadAssignment();
      if (!a || a.status !== "designing") return notFound();
      const idx = Math.round(Number(body.index));
      const m = a.cast[idx];
      const request = clip(body.request, 300);
      if (!m || !request) return NextResponse.json({ error: "Describe the change." }, { status: 400 });
      if (m.edits >= MAX_EDITS) return NextResponse.json({ error: `You can edit each character ${MAX_EDITS} times.` }, { status: 429 });
      if (!m.preview_url) return NextResponse.json({ error: "Wait for the current image first." }, { status: 409 });
      const template = a.template_id ? await loadTemplate(a.template_id) : null;
      const [revised] = await designCast(a.character_kind, 1, template ? `Template: ${template.name}. Style: ${template.style}.` : `Character style: ${kindLabel[a.character_kind]}.`, await llmKeys(),
        { current: m.design, request, others: a.cast.filter((_, j) => j !== idx).map((o) => o.design) });
      const task = await startPreview(revised, a.character_kind, template?.style ?? "", m.preview_url);
      a.cast[idx] = { ...m, design: revised, preview_task: task, preview_url: undefined, edits: m.edits + 1 };
      await saveAssignment(a, { cast: a.cast });
      return NextResponse.json({ assignment: a });
    }

    // 2. Approve: draw the 8-view reference sheet for each character
    if (action === "approve_cast") {
      const a = await loadAssignment();
      if (!a || a.status !== "designing") return notFound();
      if (a.cast.some((m) => !m.preview_url)) return NextResponse.json({ error: "Wait for every character image first." }, { status: 409 });
      if (a.mode === "oneoff") {
        // One-off reels use the approved images directly
        await saveAssignment(a, { status: "cast_ready" });
        return NextResponse.json({ assignment: a });
      }
      const key = await getSetting("kie_api_key");
      const template = a.template_id ? await loadTemplate(a.template_id) : null;
      for (const m of a.cast) {
        const started = await Promise.allSettled(SHEET_VIEWS.map((v) => nanoBananaTask(key,
          `The exact same character as in the reference image (same face, head, body proportions, skin, hair and outfit, same art style): ${m.design.look} Wearing ${m.design.outfit}. ${v.label}. Plain light grey studio background, even lighting. ${template?.style ?? ""} ${a.character_kind === "mini_adult" ? "Fully AI-generated character, not a real child." : ""} No text.`,
          [m.preview_url!], v.id === "happy" || v.id === "suspicious" || v.id === "angry" || v.id === "shocked" ? "1:1" : "9:16")));
        m.sheet_tasks = started.map((r) => (r.status === "fulfilled" ? r.value : ""));
        m.sheet_urls = SHEET_VIEWS.map(() => null);
      }
      await saveAssignment(a, { cast: a.cast, status: "sheeting" });
      return NextResponse.json({ assignment: a });
    }

    // ================================================================ 3. series bible
    if (action === "bible") {
      const a = await loadAssignment();
      if (!a || a.status !== "cast_ready" || a.mode === "oneoff") return notFound();
      const template = a.template_id ? await loadTemplate(a.template_id) : null;
      const cost = await price(a.mode === "template" ? REEL_PRICING.bible : REEL_PRICING.concept);
      const claim = await claimCharge(body.charge_id, cost, user.id);
      if (claim.error) return NextResponse.json({ error: claim.error }, { status: 402 });
      try {
        const keys = await llmKeys();
        const storyline = template ? await assignStoryline(template, user.id, keys) : null;
        const system = `You are the showrunner of a short-form vertical video series. Write the series bible: title, logline, tone, world (setting details that stay consistent), the main characters (keep the given looks, outfits and fingerprints exactly; give them names and personalities${storyline ? " matching the storyline's character names" : ""}), the overall story arc for 10-20 episodes, episode 1 fully scripted, episodes 2-5 outlined, and 4-6 directions for episode 6 onwards.
${SCRIPT_RULES(30)}
${languageRules(a)}
${CONTENT_RULES}`;
        const text = [
          template ? `Template: ${template.name}. Setting: ${template.setting}. Style: ${template.style}. Formula: ${template.formula}. Direction: ${template.prompt_guide}` : `Creator's concept: ${a.concept}\nCharacter style: ${kindLabel[a.character_kind]}`,
          storyline ? `Assigned storyline (exclusive to this creator): ${storyline.title}: ${storyline.logline}\nCharacter names: ${storyline.character_names.join(", ")}\nSetting: ${storyline.setting_details}\nArc: ${storyline.episode_arc.join(" | ")}` : "",
          `Main characters (looks are final):\n${castBlock(a)}`,
        ].filter(Boolean).join("\n\n");
        const bible = await structured<SeriesBible>(keys, { name: "reel_bible", schema: BIBLE_SCHEMA, system, text, effort: "medium" });
        // Keep the approved looks; take names and personalities from the bible
        bible.characters = a.cast.map((m, i) => ({ ...m.design, name: clip(bible.characters[i]?.name, 60) || m.design.name, personality: clip(bible.characters[i]?.personality, 400) || m.design.personality }));
        a.cast.forEach((m, i) => { m.design = bible.characters[i]; });
        for (const m of a.cast) if (m.profile_id) await supabase.from("character_profiles").update({ name: m.design.name, design: m.design }).eq("id", m.profile_id);
        await saveAssignment(a, { bible, cast: a.cast, title: clip(bible.title, 160), storyline_id: storyline?.id ?? null, status: "ready" });
        await attachTask(body.charge_id, `reel-bible:${a.id}`, "faceless_reels");
        await completeCharge(body.charge_id, user.id, a.id);
        if (template) refillPoolLater(template, keys);
        return NextResponse.json({ assignment: a });
      } catch (err) {
        await releaseClaim(body.charge_id);
        throw err;
      }
    }

    // ================================================================ 4. episodes
    if (action === "episode") {
      const a = await loadAssignment();
      if (!a) return notFound();
      const oneoff = a.mode === "oneoff";
      if (oneoff ? a.status !== "cast_ready" : a.status !== "ready") return NextResponse.json({ error: oneoff ? "Approve the character first." : "Create the series bible first." }, { status: 409 });
      const duration = REEL_DURATIONS.includes(Number(body.duration) as typeof REEL_DURATIONS[number]) ? Number(body.duration) : 30;
      const { data: prior } = await supabase.from("reel_episodes").select("number, script").eq("assignment_id", a.id).order("number", { ascending: true });
      if (oneoff && prior?.length) return NextResponse.json({ error: "This one-off reel was already written." }, { status: 409 });
      const number = (prior?.length ?? 0) + 1;

      // One-off reels were paid in full at the start; series episodes pay here
      let chargeId: string | null = a.charge_id;
      let cost = 0;
      if (!oneoff) {
        cost = await price(REEL_PRICING.episode);
        const claim = await claimCharge(body.charge_id, cost, user.id);
        if (claim.error) return NextResponse.json({ error: claim.error }, { status: 402 });
        chargeId = body.charge_id;
      }
      try {
        let script: EpisodeScript | null = number === 1 && a.bible?.episode_1 && duration === 30 ? validScript(a.bible.episode_1, duration) : null;
        if (!script) {
          const template = a.template_id ? await loadTemplate(a.template_id) : null;
          const outline = a.bible?.outlines.find((o) => o.number === number);
          const out = await structured<EpisodeScript>(await llmKeys(), {
            name: "reel_episode", schema: SCRIPT_SCHEMA, effort: "low",
            system: `You write the script for one episode of a short-form vertical video series.\n${SCRIPT_RULES(duration)}\n${languageRules(a)}\n${CONTENT_RULES}`,
            text: [
              template ? `Template: ${template.name}. Formula: ${template.formula}. Direction: ${template.prompt_guide}` : `Character style: ${kindLabel[a.character_kind]}`,
              a.bible ? `Series: ${a.bible.title}: ${a.bible.logline}\nTone: ${a.bible.tone}\nWorld: ${a.bible.world}\nArc: ${a.bible.arc}` : `Scenario: ${a.concept || "the creator left it to you: a fresh, funny situation that fits the characters"}`,
              `Characters:\n${castBlock(a)}`,
              prior?.length ? `Previous episodes:\n${prior.map((p) => `${p.number}. ${(p.script as EpisodeScript)?.title}: ends "${(p.script as EpisodeScript)?.ending}"`).join("\n")}` : "",
              outline ? `This is episode ${number}: ${outline.title}: ${outline.summary} Ending: ${outline.ending}` : oneoff ? "A standalone reel with a punchline ending." : `This is episode ${number}; continue the arc${a.bible?.directions.length ? ` (directions: ${a.bible.directions.join(" | ")})` : ""}.`,
              clip(body.idea, 600) ? `The creator's idea for this episode: ${clip(body.idea, 600)}` : "",
            ].filter(Boolean).join("\n\n"),
          });
          script = validScript(out, duration);
        }
        if (!script) throw new Error("Couldn't write the script.");
        const { data, error } = await supabase.from("reel_episodes").insert({
          user_id: user.id, assignment_id: a.id, number, script, duration, status: "scripted", charge_id: chargeId, cost,
        }).select("*").single();
        if (error || !data) throw new Error("Couldn't save the episode.");
        if (!oneoff) await attachTask(body.charge_id, `reel-episode:${data.id}`, "faceless_reels");
        return NextResponse.json({ episode: data });
      } catch (err) {
        if (!oneoff) await releaseClaim(body.charge_id);
        throw err;
      }
    }

    // The creator edits the script before it's rendered
    if (action === "update_script") {
      const ep = await loadEpisode();
      if (!ep || ep.status !== "scripted") return notFound();
      const script = validScript(body.script, ep.duration);
      if (!script) return NextResponse.json({ error: "The script needs at least one scene." }, { status: 400 });
      await saveEpisode(ep, { script });
      return NextResponse.json({ episode: ep });
    }

    if (action === "render") {
      const ep = await loadEpisode();
      if (!ep || ep.status !== "scripted") return notFound();
      const { data: aRow } = await supabase.from("user_reel_assignments").select("*").eq("id", ep.assignment_id).single();
      const a = aRow as Assignment;
      const charge = ep.charge_id ? await getCharge(ep.charge_id) : null;
      if (!charge || charge.user_id !== user.id || charge.status !== "charged") return NextResponse.json({ error: "Payment required" }, { status: 402 });
      const model = await videoModel();
      if (!model) return NextResponse.json({ error: "No video model that follows character references is enabled (Seedance)." }, { status: 503 });
      const template = a.template_id ? await loadTemplate(a.template_id) : null;
      const { urls, legend } = referenceImages(a);
      if (!urls.length) return NextResponse.json({ error: "The characters' reference images are missing." }, { status: 409 });
      const style = template?.style ?? (a.character_kind === "mini_adult" ? "photorealistic, handheld phone-camera look" : "photorealistic 3D render, cinematic lighting");
      const clips = planClips(ep.script, model.maxClip);
      const started = await Promise.allSettled(clips.map((scenes) => {
        const seconds = Math.min(model.maxClip, Math.max(4, Math.round(scenes.reduce((n, s) => n + s.seconds, 0))));
        return startVideo(model, clipPrompt(a, scenes, legend, style, seconds), urls, seconds);
      }));
      const tasks = started.map((r) => (r.status === "fulfilled" ? r.value : ""));
      if (!tasks.some(Boolean)) {
        const reason = started.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
        return NextResponse.json({ error: reason?.reason?.message ?? "Couldn't start the video." }, { status: 400 });
      }
      await saveEpisode(ep, { tasks, model: model.id, status: "rendering" });
      return NextResponse.json({ episode: ep });
    }

    // Polled while rendering: settles once every clip is done or failed
    if (action === "render_status") {
      const ep = await loadEpisode();
      if (!ep) return notFound();
      if (ep.status !== "rendering") return NextResponse.json({ episode: ep });
      const statuses = await Promise.all(ep.tasks.map((t) => (t ? getTaskStatus(t, "kie").catch(() => null) : Promise.resolve({ failed: true, completed: false, video_url: null }))));
      const stale = Date.now() - new Date(ep.updated_at).getTime() > 15 * 60 * 1000;
      if (statuses.some((s) => s && !s.completed && !s.failed) && !stale) {
        return NextResponse.json({ episode: ep, done: statuses.filter((s) => s?.completed).length, total: ep.tasks.length });
      }
      const urls = statuses.map((s) => (s?.completed && s.video_url ? s.video_url : null));
      const ready = urls.filter((u): u is string => !!u);
      const { data: aRow } = await supabase.from("user_reel_assignments").select("*").eq("id", ep.assignment_id).single();
      const a = aRow as Assignment;
      const oneoff = a.mode === "oneoff";
      if (!ready.length) {
        // Nothing rendered: refund the episode (one-offs keep the character price)
        let back = 0;
        if (ep.charge_id) {
          const charge = await getCharge(ep.charge_id);
          const keep = oneoff ? await price(REEL_PRICING.sheet) : 0;
          const amount = charge ? charge.amount - charge.refunded_amount - keep : 0;
          if (amount > 0) back = (await refundCharge(ep.charge_id, user.id, amount).catch(() => ({ refunded: 0 }))).refunded ?? 0;
          await completeCharge(ep.charge_id, user.id, ep.id);
        }
        await saveEpisode(ep, { status: "failed", refunded: ep.refunded + back, error: "The video couldn't be rendered. Tokens were refunded." });
        return NextResponse.json({ episode: ep });
      }
      // Overlays at their scene times, shifted to the clips that rendered
      const clipsPlan = planClips(ep.script, ep.model === "seedance-2-5" ? 30 : 15);
      const overlays: { text: string; start: number; end: number }[] = [];
      let offset = 0;
      clipsPlan.forEach((scenes, i) => {
        if (!urls[i]) return;
        let t = offset;
        for (const s of scenes) { if (s.overlay) overlays.push({ text: s.overlay, start: t, end: t + Math.min(s.seconds, 2.2) }); t += s.seconds; }
        offset += Math.max(4, Math.round(scenes.reduce((n, s) => n + s.seconds, 0)));
      });
      let videoUrl: string;
      try {
        videoUrl = await finishVideo(ep, ready, overlays, !["ar", "hi", "ja", "zh", "ko"].includes(a.language));
      } catch (err) {
        console.error("Reel join:", err);
        videoUrl = ready[0];
      }
      let refunded = 0;
      if (ep.charge_id && ready.length < ep.tasks.length) {
        const charge = await getCharge(ep.charge_id);
        if (charge) refunded = (await refundCharge(ep.charge_id, user.id, Math.floor((charge.amount * (ep.tasks.length - ready.length)) / ep.tasks.length / 2)).catch(() => ({ refunded: 0 }))).refunded ?? 0;
      }
      const template = a.template_id ? await loadTemplate(a.template_id) : null;
      const { data: gen } = await supabase.from("generations").insert({
        user_id: user.id, type: "faceless_reels", prompt: ep.script.title || ep.script.hook, video_url: videoUrl, output_type: "video", status: "completed",
        tokens_used: ep.cost - refunded, duration: String(ep.duration), aspect_ratio: "9:16", model: `Faceless Reels · ${ep.model}`, language: a.language, accent: a.accent || null,
        settings: template ? { template: template.name } : { template: a.mode === "own" ? "Own series" : "One-off reel" },
      }).select("id").maybeSingle();
      if (ep.charge_id) await completeCharge(ep.charge_id, user.id, gen?.id != null ? String(gen.id) : ep.id);
      await saveEpisode(ep, { status: ready.length < ep.tasks.length ? "partial" : "done", video_url: videoUrl, refunded: ep.refunded + refunded });
      return NextResponse.json({ episode: ep, generation_id: gen?.id ?? null });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Faceless reels error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong" }, { status: 500 });
  }
}
