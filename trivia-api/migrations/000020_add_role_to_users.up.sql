-- Добавляем поле role в таблицу users
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';

-- Устанавливаем первого пользователя как админа
UPDATE users SET role = 'admin' WHERE id = 1;

-- Добавляем CHECK constraint для допустимых ролей (идемпотентно)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_role'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IN ('user', 'admin'));
    END IF;
END $$;

-- Индекс для быстрого поиска по роли
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

