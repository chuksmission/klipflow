-- Homepage showcase details: the input image used, and what the admin lets the
-- public card reveal. Featured items live on generations (is_featured), so the
-- columns go there. Prompts from upload tools (Video Remix, Actor Swap, Series
-- Cloner, Video Translator, demo videos) are never shown, whatever these say.
ALTER TABLE generations ADD COLUMN IF NOT EXISTS source_image_url text;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS show_prompt boolean NOT NULL DEFAULT true;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS show_source_image boolean NOT NULL DEFAULT true;
-- Settings used by upload tools (remix mode, languages, template), shown instead of their private input
ALTER TABLE generations ADD COLUMN IF NOT EXISTS settings jsonb;
