-- Добавляем поле prize_fund к викторинам
-- Каждая викторина может иметь свой призовой фонд
-- По умолчанию 1000000 (как было захардкожено раньше)

ALTER TABLE quizzes ADD COLUMN prize_fund INTEGER NOT NULL DEFAULT 1000000;

-- Комментарий
COMMENT ON COLUMN quizzes.prize_fund IS 'Общий призовой фонд викторины (делится поровну между победителями)';
