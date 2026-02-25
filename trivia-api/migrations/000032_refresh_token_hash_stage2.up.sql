-- In PostgreSQL the legacy unique "index" name may actually be a backing index
-- for a UNIQUE constraint (refresh_tokens_token_key). Dropping the index directly
-- fails if the constraint still owns it.
ALTER TABLE refresh_tokens DROP CONSTRAINT IF EXISTS refresh_tokens_token_key;
ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS token;
