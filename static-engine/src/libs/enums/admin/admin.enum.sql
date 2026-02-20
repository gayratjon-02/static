-- ============================================
-- ADMIN ENUMS
-- PostgreSQL (Supabase)
-- ============================================

CREATE TYPE admin_role AS ENUM (
  'super_admin',
  'content_admin',
  'support'
);

CREATE TYPE prompt_template_type AS ENUM (
  'system',
  'concept_modifier'
);

CREATE TYPE api_type AS ENUM (
  'claude',
  'gemini'
);
