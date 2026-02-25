CREATE TABLE IF NOT EXISTS email_verification_codes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(100) NOT NULL,
  code_hash VARCHAR(64) NOT NULL,
  code_salt VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  last_sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verify_user_created
  ON email_verification_codes(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_verify_expires
  ON email_verification_codes(expires_at);

CREATE INDEX IF NOT EXISTS idx_email_verify_unconsumed
  ON email_verification_codes(user_id, consumed_at);
