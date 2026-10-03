-- feature/six-tasks: every SQL change in one script. Safe to re-run (IF NOT EXISTS / ON CONFLICT).
-- Order matters: faceless_reels.sql references tables it creates itself, nothing earlier.

-- =================================================================== ui_language.sql
-- Interface language chosen in the language switcher (en, fr, es, pt, ar, hi, de, it, tr, ru, bg, sw).
-- No default on purpose: NULL means "not chosen yet", so a visitor's browser
-- language keeps working until they pick one. A DEFAULT 'en' would make every
-- existing user look like they had chosen English and override their browser.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS ui_language text;

-- =================================================================== showcase_details.sql
-- Homepage showcase details: the input image used, and what the admin lets the
-- public card reveal. Featured items live on generations (is_featured), so the
-- columns go there. Prompts from upload tools (Video Remix, Actor Swap, Series
-- Cloner, Video Translator, demo videos) are never shown, whatever these say.
ALTER TABLE generations ADD COLUMN IF NOT EXISTS source_image_url text;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS show_prompt boolean NOT NULL DEFAULT true;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS show_source_image boolean NOT NULL DEFAULT true;
-- Settings used by upload tools (remix mode, languages, template), shown instead of their private input
ALTER TABLE generations ADD COLUMN IF NOT EXISTS settings jsonb;

-- =================================================================== demo_studio.sql
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

-- =================================================================== remix_bg_preserve.sql
-- Video Remix Actor Swap: keep the original video's background.
-- Billed per minute on top of the Actor Swap rate (same per-second rules).
INSERT INTO token_pricing (action, description, icon, tokens, updated_at)
SELECT 'video_remix_bg_preserve', 'Video Remix Actor Swap: keep original background (per minute)', '🏞️', 20, now()
WHERE NOT EXISTS (SELECT 1 FROM token_pricing WHERE action = 'video_remix_bg_preserve');

-- Replicate token (secret) and the option's switch (shown to the Studio; starts OFF)
INSERT INTO admin_settings (key, value, category, is_secret, updated_at)
VALUES
  ('replicate_api_key',         '',      'ai_providers', true,  now()),
  ('remix_bg_preserve_enabled', 'false', 'ai_providers', false, now())
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category,
      is_secret = EXCLUDED.is_secret;

-- =================================================================== faceless_reels.sql
-- Faceless Reels: template library, exclusive storyline pools, user series and episodes.
-- All tables are server-only (the API uses the service role), like token_charges.

-- ---------------------------------------------------------------- templates
CREATE TABLE IF NOT EXISTS reel_templates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  name              text NOT NULL,
  category          text NOT NULL DEFAULT 'drama',
  character_kind    text NOT NULL DEFAULT 'fruit_head',
  characters        text NOT NULL DEFAULT '',
  setting           text NOT NULL DEFAULT '',
  style             text NOT NULL DEFAULT '',
  formula           text NOT NULL DEFAULT '',
  prompt_guide      text NOT NULL DEFAULT '',
  image_preview_url text,
  preview_urls      text[] NOT NULL DEFAULT '{}',
  disclaimer        text,
  cast_size         int  NOT NULL DEFAULT 2 CHECK (cast_size BETWEEN 1 AND 2),
  sort              int  NOT NULL DEFAULT 0,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- storyline pools (one creator per storyline)
CREATE TABLE IF NOT EXISTS reel_storylines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     uuid NOT NULL REFERENCES reel_templates(id) ON DELETE CASCADE,
  title           text NOT NULL,
  logline         text NOT NULL DEFAULT '',
  character_names text[] NOT NULL DEFAULT '{}',
  setting_details text NOT NULL DEFAULT '',
  episode_arc     text[] NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'assigned')),
  assigned_to     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reel_storylines_pool_idx ON reel_storylines (template_id, status);

-- ---------------------------------------------------------------- a user's series (or one-off reel)
CREATE TABLE IF NOT EXISTS user_reel_assignments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode           text NOT NULL CHECK (mode IN ('template', 'own', 'oneoff')),
  template_id    uuid REFERENCES reel_templates(id) ON DELETE SET NULL,
  storyline_id   uuid REFERENCES reel_storylines(id) ON DELETE SET NULL,
  character_kind text NOT NULL,
  title          text,
  concept        text NOT NULL DEFAULT '',
  language       text NOT NULL DEFAULT 'en',
  accent         text NOT NULL DEFAULT '',
  duration       int  NOT NULL DEFAULT 30,
  status         text NOT NULL DEFAULT 'designing',
  "cast"         jsonb NOT NULL DEFAULT '[]',
  bible          jsonb,
  charge_id      uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_reel_assignments_user_idx ON user_reel_assignments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_reel_assignments_template_idx ON user_reel_assignments (template_id);

