-- ============================================
-- AD CONCEPTS TABLE
-- PostgreSQL (Supabase)
-- Admin-managed template library
-- ============================================

CREATE TABLE IF NOT EXISTS ad_concepts (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Concept Info
  category                  concept_category NOT NULL,
  name                      VARCHAR(255) NOT NULL,
  description               TEXT,
  
  -- Media
  image_url                 VARCHAR(500) NOT NULL,
  source_url                VARCHAR(500),
  
  -- Metadata
  tags                      TEXT[] NOT NULL DEFAULT '{}',
  
  -- Display & Status
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  display_order             INTEGER NOT NULL DEFAULT 0,
  usage_count               INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ad_concepts_category ON ad_concepts (category);
CREATE INDEX idx_ad_concepts_active ON ad_concepts (is_active, display_order);
CREATE INDEX idx_ad_concepts_tags ON ad_concepts USING GIN (tags);
