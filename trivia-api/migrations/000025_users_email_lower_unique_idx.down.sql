-- Rollback: remove the case-insensitive email index
DROP INDEX IF EXISTS idx_users_email_lower;