-- ---------------------------------------------------------------- episodes
CREATE TABLE IF NOT EXISTS reel_episodes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES user_reel_assignments(id) ON DELETE CASCADE,
  number        int  NOT NULL,
  status        text NOT NULL DEFAULT 'scripted',
  script        jsonb NOT NULL,
  duration      int  NOT NULL DEFAULT 30,
  model         text,
  charge_id     uuid,
  tasks         text[] NOT NULL DEFAULT '{}',
  video_url     text,
  cost          int  NOT NULL DEFAULT 0,
  refunded      int  NOT NULL DEFAULT 0,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, number)
);
CREATE INDEX IF NOT EXISTS reel_episodes_user_idx ON reel_episodes (user_id, created_at DESC);

ALTER TABLE reel_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_storylines       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reel_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_episodes         ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------- characters (reuses character_profiles)
ALTER TABLE character_profiles ADD COLUMN IF NOT EXISTS character_kind     text;
ALTER TABLE character_profiles ADD COLUMN IF NOT EXISTS template_id        uuid REFERENCES reel_templates(id) ON DELETE SET NULL;
ALTER TABLE character_profiles ADD COLUMN IF NOT EXISTS reel_assignment_id uuid REFERENCES user_reel_assignments(id) ON DELETE SET NULL;
ALTER TABLE character_profiles ADD COLUMN IF NOT EXISTS fingerprint        jsonb;
ALTER TABLE character_profiles ADD COLUMN IF NOT EXISTS design             jsonb;
ALTER TABLE character_profiles ADD COLUMN IF NOT EXISTS reference_sheet    jsonb NOT NULL DEFAULT '[]';
CREATE INDEX IF NOT EXISTS character_profiles_kind_idx ON character_profiles (character_kind, created_at DESC) WHERE fingerprint IS NOT NULL;

