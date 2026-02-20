-- ============================================
-- MIGRATION: Add batch_id and variation_index
-- to generated_ads table
-- Date: 2026-02-17
-- Purpose: Support 6 variations per generation
-- ============================================

-- Add batch_id column (groups 6 variations together)
ALTER TABLE generated_ads ADD COLUMN IF NOT EXISTS batch_id UUID;

-- Add variation_index column (0-5, which variation in the batch)
ALTER TABLE generated_ads ADD COLUMN IF NOT EXISTS variation_index INTEGER NOT NULL DEFAULT 0;

-- Create index for fast batch lookups
CREATE INDEX IF NOT EXISTS idx_generated_ads_batch_id ON generated_ads (batch_id);
