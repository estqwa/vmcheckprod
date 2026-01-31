-- Откат миграции: удалить поле language из таблицы users

ALTER TABLE users DROP COLUMN language;
