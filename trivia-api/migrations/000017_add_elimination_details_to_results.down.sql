-- Откат миграции: удаляем поля выбытия
ALTER TABLE results
DROP COLUMN IF EXISTS eliminated_on_question,
DROP COLUMN IF EXISTS elimination_reason;
