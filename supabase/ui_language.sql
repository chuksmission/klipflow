-- Interface language chosen in the language switcher (en, fr, es, pt, ar, hi, de, it, tr, ru, bg, sw).
-- No default on purpose: NULL means "not chosen yet", so a visitor's browser
-- language keeps working until they pick one. A DEFAULT 'en' would make every
-- existing user look like they had chosen English and override their browser.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS ui_language text;
