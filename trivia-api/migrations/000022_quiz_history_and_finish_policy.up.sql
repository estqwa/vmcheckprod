ALTER TABLE quizzes
ADD COLUMN IF NOT EXISTS finish_on_zero_players BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS quiz_question_history (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
    question_order INTEGER NOT NULL,
    asked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_question_history_quiz_order
    ON quiz_question_history (quiz_id, question_order);

CREATE INDEX IF NOT EXISTS idx_quiz_question_history_quiz
    ON quiz_question_history (quiz_id);

CREATE INDEX IF NOT EXISTS idx_quiz_question_history_question
    ON quiz_question_history (question_id);
