-- Create user_legal_acceptances table for versioned ToS/Privacy consent tracking
CREATE TABLE IF NOT EXISTS user_legal_acceptances (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tos_version VARCHAR(20) NOT NULL,
  privacy_version VARCHAR(20) NOT NULL,
  marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  accepted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ip VARCHAR(50),
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user ON user_legal_acceptances(user_id);
