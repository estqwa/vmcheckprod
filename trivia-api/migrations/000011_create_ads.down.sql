BEGIN;

DROP INDEX IF EXISTS idx_quiz_ad_slots_ad_asset_id;
DROP INDEX IF EXISTS idx_quiz_ad_slots_quiz_id;
DROP TABLE IF EXISTS quiz_ad_slots;
DROP TABLE IF EXISTS ad_assets;

COMMIT;
