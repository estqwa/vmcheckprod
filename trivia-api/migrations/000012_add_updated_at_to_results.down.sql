-- Откат: удаление колонки updated_at из таблицы results
ALTER TABLE results DROP COLUMN IF EXISTS updated_at;
