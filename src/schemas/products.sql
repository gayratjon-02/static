-- ============================================
-- PRODUCTS TABLE
-- PostgreSQL (Supabase)
-- ============================================

CREATE TABLE IF NOT EXISTS products (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id                  UUID NOT NULL REFERENCES brands(_id) ON DELETE CASCADE,
  
  -- Required Fields
  name                      VARCHAR(100) NOT NULL,
  description               TEXT NOT NULL,
  usps                      TEXT[] NOT NULL DEFAULT '{}',
  photo_url                 VARCHAR(500) NOT NULL,
  has_physical_product      BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Optional Enrichment
  price_text                VARCHAR(100),
  product_url               VARCHAR(500),
  star_rating               DECIMAL(2,1) CHECK (star_rating >= 1.0 AND star_rating <= 5.0),
  review_count              INTEGER CHECK (review_count >= 0),
  ingredients_features      TEXT,
  before_description        TEXT,
  after_description         TEXT,
  offer_text                VARCHAR(500),
  
  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_products_brand_id ON products (brand_id);

-- Auto-update updated_at trigger
CREATE TRIGGER trigger_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_select_own ON products FOR SELECT 
  USING (EXISTS (SELECT 1 FROM brands WHERE brands._id = products.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY products_insert_own ON products FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM brands WHERE brands._id = products.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY products_update_own ON products FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM brands WHERE brands._id = products.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY products_delete_own ON products FOR DELETE 
  USING (EXISTS (SELECT 1 FROM brands WHERE brands._id = products.brand_id AND brands.user_id = auth.uid()));
