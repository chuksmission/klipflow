-- Showcase Studio (admin-only)
-- Run once in the Supabase SQL editor, after supabase/showcase.sql.

-- Manual ordering of homepage showcase items (lower numbers show first)
ALTER TABLE generations ADD COLUMN IF NOT EXISTS featured_sort integer NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS generations_featured_idx;
CREATE INDEX IF NOT EXISTS generations_featured_idx
  ON generations (is_featured, featured_sort, created_at DESC)
  WHERE is_featured = true;

-- Token balance the Showcase Studio spends from (separate from any user's tokens).
-- Change it any time from Admin > Showcase Studio.
INSERT INTO admin_settings (key, value, category, is_secret, updated_at)
VALUES ('admin_token_balance', '1000', 'showcase', false, now())
ON CONFLICT (key) DO NOTHING;
