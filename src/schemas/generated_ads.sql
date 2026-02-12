-- ============================================
-- GENERATED ADS TABLE
-- PostgreSQL (Supabase)
-- ============================================

CREATE TABLE IF NOT EXISTS generated_ads (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  user_id                   UUID NOT NULL REFERENCES users(_id) ON DELETE CASCADE,
  brand_id                  UUID NOT NULL REFERENCES brands(_id) ON DELETE CASCADE,
  product_id                UUID NOT NULL REFERENCES products(_id) ON DELETE CASCADE,
  concept_id                UUID REFERENCES ad_concepts(_id) ON DELETE SET NULL,
  folder_id                 UUID REFERENCES ad_folders(_id) ON DELETE SET NULL,
  
  -- User Input
  important_notes           TEXT,
  
  -- AI Response Data
  claude_response_json      JSONB NOT NULL,
  gemini_prompt             TEXT NOT NULL,
  
  -- Generated Images (all 3 ratios)
  image_url_1x1             VARCHAR(500),
  image_url_9x16            VARCHAR(500),
  image_url_16x9            VARCHAR(500),
  
  -- Ad Copy (structured)
  ad_copy_json              JSONB NOT NULL,
  -- Format: { headline, subheadline, body_text, callout_texts[], cta_text }
  
  -- Status
  generation_status         generation_status NOT NULL DEFAULT 'pending',
  
  -- Organization
  ad_name                   VARCHAR(255),
  is_saved                  BOOLEAN NOT NULL DEFAULT FALSE,
  is_favorite               BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Snapshot of brand/product data at generation time
  brand_snapshot            JSONB,
  product_snapshot          JSONB,
  
  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_generated_ads_user_id ON generated_ads (user_id);
CREATE INDEX idx_generated_ads_brand_id ON generated_ads (brand_id);
CREATE INDEX idx_generated_ads_product_id ON generated_ads (product_id);
CREATE INDEX idx_generated_ads_concept_id ON generated_ads (concept_id);
CREATE INDEX idx_generated_ads_folder_id ON generated_ads (folder_id);
CREATE INDEX idx_generated_ads_saved ON generated_ads (user_id, is_saved) WHERE is_saved = TRUE;
CREATE INDEX idx_generated_ads_favorite ON generated_ads (user_id, is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX idx_generated_ads_status ON generated_ads (generation_status);

-- Row Level Security
ALTER TABLE generated_ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY generated_ads_select_own ON generated_ads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY generated_ads_insert_own ON generated_ads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY generated_ads_update_own ON generated_ads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY generated_ads_delete_own ON generated_ads FOR DELETE USING (auth.uid() = user_id);
