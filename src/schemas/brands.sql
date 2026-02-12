-- ============================================
-- BRANDS TABLE
-- PostgreSQL (Supabase)
-- ============================================

CREATE TABLE IF NOT EXISTS brands (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id                 UUID NOT NULL REFERENCES members(_id) ON DELETE CASCADE,
  brand_name                VARCHAR(255) NOT NULL,
  brand_description         TEXT NOT NULL DEFAULT '',
  website_url               VARCHAR(500) NOT NULL DEFAULT '',
  industry                  VARCHAR(255) NOT NULL DEFAULT '',
  brand_logo_url            VARCHAR(500) NOT NULL DEFAULT '',
  primary_color             VARCHAR(20) NOT NULL DEFAULT '#000000',
  secondary_color           VARCHAR(20) NOT NULL DEFAULT '#FFFFFF',
  accent_color              VARCHAR(20) NOT NULL DEFAULT '#0066FF',
  voice_tags                TEXT,
  target_audience           VARCHAR(500) NOT NULL DEFAULT '',
  competitors               VARCHAR(500) NOT NULL DEFAULT '',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for member lookup
CREATE INDEX idx_brands_member_id ON brands (member_id);

-- Auto-update updated_at trigger
CREATE TRIGGER trigger_brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
