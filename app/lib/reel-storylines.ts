// Server-only: storyline pool generation for Faceless Reels templates, shared by
// the user route (auto refill) and the admin route ("add variations").
import { createClient } from "@supabase/supabase-js";
import { structured, type LlmKeys } from "./llm";
import type { ReelTemplate } from "./faceless-reels";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// The platform's only hard lines (per the product brief): no real people's
// likenesses, and no sexual content involving minors or child characters.
export const CONTENT_RULES = `Hard rules (the only restrictions):
- Never depict, name or imitate real people, celebrities or public figures, or their likenesses. All characters are wholly original.
- Never include sexual content, innuendo or sexualised framing involving minors or child characters (including AI toddlers or "mini adults"). Anything else in tone, humour or storyline is the creator's choice.`;

const STORYLINES_SCHEMA = {
  type: "object",
  properties: {
    storylines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" }, logline: { type: "string" }, character_names: { type: "array", items: { type: "string" } },
          setting_details: { type: "string" }, episode_arc: { type: "array", items: { type: "string" } },
        },
        required: ["title", "logline", "character_names", "setting_details", "episode_arc"],
        additionalProperties: false,
      },
    },
  },
  required: ["storylines"],
  additionalProperties: false,
};

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

export async function llmKeys(): Promise<LlmKeys> {
  const { data } = await supabase.from("admin_settings").select("key, value").in("key", ["claude_api_key", "openai_api_key"]);
  const get = (k: string) => data?.find((r) => r.key === k)?.value ?? "";
  return { claude: get("claude_api_key"), openai: get("openai_api_key") };
}

/** Writes `n` new storylines for the template, distinct from every earlier one. Returns how many were added. */
export async function generateStorylines(t: ReelTemplate, n: number, keys: LlmKeys, direction = ""): Promise<number> {
  const { data: prior } = await supabase.from("reel_storylines").select("title").eq("template_id", t.id).limit(300);
  const out = await structured<{ storylines: { title: string; logline: string; character_names: string[]; setting_details: string; episode_arc: string[] }[] }>(keys, {
    name: "reel_storylines", schema: STORYLINES_SCHEMA, effort: "low",
    system: `You write story premises for short-form video series. Each storyline is a distinct premise for the template below: its own character names, specific plot, setting details and a 10-15 episode arc (one line per episode). No two storylines share a premise, names or setting.\n${CONTENT_RULES}`,
    text: `Template: ${t.name}. Characters: ${t.characters}. Setting: ${t.setting}. Formula: ${t.formula}. Direction: ${t.prompt_guide}${direction ? `\nExtra direction for this batch: ${direction}` : ""}\n\nAlready used (don't repeat):\n${(prior ?? []).map((p) => `- ${p.title}`).join("\n") || "none"}\n\nWrite ${n} new storylines.`,
  });
  const rows = out.storylines.slice(0, n).map((s) => ({
    template_id: t.id, title: clip(s.title, 160), logline: clip(s.logline, 600), character_names: s.character_names.slice(0, 6),
    setting_details: clip(s.setting_details, 800), episode_arc: s.episode_arc.slice(0, 20), status: "available",
  }));
  if (rows.length) {
    const { error } = await supabase.from("reel_storylines").insert(rows);
    if (error) throw new Error(`Couldn't save storylines: ${error.message}`);
  }
  return rows.length;
}
