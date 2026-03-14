-- Canva OAuth connections
CREATE TABLE IF NOT EXISTS canva_connections (
  _id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(_id) ON DELETE CASCADE,
  canva_user_id    VARCHAR(255),
  access_token     TEXT NOT NULL,
  refresh_token    TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scopes           TEXT,
  status           VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_canva_connections_user_id ON canva_connections (user_id);
CREATE INDEX idx_canva_connections_status ON canva_connections (status);

-- Temporary PKCE state storage
CREATE TABLE IF NOT EXISTS canva_oauth_states (
  _id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(_id) ON DELETE CASCADE,
  state            VARCHAR(128) NOT NULL UNIQUE,
  code_verifier    VARCHAR(128) NOT NULL,
  redirect_uri     VARCHAR(500) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

CREATE INDEX idx_canva_oauth_states_state ON canva_oauth_states (state);
