-- AI Actor Swap (user-facing Studio module)
-- Run once in the Supabase SQL editor (after token_charges.sql).

-- Per-minute token prices, billed per second of source video.
-- Background replacement is an add-on to any tier that changes the face
-- (Full swap 80 + background 20 = the 100/min "full + background" tier).
INSERT INTO token_pricing (action, description, icon, tokens, updated_at)
SELECT v.action, v.description, v.icon, v.tokens, now()
FROM (VALUES
  ('actor_swap_language',   'Actor Swap: language and voice only (per minute)', '🗣️', 30),
  ('actor_swap_face',       'Actor Swap: new face, original voice (per minute)', '🎭', 50),
  ('actor_swap_full',       'Actor Swap: new face, language and voice (per minute)', '🌍', 80),
  ('actor_swap_background', 'Actor Swap: background replacement add-on (per minute)', '🖼️', 20)
) AS v(action, description, icon, tokens)
WHERE NOT EXISTS (SELECT 1 FROM token_pricing t WHERE t.action = v.action);

-- Provider keys and the module switch (switch must be non-secret; starts OFF)
INSERT INTO admin_settings (key, value, category, is_secret, updated_at)
VALUES
  ('synclabs_api_key',      '',      'ai_providers', true,  now()),
  ('synclabs_enabled',      'false', 'ai_providers', false, now()),
  ('elevenlabs_api_key',    '',      'ai_providers', true,  now()),
  ('ai_actor_swap_enabled', 'false', 'ai_providers', false, now())
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category,
      is_secret = EXCLUDED.is_secret,
      -- keep any key already saved
      value = CASE WHEN admin_settings.value IS NULL OR admin_settings.value = '' THEN EXCLUDED.value ELSE admin_settings.value END;

-- One row per Actor Swap job. The server tracks each pipeline step here so it
-- can deliver whatever succeeded and refund only the part that failed.
CREATE TABLE IF NOT EXISTS actor_swap_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  charge_id     uuid NOT NULL REFERENCES token_charges (id),
  status        text NOT NULL DEFAULT 'running'
                CHECK (status IN ('running', 'needs_stitch', 'done', 'partial', 'failed')),
  options       jsonb NOT NULL,          -- what the user asked for
  state         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- per-step progress
  cost          integer NOT NULL,        -- total charged
  refunded      integer NOT NULL DEFAULT 0,
  result_url    text,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS actor_swap_jobs_user_idx ON actor_swap_jobs (user_id, created_at DESC);

-- Server-only, like token_charges
ALTER TABLE actor_swap_jobs ENABLE ROW LEVEL SECURITY;
