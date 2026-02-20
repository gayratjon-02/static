-- ============================================
-- CANVA ORDERS TABLE
-- PostgreSQL (Supabase)
-- Canva template purchases
-- ============================================

CREATE TABLE IF NOT EXISTS canva_orders (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  user_id                   UUID NOT NULL REFERENCES users(_id) ON DELETE CASCADE,
  generated_ad_id           UUID NOT NULL REFERENCES generated_ads(_id) ON DELETE CASCADE,
  
  -- Payment
  stripe_payment_id         VARCHAR(255) NOT NULL,
  price_paid_cents          INTEGER NOT NULL,
  
  -- Status
  status                    canva_order_status NOT NULL DEFAULT 'pending',
  
  -- Fulfillment
  canva_link                VARCHAR(500),
  fulfilled_at              TIMESTAMPTZ,
  fulfilled_by              UUID REFERENCES users(_id),
  
  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_canva_orders_user_id ON canva_orders (user_id);
CREATE INDEX idx_canva_orders_status ON canva_orders (status);
CREATE INDEX idx_canva_orders_generated_ad ON canva_orders (generated_ad_id);

-- Row Level Security
ALTER TABLE canva_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY canva_orders_select_own ON canva_orders FOR SELECT USING (auth.uid() = user_id);
