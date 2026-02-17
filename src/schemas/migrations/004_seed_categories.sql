-- ============================================
-- MIGRATION 004: Seed Concept Categories
-- Inserts the standard 22 categories if missing.
-- Safe to run multiple times (ON CONFLICT DO NOTHING).
-- ============================================

INSERT INTO concept_categories (name, slug, description, display_order) VALUES
  ('Social Proof', 'social_proof', 'Review count, star ratings, badges', 1),
  ('Before & After', 'before_after', 'Split-screen transformation comparison', 2),
  ('Feature Callout', 'feature_callout', 'Callout arrows/lines pointing to product features', 3),
  ('Listicle', 'listicle', 'Numbered list of benefits or features', 4),
  ('Comparison', 'comparison', 'Side-by-side brand comparison', 5),
  ('UGC Style', 'ugc_style', 'Casual, native-looking creative', 6),
  ('Editorial', 'editorial', 'Educational content as an ad', 7),
  ('Bold Offer', 'bold_offer', 'Discount, sale, limited-time offer', 8),
  ('Minimalist', 'minimalist', 'Clean, minimal design with focus on product', 9),
  ('Lifestyle', 'lifestyle', 'Product shown in context', 10),
  ('Feature Pointers', 'feature_pointers', 'Callout arrows/lines pointing to product features', 11),
  ('Testimonial', 'testimonial', 'Customer quote overlaid on product image', 12),
  ('Us vs. Them', 'us_vs_them', 'Side-by-side brand comparison', 13),
  ('Stat / Data', 'stat_data', 'Bold statistic or data point', 14),
  ('Unboxing / Flat Lay', 'unboxing_flat_lay', 'Product packaging display', 15),
  ('Ingredient Spotlight', 'ingredient_spotlight', 'Close-up on key ingredients', 16),
  ('Offer / Promo', 'offer_promo', 'Discount, sale, limited-time offer', 17),
  ('Problem → Solution', 'problem_solution', 'Pain point then presents product', 18),
  ('Founder / Brand Story', 'founder_brand_story', 'Personal message from founder', 19),
  ('Infographic', 'infographic', 'Educational content as an ad', 20),
  ('Meme / UGC Style', 'meme_ugc_style', 'Casual, native-looking creative', 21),
  ('Comparison Chart', 'comparison_chart', 'Feature comparison table/grid', 22)
ON CONFLICT (slug) DO NOTHING;