-- ---------------------------------------------------------------- the 15 starter templates
INSERT INTO reel_templates (slug, name, category, character_kind, characters, setting, style, formula, prompt_guide, disclaimer, cast_size, sort)
VALUES
  ('fruit-head-couple-drama', 'Fruit Head Couple Drama', 'drama', 'fruit_head', 'Two fruit-head figures in a relationship (human bodies, glossy realistic fruit heads with expressive faces)', 'Modern home interior: living room, kitchen, bedroom', 'Photorealistic 3D render, soft cinematic lighting, shallow depth of field', 'Conflict → misunderstanding → escalation → resolution or cliffhanger', 'Soap-opera melodrama played straight. Open on the accusation line. Close-ups on faces between lines, slow push-ins on reveals. End on a twist line or a door closing.', NULL, 2, 10),
  ('object-head-office-drama', 'Object Head Office Drama', 'drama', 'object_head', 'Office workers with everyday tech objects for heads: phone-head, laptop-head, printer-head', 'Corporate open-plan office, meeting room, break room', 'Photorealistic 3D, cool office lighting', 'Workplace conflict → escalation → twist', 'Deadpan workplace comedy-drama. Screens on the heads show emotions (emoji-like icons, battery levels). Cut to coworkers reacting.', NULL, 2, 20),
  ('animated-neighborhood-drama', 'Animated Neighborhood Drama', 'drama', 'animated', 'Stylized 3D animated neighbours with exaggerated proportions', 'Suburban street, front lawns, porches, fences', 'Pixar-adjacent 3D animation, warm saturated colours', 'Neighbour conflict → drama → resolution', 'Petty feud energy: over-the-fence stares, curtains twitching, dramatic zooms. Keep each line short and quotable.', NULL, 2, 30),
  ('mini-adult-kids', 'Mini Adult Kids', 'comedy', 'mini_adult', 'AI-generated toddlers dressed and acting like grown adults: streetwear, chains, suits, sunglasses', 'Real-world adult scenarios: diners, sidewalks, backyards, offices, parties', 'Photorealistic AI characters, handheld phone-camera look, natural light', 'Kids in an adult situation → comedy contrast → escalation → punchline', 'Two-hander banter: one kid proposes a bad idea, the other warns ''Don''t.'', it happens anyway, an adult or another kid delivers the verdict. Openers like ''Bro…'' as a question about something on screen. Cut to faces reacting after every line.', 'Characters are fully AI-generated. No real children are used.', 2, 40),
  ('food-character-daily-life', 'Food Character Daily Life', 'comedy', 'food', 'Anthropomorphic food items with faces, arms and legs (a burger, a croissant, a sushi roll)', 'Everyday human places: commute, gym, supermarket, office', 'Photorealistic 3D, bright natural lighting', 'Food character in the human world → absurd situations → humour', 'Lean into food puns and physical comedy (melting, crumbs, sauce). Humans react in the background.', NULL, 1, 50),
  ('object-romance', 'Object Romance', 'drama', 'object_head', 'Everyday objects as lovers (a coffee mug and a teaspoon, a sneaker and a sock)', 'Various romantic locations: café, rainy street, rooftop', 'Photorealistic 3D, romantic warm grade', 'Love story → obstacle → dramatic resolution', 'Play it like a romance trailer: slow motion, longing looks, a dramatic obstacle (the dishwasher, the washing machine).', NULL, 2, 60),
  ('fruit-head-explainer', 'Fruit Head Explainer', 'educational', 'fruit_head', 'A professional fruit-head presenter in smart clothes', 'Clean modern studio or office with a screen', 'Photorealistic 3D, bright studio lighting', 'Hook → explanation → surprising fact → call to action', 'Fast explainer: a bold claim in the first second, 2-3 punchy points with on-screen keywords, a surprising fact, a follow CTA.', NULL, 1, 70),
  ('animated-news-reporter', 'Animated News Reporter', 'educational', 'animated', 'A stylized news anchor and a field reporter', 'News studio with screens, on-location street shots', '3D animation, broadcast lighting, lower-third graphics', 'Breaking news → story → opinion → outro', 'Mock-serious news tone about everyday or trending topics. ''BREAKING'' overlay in the hook, cut to the field reporter, end with a sign-off line.', NULL, 2, 80),
  ('object-head-entrepreneur', 'Object Head Entrepreneur', 'motivational', 'object_head', 'A briefcase-head or money-bag-head entrepreneur and the people around them', 'Small office, city streets, luxury settings', 'Photorealistic 3D, cinematic grade', 'Struggle → breakthrough → success tip → inspire', 'Rise-and-grind arc in seconds: rejection, late nights, the turning point, the win. One concrete tip at the end.', NULL, 1, 90),
  ('fruit-head-life-advice', 'Fruit Head Life Advice', 'motivational', 'fruit_head', 'A wise elder fruit character and a younger listener', 'Peaceful nature: a bench by a lake, a garden, a porch at sunset', 'Soft 3D render, golden hour', 'Life lesson → short story → wisdom → actionable tip', 'Calm, warm voice. One short parable, a line of wisdom, and one thing to do today.', NULL, 2, 100),
  ('traditional-tale-retold', 'Traditional Tale Retold', 'cultural', 'object_head', 'Object-head characters in traditional dress from the tale''s culture', 'Traditional village or palace, fused with modern details', 'Artistic 3D, rich colours', 'Classic story → modern twist → moral lesson', 'Retell a well-known folk tale or fable respectfully, add one modern twist, end on the moral.', NULL, 2, 110),
  ('historical-drama', 'Historical Drama', 'cultural', 'object_head', 'Period-appropriate object-head figures (quill-head scribes, crown-head rulers)', 'Historical locations of the chosen era', 'Cinematic 3D, period lighting', 'Historical event → dramatised scene → educational reveal', 'Dramatise a real historical moment without depicting real people''s likenesses: characters are object heads. End with the real fact.', NULL, 2, 120),
  ('pov-story', 'POV Story', 'trending', 'object_head', 'First-person POV with object-head characters around the viewer', 'Varies by story', 'Photorealistic 3D, first-person camera', '''POV: you are…'' → story → twist', 'The camera is the viewer. Characters talk to the lens. The twist lands in the last 3 seconds.', NULL, 1, 130),
  ('roast-reaction', 'Roast / Reaction', 'trending', 'object_head', 'Expressive object heads reacting on a panel', 'Reaction studio: couch, ring light, screen', '3D expressive, studio lighting', 'Setup → escalating reactions → punchline', 'Each line tops the last. Quick cuts between panel members'' faces. The punchline gets the biggest reaction.', NULL, 2, 140),
  ('before-after-transformation', 'Before/After Transformation', 'trending', 'fruit_head', 'A fruit or object head going through a transformation', 'Fits the transformation: gym, closet, kitchen, studio', '3D cinematic', 'Problem → journey (montage) → transformation reveal', 'Start low (messy, tired), montage of effort with on-screen day counters, slow-motion reveal at the end.', NULL, 1, 150)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------- pricing (template browsing is free)
INSERT INTO token_pricing (action, description, icon, tokens, updated_at)
SELECT v.action, v.description, v.icon, v.tokens, now()
FROM (VALUES
  ('faceless_reels_oneoff',  'Faceless Reels: one-off reel (characters, script and video)', '🎞️', 60),
  ('faceless_reels_episode', 'Faceless Reels: series episode (script and video)',          '🎬', 50),
  ('faceless_reels_bible',   'Faceless Reels: series bible from a template',               '📖', 30),
  ('faceless_reels_concept', 'Faceless Reels: series bible from your own concept',         '💡', 20),
  ('faceless_reels_sheet',   'Faceless Reels: character design + 8-view sheet (per character)', '🧍', 20)
) AS v(action, description, icon, tokens)
WHERE NOT EXISTS (SELECT 1 FROM token_pricing t WHERE t.action = v.action);

-- ---------------------------------------------------------------- switches (start OFF)
INSERT INTO admin_settings (key, value, category, is_secret, updated_at)
VALUES
  ('faceless_reels_enabled', 'false', 'ai_providers', false, now()),
  ('seedance25_enabled',     'false', 'ai_providers', false, now())
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category,
      is_secret = EXCLUDED.is_secret;
