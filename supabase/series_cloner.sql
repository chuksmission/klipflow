-- Series Cloner (user-facing Studio module)
-- Run once in the Supabase SQL editor (after token_charges.sql).

-- Prices. Full-video episodes also pay the chosen video model's normal price
-- per scene clip, charged as each clip starts.
INSERT INTO token_pricing (action, description, icon, tokens, updated_at)
SELECT v.action, v.description, v.icon, v.tokens, now()
FROM (VALUES
  ('series_cloner_single',     'Series Cloner: single video analysis + recreate', '🎬', 80),
  ('series_cloner_series',     'Series Cloner: series analysis (3-10 videos)',    '🧬', 150),
  ('series_cloner_script',     'Series Cloner: episode script',                   '📝', 20),
  ('series_cloner_storyboard', 'Series Cloner: episode storyboard (incl. script)', '🖼️', 30),
  ('series_cloner_avatar',     'Series Cloner: avatar video add-on (per episode)', '🗣️', 60)
) AS v(action, description, icon, tokens)
WHERE NOT EXISTS (SELECT 1 FROM token_pricing t WHERE t.action = v.action);

-- Module switch (non-secret so the Studio can read it; starts OFF)
INSERT INTO admin_settings (key, value, category, is_secret, updated_at)
VALUES ('series_cloner_enabled', 'false', 'ai_providers', false, now())
ON CONFLICT (key) DO UPDATE SET category = EXCLUDED.category, is_secret = EXCLUDED.is_secret;

-- One analysis (single video or series) and everything derived from it
CREATE TABLE IF NOT EXISTS series_formulas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL,
  charge_id      uuid REFERENCES token_charges (id),
  mode           text NOT NULL CHECK (mode IN ('single', 'series')),
  status         text NOT NULL DEFAULT 'analyzing' CHECK (status IN ('analyzing', 'ready', 'failed')),
  title          text,
  source_count   integer NOT NULL DEFAULT 1,
  sources        jsonb NOT NULL DEFAULT '[]'::jsonb,   -- per video: name, seconds, transcript, vision analysis
  result         jsonb,                                -- formula card, detection, cast, style, alternative concepts
  settings       jsonb NOT NULL DEFAULT '{}'::jsonb,   -- user customization + the cast used for episodes
  ideas          jsonb NOT NULL DEFAULT '[]'::jsonb,   -- recreation / variations / episode ideas
  idea_runs      integer NOT NULL DEFAULT 0,
  error          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS series_formulas_user_idx ON series_formulas (user_id, created_at DESC);

-- Saved, reusable characters
CREATE TABLE IF NOT EXISTS character_profiles (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL,
  name                 text NOT NULL,
  reference_image_url  text NOT NULL,
  style_description    text NOT NULL DEFAULT '',
  character_type       text,
  source_formula_id    uuid REFERENCES series_formulas (id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS character_profiles_user_idx ON character_profiles (user_id, created_at DESC);

-- Each generated episode (script, storyboard, full video or avatar video)
CREATE TABLE IF NOT EXISTS series_episodes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL,
  formula_id     uuid NOT NULL REFERENCES series_formulas (id) ON DELETE CASCADE,
  charge_id      uuid REFERENCES token_charges (id),
  idea           jsonb NOT NULL,
  output_type    text NOT NULL CHECK (output_type IN ('script', 'storyboard', 'video', 'avatar')),
  status         text NOT NULL DEFAULT 'scripting'
                 CHECK (status IN ('scripting', 'scripted', 'storyboarding', 'animating', 'avatar', 'done', 'partial', 'failed')),
  settings       jsonb NOT NULL DEFAULT '{}'::jsonb,   -- language, accent, voice, aspect, profiles used
  script         jsonb,
  sheet_url      text,                                 -- character sheet used for consistency
  frames         jsonb NOT NULL DEFAULT '[]'::jsonb,   -- storyboard images, one per scene
  tasks          jsonb NOT NULL DEFAULT '{}'::jsonb,   -- provider task ids
  audio_url      text,
  video_url      text,
  cost           integer NOT NULL DEFAULT 0,
  refunded       integer NOT NULL DEFAULT 0,
  error          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS series_episodes_formula_idx ON series_episodes (formula_id, created_at DESC);
CREATE INDEX IF NOT EXISTS series_episodes_user_idx ON series_episodes (user_id, created_at DESC);

-- Server-only (the API uses the service role), like token_charges
ALTER TABLE series_formulas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE series_episodes    ENABLE ROW LEVEL SECURITY;
