-- Откат миграции 000018

-- Удаляем constraint
ALTER TABLE questions DROP CONSTRAINT IF EXISTS chk_difficulty;

-- Удаляем индексы
DROP INDEX IF EXISTS idx_questions_difficulty_unused;
DROP INDEX IF EXISTS idx_questions_is_used;
DROP INDEX IF EXISTS idx_questions_difficulty;

-- Удаляем колонки
ALTER TABLE questions DROP COLUMN IF EXISTS is_used;
ALTER TABLE questions DROP COLUMN IF EXISTS difficulty;
