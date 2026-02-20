-- ============================================
-- CONCEPT_CATEGORIES TABLE
-- PostgreSQL (Supabase)
-- Database-driven category management
-- ============================================

CREATE TABLE IF NOT EXISTS concept_categories (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Category Info
  name                      VARCHAR(100) NOT NULL,
  slug                      VARCHAR(100) NOT NULL UNIQUE,
  description               TEXT,

  -- Display
  display_order             INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_concept_categories_slug ON concept_categories (slug);
CREATE INDEX idx_concept_categories_order ON concept_categories (display_order);
