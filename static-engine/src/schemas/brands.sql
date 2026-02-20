-- ============================================
-- BRANDS TABLE
-- PostgreSQL (Supabase)
-- ============================================

CREATE TABLE IF NOT EXISTS brands (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES users(_id) ON DELETE CASCADE,
  
  -- Step 1: Brand Identity
  name                      VARCHAR(100) NOT NULL,
  description               TEXT NOT NULL,
  website_url               VARCHAR(500) NOT NULL,
  industry                  brand_industry NOT NULL DEFAULT 'other',
  
  -- Step 2: Brand Visuals
  logo_url                  VARCHAR(500) DEFAULT '',
  primary_color             VARCHAR(7) NOT NULL DEFAULT '#000000',
  secondary_color           VARCHAR(7) NOT NULL DEFAULT '#FFFFFF',
  accent_color              VARCHAR(7) DEFAULT '#0066FF',
  background_color          VARCHAR(7) DEFAULT '#FFFFFF',
  
  -- Step 3: Brand Voice & Tone
  voice_tags                brand_voice[] NOT NULL DEFAULT '{}',
  target_audience           TEXT NOT NULL,
  competitors               TEXT DEFAULT '',
  
  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_brands_user_id ON brands (user_id);

-- Auto-update updated_at trigger
CREATE TRIGGER trigger_brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY brands_select_own ON brands FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY brands_insert_own ON brands FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY brands_update_own ON brands FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY brands_delete_own ON brands FOR DELETE USING (auth.uid() = user_id);
