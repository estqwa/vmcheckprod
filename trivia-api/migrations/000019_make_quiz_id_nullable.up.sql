-- Миграция: делаем quiz_id nullable для поддержки общего пула вопросов

-- 1. Делаем quiz_id nullable (разрешаем NULL)
ALTER TABLE questions ALTER COLUMN quiz_id DROP NOT NULL;

-- 2. Индекс для быстрого поиска в пуле (quiz_id IS NULL)
CREATE INDEX IF NOT EXISTS idx_questions_pool 
ON questions(difficulty, is_used) 
WHERE quiz_id IS NULL AND is_used = FALSE;

-- 3. Индекс для поиска по викторине с учётом сложности
CREATE INDEX IF NOT EXISTS idx_questions_quiz_difficulty 
ON questions(quiz_id, difficulty, is_used) 
WHERE is_used = FALSE;

-- Примечание: вопросы с quiz_id = NULL относятся к общему пулу
-- и используются адаптивной системой когда у викторины нет своих вопросов нужной сложности
