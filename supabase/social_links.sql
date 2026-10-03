-- Social profile URLs (Admin → Site Settings). Empty value = icon hidden on the homepage.
INSERT INTO admin_settings (key, value, category, is_secret, updated_at)
VALUES
  ('social_tiktok',    '', 'general', false, now()),
  ('social_instagram', '', 'general', false, now()),
  ('social_youtube',   '', 'general', false, now()),
  ('social_discord',   '', 'general', false, now()),
  ('social_x',         '', 'general', false, now()),
  ('social_facebook',  '', 'general', false, now()),
  ('social_linkedin',  '', 'general', false, now())
ON CONFLICT (key) DO UPDATE
  SET category = 'general',
      is_secret = false;

-- Repair: saving Site Settings used to clear the category on its rows, so the
-- page stopped finding them. Put them back under "general".
UPDATE admin_settings
SET category = 'general'
WHERE category IS NULL
  AND key IN ('site_name', 'site_url', 'support_email', 'free_trial_tokens', 'max_accounts_per_device');
