-- ============================================
-- MEMBERS TABLE
-- PostgreSQL (Supabase)
-- ============================================

CREATE TABLE IF NOT EXISTS members (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_type               member_type NOT NULL,
  member_status             member_status NOT NULL DEFAULT 'active',
  member_auth_type          member_auth_type NOT NULL,
  payment_status            payment_status NOT NULL DEFAULT 'inactive',
  full_name                 VARCHAR(255) NOT NULL,
  member_email              VARCHAR(255) NOT NULL UNIQUE,
  member_password           VARCHAR(255) NOT NULL,
  profile_image_url         VARCHAR(500) NOT NULL DEFAULT '',
  stripe_customer_id        VARCHAR(255) NOT NULL DEFAULT '',
  subscription_tier         subscription_tier NOT NULL DEFAULT 'free',
  subscription_status       subscription_status NOT NULL DEFAULT 'inactive',
  credits_used              INTEGER DEFAULT 0,
  credits_limit             INTEGER DEFAULT 0,
  billing_cycle_start       TIMESTAMPTZ,
  addon_credits_remaining   INTEGER NOT NULL DEFAULT 0,
  billing_cycle_end         TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for email lookup
CREATE INDEX idx_members_email ON members (member_email);

-- Index for stripe customer
CREATE INDEX idx_members_stripe_customer ON members (stripe_customer_id);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
