-- ============================================
-- SUBSCRIPTION TIERS TABLE
-- PostgreSQL (Supabase)
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_tiers (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_key                  subscription_tier NOT NULL UNIQUE,
  display_name              VARCHAR(100) NOT NULL,
  monthly_price_cents       INTEGER NOT NULL DEFAULT 0,
  annual_price_cents        INTEGER NOT NULL DEFAULT 0,
  credits_per_month         INTEGER NOT NULL DEFAULT 0,
  max_brands                INTEGER NOT NULL DEFAULT 1,
  max_products_per_brand    INTEGER NOT NULL DEFAULT 5,
  stripe_monthly_price_id   VARCHAR(255) NOT NULL DEFAULT '',
  stripe_annual_price_id    VARCHAR(255) NOT NULL DEFAULT '',
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  display_order             INTEGER NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for active tiers sorted by display order
CREATE INDEX idx_subscription_tiers_active ON subscription_tiers (is_active, display_order);

-- Auto-update updated_at trigger
CREATE TRIGGER trigger_subscription_tiers_updated_at
  BEFORE UPDATE ON subscription_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
