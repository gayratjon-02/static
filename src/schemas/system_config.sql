-- ============================================
-- SYSTEM CONFIG TABLE
-- PostgreSQL (Supabase)
-- Admin-configurable settings
-- ============================================

CREATE TABLE IF NOT EXISTS system_config (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Config
  key                       VARCHAR(100) NOT NULL UNIQUE,
  value                     JSONB NOT NULL,
  description               TEXT,
  
  -- Timestamps
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default config values
INSERT INTO system_config (key, value, description) VALUES
  ('credits_per_generation', '5', 'Credits consumed per ad generation (produces 6 variations)'),
  ('credits_per_fix_errors', '2', 'Credits consumed per fix errors action'),
  ('credits_per_regenerate_single', '2', 'Credits consumed per single slot regeneration'),
  ('addon_credits_amount', '100', 'Number of credits in add-on package'),
  ('addon_credits_price_cents', '1500', 'Price of credit add-on in cents'),
  ('canva_template_price_cents', '2500', 'Default Canva template price in cents'),
  ('canva_discount_pro', '0.10', 'Canva template discount for Pro tier'),
  ('canva_discount_agency', '0.20', 'Canva template discount for Agency tier'),
  ('payment_grace_days', '3', 'Days grace period for failed payments')
ON CONFLICT (key) DO NOTHING;
