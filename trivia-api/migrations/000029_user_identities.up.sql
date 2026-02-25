CREATE TABLE IF NOT EXISTS user_identities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL,
  provider_sub VARCHAR(255) NOT NULL,
  provider_email VARCHAR(100),
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(provider, provider_sub)
);

CREATE INDEX IF NOT EXISTS idx_user_identities_user
  ON user_identities(user_id);

CREATE INDEX IF NOT EXISTS idx_user_identities_provider_email
  ON user_identities(provider, provider_email);
