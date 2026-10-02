-- AI Video Translator (HeyGen) setup
-- Run once in the Supabase SQL editor.

-- Token pricing: tokens charged per minute of source video (minimum 1 minute's worth)
INSERT INTO token_pricing (action, description, icon, tokens, updated_at)
SELECT 'video_translation', 'AI Video Translator (per minute)', '🌍', 20, now()
WHERE NOT EXISTS (SELECT 1 FROM token_pricing WHERE action = 'video_translation');

-- HeyGen provider settings (shown under Admin > AI Providers)
INSERT INTO admin_settings (key, value, category, is_secret, updated_at)
VALUES
  ('heygen_api_key', '', 'ai_providers', true,  now()),
  ('heygen_enabled', 'false', 'ai_providers', false, now())
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category,
      is_secret = EXCLUDED.is_secret;
