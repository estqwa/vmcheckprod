ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_auth_enabled BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE users
SET password_auth_enabled = TRUE
WHERE password_auth_enabled IS NULL;
