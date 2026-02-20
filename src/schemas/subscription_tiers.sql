-- ============================================
-- SUBSCRIPTION TIERS TABLE
-- PostgreSQL (Supabase)
-- Pricing plans configuration
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_tiers (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_key                  subscription_tier NOT NULL UNIQUE,
  display_name              VARCHAR(100) NOT NULL,
  
  -- Pricing (in cents)
  monthly_price_cents       INTEGER NOT NULL DEFAULT 0,
  annual_price_cents        INTEGER NOT NULL DEFAULT 0,
  
  -- Limits
  credits_per_month         INTEGER NOT NULL DEFAULT 0,
  max_brands                INTEGER NOT NULL DEFAULT 1,
  max_products_per_brand    INTEGER NOT NULL DEFAULT 5,
  
  -- Stripe Price IDs
  stripe_monthly_price_id   VARCHAR(255) DEFAULT '',
  stripe_annual_price_id    VARCHAR(255) DEFAULT '',
  
  -- Features (JSON for flexibility)
  features                  JSONB NOT NULL DEFAULT '[]',
  
  -- Display
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  display_order             INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_subscription_tiers_active ON subscription_tiers (is_active, display_order);

-- Auto-update updated_at trigger
CREATE TRIGGER trigger_subscription_tiers_updated_at
  BEFORE UPDATE ON subscription_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Default data
INSERT INTO subscription_tiers (tier_key, display_name, monthly_price_cents, annual_price_cents, credits_per_month, max_brands, max_products_per_brand, display_order, features) VALUES
  ('free', 'Free', 0, 0, 25, 1, 3, 0, '["25 credits/month", "1 brand", "3 products per brand", "All ad concepts", "Multi-ratio export"]'::jsonb),
  ('starter', 'Starter', 3900, 39000, 250, 3, 10, 1, '["250 credits/month", "3 brands", "10 products per brand", "Standard support", "All Free features"]'::jsonb),
  ('pro', 'Pro', 9900, 99000, 750, 10, 25, 2, '["750 credits/month", "10 brands", "25 products per brand", "Priority support", "All Starter features"]'::jsonb),
  ('growth', 'Growth', 19900, 199000, 2000, 999, 100, 3, '["2,000 credits/month", "Unlimited brands", "100 products per brand", "Dedicated support", "All Pro features"]'::jsonb)
ON CONFLICT (tier_key) DO NOTHING;
