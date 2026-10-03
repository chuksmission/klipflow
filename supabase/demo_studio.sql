-- Demo Studio (admin): screen-recorded "how it works" videos of klipflowai.com.
-- Admin tools spend the showcase balance; these are the prices it charges.
INSERT INTO token_pricing (action, description, icon, tokens, updated_at)
SELECT v.action, v.description, v.icon, v.tokens, now()
FROM (VALUES
  ('demo_studio_recording', 'Demo Studio: browser recording (admin)',           '🎥', 25),
  ('demo_studio_voiceover', 'Demo Studio: AI voiceover (admin)',                 '🎙️', 5),
  ('demo_studio_presenter', 'Demo Studio: talking-head presenter (admin)',       '🧑‍💼', 40),
  ('demo_studio_music',     'Demo Studio: compose a music preset, once (admin)', '🎵', 10)
) AS v(action, description, icon, tokens)
WHERE NOT EXISTS (SELECT 1 FROM token_pricing t WHERE t.action = v.action);

-- Browserless key (AI Providers) and the demo account (password is a secret row)
INSERT INTO admin_settings (key, value, category, is_secret, updated_at)
VALUES
  ('browserless_api_key',   '',     'ai_providers', true,  now()),
  ('browserless_enabled',   'true', 'ai_providers', false, now()),
  ('demo_account_email',    '',     'demo_studio',  false, now()),
  ('demo_account_password', '',     'demo_studio',  true,  now())
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category,
      is_secret = EXCLUDED.is_secret;

CREATE TABLE IF NOT EXISTS demo_videos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id           uuid NOT NULL,
  title              text NOT NULL DEFAULT '',
  feature            text NOT NULL,
  description        text NOT NULL DEFAULT '',
  steps              jsonb NOT NULL DEFAULT '[]'::jsonb,   -- reviewable browser actions
  aspect             text NOT NULL DEFAULT '16:9' CHECK (aspect IN ('16:9', '9:16')),
  resolution         text NOT NULL DEFAULT '1080p' CHECK (resolution IN ('1080p', '720p')),
  status             text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'recorded', 'rendered', 'failed')),
  recording_url      text,
  recording_seconds  numeric,
  step_log           jsonb NOT NULL DEFAULT '[]'::jsonb,   -- which steps ran
  voice_script       text,
  voiceover_url      text,
  voiceover_seconds  numeric,
  voice_alignment    jsonb,                               -- per-character timings for captions
  presenter_task     text,                                -- HeyGen video id
  music_preset       text,
  final_url          text,
  generation_id      text,
  cost               integer NOT NULL DEFAULT 0,
  error              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS demo_videos_created_idx ON demo_videos (created_at DESC);

-- Server-only (admin API uses the service role)
ALTER TABLE demo_videos ENABLE ROW LEVEL SECURITY;
