-- Safety pre-check:
-- do not mutate existing in-progress quizzes automatically.
-- If data is already inconsistent, stop migration and require manual cleanup.
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM quizzes WHERE status = 'in_progress') > 1 THEN
        RAISE EXCEPTION 'Cannot apply idx_quiz_single_in_progress: more than one quiz is already in_progress';
    END IF;
END $$;

-- Partial unique index: allows exactly one row with status='in_progress'
CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_single_in_progress
    ON quizzes ((1)) WHERE status = 'in_progress';
