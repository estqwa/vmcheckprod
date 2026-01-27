-- Добавление пропущенной колонки updated_at в таблицу results
-- Это поле требуется GORM для Result entity, но было пропущено в 000001_init_schema.up.sql
ALTER TABLE results ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Комментарий для ясности
COMMENT ON COLUMN results.updated_at IS 'Время последнего обновления записи результата';
