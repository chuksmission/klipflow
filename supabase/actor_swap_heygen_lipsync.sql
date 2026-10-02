-- AI Actor Swap now lip-syncs with HeyGen (heygen_api_key), not Sync Labs.
-- Removes the Sync Labs settings created by actor_swap.sql.
DELETE FROM admin_settings WHERE key IN ('synclabs_api_key', 'synclabs_enabled');
