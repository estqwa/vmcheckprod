-- Stage 1: Add token_hash column alongside legacy token column for zero-downtime migration.
-- After this migration, backend will write both token and token_hash, read primarily by token_hash.

-- Enable pgcrypto for digest function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add token_hash column (nullable initially for backfill)
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS token_hash TEXT;

-- Backfill existing tokens: compute SHA-256 hash
UPDATE refresh_tokens
SET token_hash = encode(digest(token, 'sha256'), 'hex')
WHERE token_hash IS NULL AND token IS NOT NULL;

-- Make token_hash NOT NULL after backfill
ALTER TABLE refresh_tokens ALTER COLUMN token_hash SET NOT NULL;

-- Create unique index on token_hash
CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
