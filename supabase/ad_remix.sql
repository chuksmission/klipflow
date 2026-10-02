-- Ad Remix Engine (admin-only)
-- Run once in the Supabase SQL editor. Not required for the page to load;
-- without it, talking-head videos are priced at the default of 20 tokens/min.

-- Price of HeyGen talking-head avatar videos, per minute of script
-- (charged to the admin showcase balance; editable in Admin > Token Pricing)
INSERT INTO token_pricing (action, description, icon, tokens, updated_at)
SELECT 'heygen_avatar', 'HeyGen talking-head avatar (per minute)', '🎙️', 20, now()
WHERE NOT EXISTS (SELECT 1 FROM token_pricing WHERE action = 'heygen_avatar');

-- Competitor uploads go to the existing public "generation-inputs" bucket under
-- the admin-uploads/ folder, so no new bucket is needed. Its file-size limit
-- must be at least 25MB (the transcription limit).
