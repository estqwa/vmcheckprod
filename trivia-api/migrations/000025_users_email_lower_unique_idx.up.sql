-- Add case-insensitive unique index on normalized email (LOWER + TRIM).
-- Do not mass-update user emails here: it can unexpectedly mutate data.
-- Instead, fail early with a clear error if normalization would create duplicates.
DO $$
DECLARE
	duplicate_count INTEGER;
BEGIN
	SELECT COUNT(*) INTO duplicate_count
	FROM (
		SELECT LOWER(TRIM(email)) AS normalized_email
		FROM users
		WHERE email IS NOT NULL
		GROUP BY LOWER(TRIM(email))
		HAVING COUNT(*) > 1
	) duplicates;

	IF duplicate_count > 0 THEN
		RAISE EXCEPTION 'Cannot create unique normalized email index: found % duplicate normalized email values', duplicate_count;
	END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(TRIM(email)));
