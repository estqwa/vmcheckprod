-- Добавляем поле difficulty (уровень сложности 1-5)
-- 1=very_easy, 2=easy, 3=medium, 4=hard, 5=very_hard
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS difficulty INT NOT NULL DEFAULT 3;

-- Добавляем поле is_used (использован ли вопрос в викторине)
-- После использования вопрос больше не берётся автоматически
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS is_used BOOLEAN NOT NULL DEFAULT FALSE;

-- Создаём индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_is_used ON questions(is_used);

-- Составной индекс для поиска неиспользованных вопросов по сложности
CREATE INDEX IF NOT EXISTS idx_questions_difficulty_unused ON questions(difficulty, is_used) 
WHERE is_used = FALSE;

-- Constraint для валидации difficulty
ALTER TABLE questions 
ADD CONSTRAINT chk_difficulty CHECK (difficulty >= 1 AND difficulty <= 5);

COMMENT ON COLUMN questions.difficulty IS 'Уровень сложности: 1=very_easy, 2=easy, 3=medium, 4=hard, 5=very_hard';
COMMENT ON COLUMN questions.is_used IS 'Был ли вопрос использован в викторине (исключается из автовыбора)';
