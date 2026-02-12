-- ============================================
-- USER ENUMS
-- PostgreSQL (Supabase)
-- ============================================

CREATE TYPE member_type AS ENUM (
  'individual',
  'business',
  'enterprise'
);

CREATE TYPE member_status AS ENUM (
  'active',
  'inactive',
  'suspended',
  'deleted'
);

CREATE TYPE member_auth_type AS ENUM (
  'email',
  'google',
  'apple',
  'facebook'
);
