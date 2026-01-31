-- Миграция: добавить поле language в таблицу users
-- По умолчанию 'ru' (русский)

ALTER TABLE users ADD COLUMN language VARCHAR(5) NOT NULL DEFAULT 'ru';

COMMENT ON COLUMN users.language IS 'Язык интерфейса пользователя: ru (русский) или kk (казахский)';
