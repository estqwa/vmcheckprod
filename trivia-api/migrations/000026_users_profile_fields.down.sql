ALTER TABLE users
  DROP COLUMN IF EXISTS first_name,
  DROP COLUMN IF EXISTS last_name,
  DROP COLUMN IF EXISTS birth_date,
  DROP COLUMN IF EXISTS gender,
  DROP COLUMN IF EXISTS email_verified_at,
  DROP COLUMN IF EXISTS profile_completed_at;
