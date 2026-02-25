DROP INDEX IF EXISTS refresh_tokens_token_key;
ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS token;
