-- ============================================
-- BRAND ENUMS
-- PostgreSQL (Supabase)
-- ============================================

CREATE TYPE brand_industry AS ENUM (
  'ecommerce',
  'supplements',
  'apparel',
  'beauty',
  'food_beverage',
  'saas',
  'fitness',
  'home_goods',
  'pets',
  'financial_services',
  'education',
  'other'
);

CREATE TYPE brand_voice AS ENUM (
  'professional',
  'playful',
  'bold',
  'minimalist',
  'luxurious',
  'friendly',
  'edgy',
  'trustworthy',
  'youthful',
  'authoritative'
);
