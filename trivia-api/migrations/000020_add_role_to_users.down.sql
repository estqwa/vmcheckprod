-- Удаляем индекс
DROP INDEX IF EXISTS idx_users_role;

-- Удаляем CHECK constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;

-- Удаляем колонку role
ALTER TABLE users DROP COLUMN IF EXISTS role;
