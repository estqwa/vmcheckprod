-- Откат миграции: удалить казахские поля из questions

ALTER TABLE questions 
  DROP COLUMN text_kk,
  DROP COLUMN options_kk;
