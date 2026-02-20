-- ============================================
-- MIGRATION 005: Fix subscription_tier enum
-- Adds 'starter' and 'growth' values that the
-- application code expects but were missing from
-- the PostgreSQL enum type.
-- ============================================

-- 1. Add missing enum values
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'starter';
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'growth';

-- 2. Update subscription_tiers table: basic → starter
UPDATE subscription_tiers
SET tier_key = 'starter',
    display_name = 'Starter',
    monthly_price_cents = 3900,
    annual_price_cents = 39000,
    features = '["250 credits/month", "3 brands", "10 products per brand", "Priority support", "All Free features"]'::jsonb,
    updated_at = NOW()
WHERE tier_key = 'basic';

-- 3. Update subscription_tiers table: agency → growth
UPDATE subscription_tiers
SET tier_key = 'growth',
    display_name = 'Growth',
    monthly_price_cents = 19900,
    annual_price_cents = 199000,
    features = '["2,000 credits/month", "Unlimited brands", "100 products per brand", "Dedicated support", "All Pro features"]'::jsonb,
    updated_at = NOW()
WHERE tier_key = 'agency';

-- 4. Update any existing users with old tier names
UPDATE users SET subscription_tier = 'starter' WHERE subscription_tier = 'basic';
UPDATE users SET subscription_tier = 'growth' WHERE subscription_tier = 'agency';

-- 5. Update any existing subscriptions with old tier names
UPDATE subscriptions SET tier = 'starter' WHERE tier = 'basic';
UPDATE subscriptions SET tier = 'growth' WHERE tier = 'agency';
