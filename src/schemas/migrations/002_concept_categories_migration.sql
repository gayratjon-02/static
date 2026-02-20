-- ============================================
-- MIGRATION 002: Concept Categories
-- Replaces hardcoded concept_category enum
-- with database-driven concept_categories table
-- ============================================

-- Step 1: Create concept_categories table
CREATE TABLE IF NOT EXISTS concept_categories (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      VARCHAR(100) NOT NULL,
  slug                      VARCHAR(100) NOT NULL UNIQUE,
  description               TEXT,
  display_order             INTEGER NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Seed categories from existing enum values
INSERT INTO concept_categories (name, slug, description, display_order) VALUES
  ('Social Proof',      'social_proof',      'Review count, star ratings, badges',                     1),
  ('Before & After',    'before_after',       'Split-screen transformation comparison',                 2),
  ('Feature Callout',   'feature_callout',    'Callout arrows/lines pointing to product features',      3),
  ('Listicle',          'listicle',           'Numbered list of benefits or features',                  4),
  ('Comparison',        'comparison',         'Side-by-side brand comparison',                          5),
  ('UGC Style',         'ugc_style',          'Casual, native-looking creative',                        6),
  ('Editorial',         'editorial',          'Educational content as an ad',                           7),
  ('Bold Offer',        'bold_offer',         'Discount, sale, limited-time offer',                     8),
  ('Minimalist',        'minimalist',         'Clean, minimal design with focus on product',            9),
  ('Lifestyle',         'lifestyle',          'Product shown in context',                              10),
  ('Feature Pointers',  'feature_pointers',   'Callout arrows/lines pointing to product features',     11),
  ('Testimonial',       'testimonial',        'Customer quote overlaid on product image',              12),
  ('Us vs. Them',       'us_vs_them',         'Side-by-side brand comparison',                         13),
  ('Stat / Data',       'stat_data',          'Bold statistic or data point',                          14),
  ('Unboxing / Flat Lay','unboxing_flat_lay', 'Product packaging display',                             15),
  ('Ingredient Spotlight','ingredient_spotlight','Close-up on key ingredients',                         16),
  ('Offer / Promo',     'offer_promo',        'Discount, sale, limited-time offer',                    17),
  ('Problem → Solution','problem_solution',   'Pain point then presents product',                      18),
  ('Founder / Brand Story','founder_brand_story','Personal message from founder',                      19),
  ('Infographic',       'infographic',        'Educational content as an ad',                          20),
  ('Meme / UGC Style',  'meme_ugc_style',     'Casual, native-looking creative',                       21),
  ('Comparison Chart',  'comparison_chart',   'Feature comparison table/grid',                         22)
ON CONFLICT (slug) DO NOTHING;

-- Step 3: Add category_id column to ad_concepts
ALTER TABLE ad_concepts
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES concept_categories(_id);

-- Step 4: Populate category_id from existing category column
-- (map old enum values to new category slugs)
UPDATE ad_concepts ac
SET category_id = cc._id
FROM concept_categories cc
WHERE ac.category::text = cc.slug
  AND ac.category_id IS NULL;

-- Step 5: Add updated_at column if missing
ALTER TABLE ad_concepts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 6: Create index on category_id
CREATE INDEX IF NOT EXISTS idx_ad_concepts_category_id ON ad_concepts (category_id);

-- Note: After verifying data migration, you can drop the old column:
-- ALTER TABLE ad_concepts DROP COLUMN IF EXISTS category;
-- DROP TYPE IF EXISTS concept_category;
