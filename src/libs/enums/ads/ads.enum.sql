-- ============================================
-- AD GENERATION ENUMS
-- PostgreSQL (Supabase)
-- ============================================

-- Ad Concept Categories
CREATE TYPE concept_category AS ENUM (
  'social_proof',
  'before_after',
  'feature_callout',
  'listicle',
  'comparison',
  'ugc_style',
  'editorial',
  'bold_offer',
  'minimalist',
  'lifestyle'
);

-- Aspect Ratios (Meta placements)
CREATE TYPE aspect_ratio AS ENUM (
  '1:1',
  '9:16',
  '16:9'
);

-- Generation Status
CREATE TYPE generation_status AS ENUM (
  'pending',
  'generating',
  'completed',
  'failed'
);

-- Canva Order Status
CREATE TYPE canva_order_status AS ENUM (
  'pending',
  'in_progress',
  'fulfilled',
  'refunded'
);
