-- ============================================
-- ADMIN USERS TABLE
-- PostgreSQL (Supabase)
-- ============================================

CREATE TABLE IF NOT EXISTS admin_users (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Account
  email                     VARCHAR(255) NOT NULL UNIQUE,
  name                      VARCHAR(255) NOT NULL,
  password_hash             VARCHAR(255) NOT NULL,
  
  -- Role
  role                      admin_role NOT NULL DEFAULT 'support',
  
  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_admin_users_email ON admin_users (email);
