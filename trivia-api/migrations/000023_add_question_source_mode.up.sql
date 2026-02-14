ALTER TABLE quizzes
ADD COLUMN IF NOT EXISTS question_source_mode VARCHAR(20) NOT NULL DEFAULT 'hybrid';

UPDATE quizzes
SET question_source_mode = 'hybrid'
WHERE question_source_mode IS NULL OR question_source_mode = '';
