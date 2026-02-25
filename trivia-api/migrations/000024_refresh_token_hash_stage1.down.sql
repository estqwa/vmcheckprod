-- Rollback Stage 1: remove token_hash column and index
DROP INDEX IF EXISTS idx_refresh_tokens_token_hash;
ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS token_hash;
