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
