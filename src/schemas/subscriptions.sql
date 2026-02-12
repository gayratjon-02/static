-- ============================================
-- SUBSCRIPTIONS TABLE
-- PostgreSQL (Supabase)
-- ============================================

CREATE TABLE IF NOT EXISTS subscriptions (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id                 UUID NOT NULL REFERENCES members(_id) ON DELETE CASCADE,
  stripe_subscription_id    VARCHAR(255) NOT NULL,
  subscription_tier         subscription_tier NOT NULL,
  subscription_status       subscription_status NOT NULL DEFAULT 'inactive',
  current_period_start      TIMESTAMPTZ NOT NULL,
  current_period_end        TIMESTAMPTZ NOT NULL,
  cancel_at_period_end      BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_customer_id        VARCHAR(255) NOT NULL,
  billing_interval          billing_interval NOT NULL DEFAULT 'monthly',
  canceled_at               TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for member lookup
CREATE INDEX idx_subscriptions_member_id ON subscriptions (member_id);

-- Index for stripe subscription
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions (stripe_subscription_id);

-- Index for stripe customer
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions (stripe_customer_id);

-- Auto-update updated_at trigger
CREATE TRIGGER trigger_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
