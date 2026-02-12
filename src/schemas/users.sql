-- ============================================
-- USERS TABLE
-- PostgreSQL (Supabase)
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Account Info
  email                     VARCHAR(255) NOT NULL UNIQUE,
  full_name                 VARCHAR(255) NOT NULL,
  password_hash             VARCHAR(255),
  avatar_url                VARCHAR(500) DEFAULT '',
  
  -- Auth
  auth_type                 member_auth_type NOT NULL DEFAULT 'email',
  member_type               member_type NOT NULL DEFAULT 'individual',
  member_status             member_status NOT NULL DEFAULT 'active',
  
  -- Stripe
  stripe_customer_id        VARCHAR(255) DEFAULT '',
  
  -- Subscription (denormalized for quick access)
  subscription_tier         subscription_tier NOT NULL DEFAULT 'free',
  subscription_status       subscription_status NOT NULL DEFAULT 'inactive',
  
  -- Credits
  credits_used              INTEGER NOT NULL DEFAULT 0,
  credits_limit             INTEGER NOT NULL DEFAULT 0,
  addon_credits_remaining   INTEGER NOT NULL DEFAULT 0,
  
  -- Billing Cycle
  billing_cycle_start       TIMESTAMPTZ,
  billing_cycle_end         TIMESTAMPTZ,
  
  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_stripe_customer ON users (stripe_customer_id);
CREATE INDEX idx_users_subscription_tier ON users (subscription_tier);

-- Auto-update updated_at trigger
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_select_own ON users FOR SELECT USING (auth.uid() = _id);
CREATE POLICY users_update_own ON users FOR UPDATE USING (auth.uid() = _id);
