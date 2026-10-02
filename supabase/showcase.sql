-- Homepage showcase / templates
-- Run once in the Supabase SQL editor.
-- Admins mark generations as featured from Admin > Generations; featured
-- items appear on the homepage with a "Use this" button that opens the
-- Studio pre-filled with the same prompt, model and settings.

ALTER TABLE generations ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS featured_category text;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS featured_title text;

CREATE INDEX IF NOT EXISTS generations_featured_idx
  ON generations (is_featured, created_at DESC)
  WHERE is_featured = true;
