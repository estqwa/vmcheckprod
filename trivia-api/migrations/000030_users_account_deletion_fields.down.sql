ALTER TABLE users
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS deletion_reason;
