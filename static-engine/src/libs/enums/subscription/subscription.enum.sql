-- ============================================
-- SUBSCRIPTION & PAYMENT ENUMS
-- PostgreSQL (Supabase)
-- ============================================

CREATE TYPE subscription_tier AS ENUM (
  'free',
  'starter',
  'pro',
  'growth'
);

CREATE TYPE subscription_status AS ENUM (
  'active',
  'inactive',
  'canceled',
  'past_due',
  'trialing'
);

CREATE TYPE billing_interval AS ENUM (
  'monthly',
  'annual'
);
