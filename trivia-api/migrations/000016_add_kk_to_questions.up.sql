-- Миграция: добавить казахские поля для вопросов
-- text_kk и options_kk опциональны — если не заполнены, используется русская версия

ALTER TABLE questions 
  ADD COLUMN text_kk VARCHAR(500),
  ADD COLUMN options_kk JSONB;

COMMENT ON COLUMN questions.text_kk IS 'Текст вопроса на казахском языке (опционально)';
COMMENT ON COLUMN questions.options_kk IS 'Варианты ответов на казахском языке (опционально)';
