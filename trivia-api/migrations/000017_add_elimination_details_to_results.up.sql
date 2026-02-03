-- Добавляем поля для отслеживания выбытия в таблицу results
ALTER TABLE results
ADD COLUMN IF NOT EXISTS eliminated_on_question INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS elimination_reason VARCHAR(50) DEFAULT NULL;

-- Комментарии для документации
COMMENT ON COLUMN results.eliminated_on_question IS 'Номер вопроса, на котором игрок выбыл (1-indexed)';
COMMENT ON COLUMN results.elimination_reason IS 'Причина выбытия: time_exceeded, incorrect_answer, no_answer_timeout, disconnected';
