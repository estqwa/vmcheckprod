-- Откат миграции 000019

-- Удаляем индексы
DROP INDEX IF EXISTS idx_questions_pool;
DROP INDEX IF EXISTS idx_questions_quiz_difficulty;

-- Примечание: НЕ возвращаем NOT NULL для quiz_id, т.к. в таблице могут быть NULL значения
-- Если нужен полный откат, сначала удалите все вопросы с quiz_id IS NULL:
-- DELETE FROM questions WHERE quiz_id IS NULL;
-- ALTER TABLE questions ALTER COLUMN quiz_id SET NOT NULL;
