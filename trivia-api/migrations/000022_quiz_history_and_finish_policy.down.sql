DROP INDEX IF EXISTS idx_quiz_question_history_question;
DROP INDEX IF EXISTS idx_quiz_question_history_quiz;
DROP INDEX IF EXISTS idx_quiz_question_history_quiz_order;

DROP TABLE IF EXISTS quiz_question_history;

ALTER TABLE quizzes
DROP COLUMN IF EXISTS finish_on_zero_players;
