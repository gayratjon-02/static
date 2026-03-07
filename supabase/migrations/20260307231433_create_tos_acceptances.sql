-- ============================================
-- Create tos_acceptances table
-- ============================================

CREATE TABLE IF NOT EXISTS tos_acceptances (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES users(_id) ON DELETE CASCADE,
  tos_version               VARCHAR(50) NOT NULL,
  accepted_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address                INET NOT NULL,
  user_agent                TEXT NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tos_acceptances_user_id ON tos_acceptances(user_id);

ALTER TABLE tos_acceptances ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own acceptances
CREATE POLICY tos_acceptances_select_own ON tos_acceptances 
  FOR SELECT USING (auth.uid() = user_id);

-- Depending on how the backend inserts the record:
-- If it uses service_role, RLS doesn't block it.
-- If it uses the user's session token after account creation, they can insert their own.
CREATE POLICY tos_acceptances_insert_own ON tos_acceptances 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

