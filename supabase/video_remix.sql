-- Video Remix Studio (user-facing Studio module)
-- Run once in the Supabase SQL editor.

-- Token pricing, per minute of source video (minimum one minute's worth).
-- Editable later in Admin > Token Pricing.
INSERT INTO token_pricing (action, description, icon, tokens, updated_at)
SELECT v.action, v.description, v.icon, v.tokens, now()
FROM (VALUES
  ('video_remix_restyle',       'Video Remix: Restyle (per minute)',       '🎨', 80),
  ('video_remix_recreate',      'Video Remix: Recreate (per minute)',      '🔁', 60),
  ('video_remix_actor_swap',    'Video Remix: Actor Swap (per minute)',    '🎭', 50),
  ('video_remix_product_swap',  'Video Remix: Product Swap (per minute)',  '📦', 120)
) AS v(action, description, icon, tokens)
WHERE NOT EXISTS (SELECT 1 FROM token_pricing t WHERE t.action = v.action);

-- Runway API key (secret) and the admin toggles for the module and each mode.
-- Toggles must be non-secret so the Studio can read them; all start OFF.
INSERT INTO admin_settings (key, value, category, is_secret, updated_at)
VALUES
  ('runway_api_key',                 '',      'ai_providers', true,  now()),
  ('runway_enabled',                 'false', 'ai_providers', false, now()),
  ('video_remix_enabled',            'false', 'ai_providers', false, now()),
  ('video_remix_restyle_enabled',    'false', 'ai_providers', false, now()),
  ('video_remix_recreate_enabled',   'false', 'ai_providers', false, now()),
  ('video_remix_actor_swap_enabled', 'false', 'ai_providers', false, now())
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category,
      is_secret = EXCLUDED.is_secret;
