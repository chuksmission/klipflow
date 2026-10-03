import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CHARACTER_KINDS, REEL_CATEGORIES, SIMILARITY_LIMIT, fingerprintSimilarity, type Fingerprint, type ReelTemplate } from "../../../lib/faceless-reels";
import { generateStorylines, llmKeys } from "../../../lib/reel-storylines";

// "Add variations" waits for one Claude call
export const maxDuration = 120;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STORAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/generation-inputs/`;
const ours = (u: unknown): u is string => typeof u === "string" && u.startsWith(STORAGE_PREFIX);
const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

async function checkAdmin(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await supabase.from("user_profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin ? user : null;
}

/** Counts rows per template id for a table with a template_id column. */
async function countBy(table: string) {
  const counts: Record<string, number> = {};
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from(table).select("template_id").not("template_id", "is", null).range(from, from + 999);
    for (const r of data ?? []) counts[r.template_id] = (counts[r.template_id] ?? 0) + 1;
    if (!data || data.length < 1000) break;
  }
  return counts;
}

async function storylineStats() {
  const stats: Record<string, { total: number; available: number }> = {};
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from("reel_storylines").select("template_id, status").range(from, from + 999);
    for (const r of data ?? []) {
      const s = (stats[r.template_id] ??= { total: 0, available: 0 });
      s.total++;
      if (r.status === "available") s.available++;
    }
    if (!data || data.length < 1000) break;
  }
  return stats;
}

/** Pairs of recent characters (different users) whose looks are too close. */
async function similarPairs() {
  const { data } = await supabase.from("character_profiles").select("id, user_id, name, reference_image_url, character_kind, fingerprint, created_at")
    .not("fingerprint", "is", null).order("created_at", { ascending: false }).limit(300);
  const rows = (data ?? []).filter((r) => r.fingerprint && typeof r.fingerprint === "object");
  const pairs: { score: number; a: typeof rows[number]; b: typeof rows[number] }[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[i].user_id === rows[j].user_id || rows[i].character_kind !== rows[j].character_kind) continue;
      const score = fingerprintSimilarity(rows[i].fingerprint as Fingerprint, rows[j].fingerprint as Fingerprint);
      if (score > SIMILARITY_LIMIT) pairs.push({ score, a: rows[i], b: rows[j] });
    }
  }
  pairs.sort((x, y) => y.score - x.score);
  const strip = (r: typeof rows[number]) => ({ id: r.id, name: r.name, image: r.reference_image_url, created_at: r.created_at });
  return { checked: rows.length, limit: SIMILARITY_LIMIT, pairs: pairs.slice(0, 30).map((p) => ({ score: Math.round(p.score * 100) / 100, a: strip(p.a), b: strip(p.b) })) };
}

export async function GET(req: NextRequest) {
  if (!(await checkAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await supabase.from("reel_templates").select("*").order("sort", { ascending: true });
  if (error) return NextResponse.json({ error: /reel_templates/.test(error.message) ? "Run supabase/faceless_reels.sql first." : error.message }, { status: 500 });
  const [usage, episodes, storylines, uniqueness] = await Promise.all([
    countBy("user_reel_assignments"),
    supabase.from("reel_episodes").select("id", { count: "exact", head: true }).then((r) => r.count ?? 0),
    storylineStats(),
    similarPairs(),
  ]);
  return NextResponse.json({ templates: data ?? [], usage, episodes, storylines, uniqueness });
}

export async function POST(req: NextRequest) {
  try {
    if (!(await checkAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- validated field by field below
    const body = await req.json() as Record<string, any>;
    const action = String(body.action ?? "");

    if (action === "save") {
      const name = clip(body.name, 120);
      if (!name) return NextResponse.json({ error: "Give the template a name." }, { status: 400 });
      const row = {
        name,
        slug: clip(body.slug, 80).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        category: REEL_CATEGORIES.includes(body.category) ? body.category : "drama",
        character_kind: CHARACTER_KINDS.includes(body.character_kind) ? body.character_kind : "fruit_head",
        characters: clip(body.characters, 1000),
        setting: clip(body.setting, 1000),
        style: clip(body.style, 1000),
        formula: clip(body.formula, 2000),
        prompt_guide: clip(body.prompt_guide, 4000),
        image_preview_url: ours(body.image_preview_url) ? body.image_preview_url : null,
        preview_urls: Array.isArray(body.preview_urls) ? body.preview_urls.filter(ours).slice(0, 6) : [],
        disclaimer: clip(body.disclaimer, 300) || null,
        cast_size: body.cast_size === 1 ? 1 : 2,
        sort: Number.isFinite(Number(body.sort)) ? Math.round(Number(body.sort)) : 0,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      const q = typeof body.id === "string"
        ? supabase.from("reel_templates").update(row).eq("id", body.id)
        : supabase.from("reel_templates").insert(row);
      const { data, error } = await q.select("*").single();
      if (error) return NextResponse.json({ error: /duplicate|unique/i.test(error.message) ? "Another template already uses that slug." : error.message }, { status: 400 });
      return NextResponse.json({ template: data });
    }

    if (action === "toggle") {
      if (typeof body.id !== "string") return NextResponse.json({ error: "Missing template" }, { status: 400 });
      const { error } = await supabase.from("reel_templates").update({ is_active: body.is_active === true, updated_at: new Date().toISOString() }).eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (action === "delete") {
      if (typeof body.id !== "string") return NextResponse.json({ error: "Missing template" }, { status: 400 });
      // Series already made from it keep working; they just lose the link
      const { error } = await supabase.from("reel_templates").delete().eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (action === "add_variations") {
      const { data: t } = await supabase.from("reel_templates").select("*").eq("id", body.id).maybeSingle();
      if (!t) return NextResponse.json({ error: "Template not found" }, { status: 404 });
      const keys = await llmKeys();
      if (!keys.claude && !keys.openai) return NextResponse.json({ error: "Add a Claude or OpenAI key in AI Providers first." }, { status: 503 });
      const n = Math.min(12, Math.max(1, Math.round(Number(body.count) || 6)));
      const added = await generateStorylines(t as ReelTemplate, n, keys, clip(body.direction, 600));
      return NextResponse.json({ added });
    }

    if (action === "storylines") {
      const { data } = await supabase.from("reel_storylines").select("id, title, logline, status, assigned_at, created_at")
        .eq("template_id", body.id).order("created_at", { ascending: false }).limit(100);
      return NextResponse.json({ storylines: data ?? [] });
    }

    if (action === "delete_storyline") {
      // Only unassigned storylines can go; assigned ones belong to a creator
      const { error } = await supabase.from("reel_storylines").delete().eq("id", body.storyline_id).eq("status", "available");
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Reel templates admin error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong" }, { status: 500 });
  }
}
