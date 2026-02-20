-- ============================================
-- CREDIT TRANSACTIONS TABLE
-- PostgreSQL (Supabase)
-- Track credit usage and purchases
-- ============================================

CREATE TABLE IF NOT EXISTS credit_transactions (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User
  user_id                   UUID NOT NULL REFERENCES users(_id) ON DELETE CASCADE,
  
  -- Transaction Details
  credits_amount            INTEGER NOT NULL,
  transaction_type          VARCHAR(50) NOT NULL,
  -- Types: generation, fix_errors, regenerate_single, addon_purchase, monthly_reset
  
  -- Reference
  reference_id              UUID,
  reference_type            VARCHAR(50),
  -- e.g., generated_ad_id, stripe_payment_id
  
  -- Balance
  balance_before            INTEGER NOT NULL,
  balance_after             INTEGER NOT NULL,
  
  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions (user_id);
CREATE INDEX idx_credit_transactions_type ON credit_transactions (transaction_type);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions (created_at);

-- Row Level Security
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_transactions_select_own ON credit_transactions FOR SELECT USING (auth.uid() = user_id);
