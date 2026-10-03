-- Output language & accent saved with each generation (Studio + Showcase Studio).
-- Safe to run more than once. Until it runs, generations still save, just
-- without these two fields.
ALTER TABLE generations ADD COLUMN IF NOT EXISTS language text;  -- ISO code, e.g. 'fr'
ALTER TABLE generations ADD COLUMN IF NOT EXISTS accent   text;  -- e.g. 'Parisian'
