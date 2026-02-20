-- ============================================
-- STATIC ENGINE - FULL DATABASE SCHEMA
-- PostgreSQL (Supabase)
-- Version 1.0 - February 2026
-- ============================================

-- ============================================
-- STEP 1: CREATE ALL ENUMS
-- ============================================

-- User/Member Enums
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

-- Subscription & Payment Enums
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

-- Brand Enums
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

-- Ad Concept Enums
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

-- Ad Generation Enums
CREATE TYPE aspect_ratio AS ENUM (
  '1:1',
  '9:16',
  '16:9'
);

CREATE TYPE generation_status AS ENUM (
  'pending',
  'generating',
  'completed',
  'failed'
);

-- Canva Order Enums
CREATE TYPE canva_order_status AS ENUM (
  'pending',
  'in_progress',
  'fulfilled',
  'refunded'
);

-- Admin Enums
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

-- ============================================
-- STEP 2: CREATE HELPER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 3: CREATE TABLES (in dependency order)
-- ============================================

-- ============================================
-- 3.1 USERS TABLE
-- Core user account information
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Account Info
  email                     VARCHAR(255) NOT NULL UNIQUE,
  full_name                 VARCHAR(255) NOT NULL,
  password_hash             VARCHAR(255),
  avatar_url                VARCHAR(500) DEFAULT '',
  
  -- Auth
  auth_type                 member_auth_type NOT NULL DEFAULT 'email',
  member_type               member_type NOT NULL DEFAULT 'individual',
  member_status             member_status NOT NULL DEFAULT 'active',
  
  -- Stripe
  stripe_customer_id        VARCHAR(255) DEFAULT '',
  
  -- Subscription (denormalized for quick access)
  subscription_tier         subscription_tier NOT NULL DEFAULT 'free',
  subscription_status       subscription_status NOT NULL DEFAULT 'inactive',
  
  -- Credits
  credits_used              INTEGER NOT NULL DEFAULT 0,
  credits_limit             INTEGER NOT NULL DEFAULT 0,
  addon_credits_remaining   INTEGER NOT NULL DEFAULT 0,
  
  -- Billing Cycle
  billing_cycle_start       TIMESTAMPTZ,
  billing_cycle_end         TIMESTAMPTZ,
  
  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_stripe_customer ON users (stripe_customer_id);
CREATE INDEX idx_users_subscription_tier ON users (subscription_tier);

CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY users_select_own ON users FOR SELECT USING (auth.uid() = _id);
CREATE POLICY users_update_own ON users FOR UPDATE USING (auth.uid() = _id);

-- ============================================
-- 3.2 SUBSCRIPTION TIERS TABLE
-- Pricing plans configuration
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_tiers (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_key                  subscription_tier NOT NULL UNIQUE,
  display_name              VARCHAR(100) NOT NULL,
  
  -- Pricing (in cents)
  monthly_price_cents       INTEGER NOT NULL DEFAULT 0,
  annual_price_cents        INTEGER NOT NULL DEFAULT 0,
  
  -- Limits
  credits_per_month         INTEGER NOT NULL DEFAULT 0,
  max_brands                INTEGER NOT NULL DEFAULT 1,
  max_products_per_brand    INTEGER NOT NULL DEFAULT 5,
  
  -- Stripe Price IDs
  stripe_monthly_price_id   VARCHAR(255) DEFAULT '',
  stripe_annual_price_id    VARCHAR(255) DEFAULT '',
  
  -- Features (JSON for flexibility)
  features                  JSONB NOT NULL DEFAULT '[]',
  
  -- Display
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  display_order             INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscription_tiers_active ON subscription_tiers (is_active, display_order);

CREATE TRIGGER trigger_subscription_tiers_updated_at
  BEFORE UPDATE ON subscription_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3.3 SUBSCRIPTIONS TABLE
-- User subscription records
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES users(_id) ON DELETE CASCADE,
  
  -- Stripe
  stripe_subscription_id    VARCHAR(255) NOT NULL UNIQUE,
  stripe_customer_id        VARCHAR(255) NOT NULL,
  
  -- Subscription Details
  tier                      subscription_tier NOT NULL,
  status                    subscription_status NOT NULL DEFAULT 'inactive',
  billing_interval          billing_interval NOT NULL DEFAULT 'monthly',
  
  -- Period
  current_period_start      TIMESTAMPTZ NOT NULL,
  current_period_end        TIMESTAMPTZ NOT NULL,
  
  -- Cancellation
  cancel_at_period_end      BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at               TIMESTAMPTZ,
  
  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions (user_id);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions (stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions (status);

CREATE TRIGGER trigger_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_select_own ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- 3.4 BRANDS TABLE
-- Brand profiles
-- ============================================
CREATE TABLE IF NOT EXISTS brands (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES users(_id) ON DELETE CASCADE,
  
  -- Step 1: Brand Identity
  name                      VARCHAR(100) NOT NULL,
  description               TEXT NOT NULL,
  website_url               VARCHAR(500) NOT NULL,
  industry                  brand_industry NOT NULL DEFAULT 'other',
  
  -- Step 2: Brand Visuals
  logo_url                  VARCHAR(500) DEFAULT '',
  primary_color             VARCHAR(7) NOT NULL DEFAULT '#000000',
  secondary_color           VARCHAR(7) NOT NULL DEFAULT '#FFFFFF',
  accent_color              VARCHAR(7) DEFAULT '#0066FF',
  background_color          VARCHAR(7) DEFAULT '#FFFFFF',
  
  -- Step 3: Brand Voice & Tone
  voice_tags                brand_voice[] NOT NULL DEFAULT '{}',
  target_audience           TEXT NOT NULL,
  competitors               TEXT DEFAULT '',
  
  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brands_user_id ON brands (user_id);

CREATE TRIGGER trigger_brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY brands_select_own ON brands FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY brands_insert_own ON brands FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY brands_update_own ON brands FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY brands_delete_own ON brands FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 3.5 PRODUCTS TABLE
-- Products under brands
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id                  UUID NOT NULL REFERENCES brands(_id) ON DELETE CASCADE,
  
  -- Required Fields
  name                      VARCHAR(100) NOT NULL,
  description               TEXT NOT NULL,
  usps                      TEXT[] NOT NULL DEFAULT '{}',
  photo_url                 VARCHAR(500) NOT NULL,
  has_physical_product      BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Optional Enrichment
  price_text                VARCHAR(100),
  product_url               VARCHAR(500),
  star_rating               DECIMAL(2,1) CHECK (star_rating >= 1.0 AND star_rating <= 5.0),
  review_count              INTEGER CHECK (review_count >= 0),
  ingredients_features      TEXT,
  before_description        TEXT,
  after_description         TEXT,
  offer_text                VARCHAR(500),
  
  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_brand_id ON products (brand_id);

CREATE TRIGGER trigger_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_select_own ON products FOR SELECT 
  USING (EXISTS (SELECT 1 FROM brands WHERE brands._id = products.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY products_insert_own ON products FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM brands WHERE brands._id = products.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY products_update_own ON products FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM brands WHERE brands._id = products.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY products_delete_own ON products FOR DELETE 
  USING (EXISTS (SELECT 1 FROM brands WHERE brands._id = products.brand_id AND brands.user_id = auth.uid()));

-- ============================================
-- 3.6 AD CONCEPTS TABLE
-- Template library (admin managed)
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

CREATE INDEX idx_ad_concepts_category ON ad_concepts (category);
CREATE INDEX idx_ad_concepts_active ON ad_concepts (is_active, display_order);
CREATE INDEX idx_ad_concepts_tags ON ad_concepts USING GIN (tags);

-- ============================================
-- 3.7 AD FOLDERS TABLE
-- User folder organization
-- ============================================
CREATE TABLE IF NOT EXISTS ad_folders (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES users(_id) ON DELETE CASCADE,
  brand_id                  UUID NOT NULL REFERENCES brands(_id) ON DELETE CASCADE,
  
  -- Folder Info
  name                      VARCHAR(100) NOT NULL,
  parent_folder_id          UUID REFERENCES ad_folders(_id) ON DELETE CASCADE,
  
  -- Display
  display_order             INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ad_folders_user_id ON ad_folders (user_id);
CREATE INDEX idx_ad_folders_brand_id ON ad_folders (brand_id);
CREATE INDEX idx_ad_folders_parent ON ad_folders (parent_folder_id);

ALTER TABLE ad_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY ad_folders_select_own ON ad_folders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ad_folders_insert_own ON ad_folders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ad_folders_update_own ON ad_folders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY ad_folders_delete_own ON ad_folders FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 3.8 GENERATED ADS TABLE
-- Generated ad images and data
-- ============================================
CREATE TABLE IF NOT EXISTS generated_ads (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  user_id                   UUID NOT NULL REFERENCES users(_id) ON DELETE CASCADE,
  brand_id                  UUID NOT NULL REFERENCES brands(_id) ON DELETE CASCADE,
  product_id                UUID NOT NULL REFERENCES products(_id) ON DELETE CASCADE,
  concept_id                UUID REFERENCES ad_concepts(_id) ON DELETE SET NULL,
  folder_id                 UUID REFERENCES ad_folders(_id) ON DELETE SET NULL,
  
  -- User Input
  important_notes           TEXT,
  
  -- AI Response Data
  claude_response_json      JSONB NOT NULL,
  gemini_prompt             TEXT NOT NULL,
  
  -- Generated Images (all 3 ratios)
  image_url_1x1             VARCHAR(500),
  image_url_9x16            VARCHAR(500),
  image_url_16x9            VARCHAR(500),
  
  -- Ad Copy (structured)
  ad_copy_json              JSONB NOT NULL,
  -- Format: { headline, subheadline, body_text, callout_texts[], cta_text }
  
  -- Status
  generation_status         generation_status NOT NULL DEFAULT 'pending',
  
  -- Organization
  ad_name                   VARCHAR(255),
  is_saved                  BOOLEAN NOT NULL DEFAULT FALSE,
  is_favorite               BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Snapshot of brand/product data at generation time
  brand_snapshot            JSONB,
  product_snapshot          JSONB,
  
  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_generated_ads_user_id ON generated_ads (user_id);
CREATE INDEX idx_generated_ads_brand_id ON generated_ads (brand_id);
CREATE INDEX idx_generated_ads_product_id ON generated_ads (product_id);
CREATE INDEX idx_generated_ads_concept_id ON generated_ads (concept_id);
CREATE INDEX idx_generated_ads_folder_id ON generated_ads (folder_id);
CREATE INDEX idx_generated_ads_saved ON generated_ads (user_id, is_saved) WHERE is_saved = TRUE;
CREATE INDEX idx_generated_ads_favorite ON generated_ads (user_id, is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX idx_generated_ads_status ON generated_ads (generation_status);

ALTER TABLE generated_ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY generated_ads_select_own ON generated_ads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY generated_ads_insert_own ON generated_ads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY generated_ads_update_own ON generated_ads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY generated_ads_delete_own ON generated_ads FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 3.9 CANVA ORDERS TABLE
-- Canva template purchases
-- ============================================
CREATE TABLE IF NOT EXISTS canva_orders (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  user_id                   UUID NOT NULL REFERENCES users(_id) ON DELETE CASCADE,
  generated_ad_id           UUID NOT NULL REFERENCES generated_ads(_id) ON DELETE CASCADE,
  
  -- Payment
  stripe_payment_id         VARCHAR(255) NOT NULL,
  price_paid_cents          INTEGER NOT NULL,
  
  -- Status
  status                    canva_order_status NOT NULL DEFAULT 'pending',
  
  -- Fulfillment
  canva_link                VARCHAR(500),
  fulfilled_at              TIMESTAMPTZ,
  fulfilled_by              UUID REFERENCES users(_id),
  
  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_canva_orders_user_id ON canva_orders (user_id);
CREATE INDEX idx_canva_orders_status ON canva_orders (status);
CREATE INDEX idx_canva_orders_generated_ad ON canva_orders (generated_ad_id);

ALTER TABLE canva_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY canva_orders_select_own ON canva_orders FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- 3.10 GENERATION LOGS TABLE
-- API call tracking for cost analysis
-- ============================================
CREATE TABLE IF NOT EXISTS generation_logs (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  user_id                   UUID NOT NULL REFERENCES users(_id) ON DELETE CASCADE,
  generated_ad_id           UUID REFERENCES generated_ads(_id) ON DELETE SET NULL,
  
  -- API Details
  api_type                  api_type NOT NULL,
  request_payload           JSONB,
  response_status           INTEGER,
  
  -- Metrics
  latency_ms                INTEGER,
  token_count               INTEGER,
  estimated_cost_cents      INTEGER,
  
  -- Error Tracking
  error_message             TEXT,
  
  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_generation_logs_user_id ON generation_logs (user_id);
CREATE INDEX idx_generation_logs_api_type ON generation_logs (api_type);
CREATE INDEX idx_generation_logs_created_at ON generation_logs (created_at);

-- ============================================
-- 3.11 ADMIN USERS TABLE
-- Admin accounts
-- ============================================
CREATE TABLE IF NOT EXISTS admin_users (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Account
  email                     VARCHAR(255) NOT NULL UNIQUE,
  name                      VARCHAR(255) NOT NULL,
  password_hash             VARCHAR(255) NOT NULL,
  
  -- Role
  role                      admin_role NOT NULL DEFAULT 'support',
  
  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_users_email ON admin_users (email);

-- ============================================
-- 3.12 PROMPT TEMPLATES TABLE
-- AI prompt configuration
-- ============================================
CREATE TABLE IF NOT EXISTS prompt_templates (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Template Info
  name                      VARCHAR(255) NOT NULL,
  template_type             prompt_template_type NOT NULL,
  content                   TEXT NOT NULL,
  
  -- Versioning
  version                   INTEGER NOT NULL DEFAULT 1,
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- A/B Testing
  ab_test_group             VARCHAR(50),
  conversion_rate           DECIMAL(5,4),
  
  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prompt_templates_type ON prompt_templates (template_type);
CREATE INDEX idx_prompt_templates_active ON prompt_templates (is_active);

CREATE TRIGGER trigger_prompt_templates_updated_at
  BEFORE UPDATE ON prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3.13 CREDIT TRANSACTIONS TABLE
-- Track credit usage and purchases
-- ============================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User
  user_id                   UUID NOT NULL REFERENCES users(_id) ON DELETE CASCADE,
  
  -- Transaction Details
  credits_amount            INTEGER NOT NULL,
  transaction_type          VARCHAR(50) NOT NULL,
  -- Types: generation, fix_errors, regenerate_single, addon_purchase, monthly_reset
  
  -- Reference
  reference_id              UUID,
  reference_type            VARCHAR(50),
  -- e.g., generated_ad_id, stripe_payment_id
  
  -- Balance
  balance_before            INTEGER NOT NULL,
  balance_after             INTEGER NOT NULL,
  
  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_transactions_user_id ON credit_transactions (user_id);
CREATE INDEX idx_credit_transactions_type ON credit_transactions (transaction_type);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions (created_at);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_transactions_select_own ON credit_transactions FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- 3.14 SYSTEM CONFIG TABLE
-- Admin-configurable settings
-- ============================================
CREATE TABLE IF NOT EXISTS system_config (
  _id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Config
  key                       VARCHAR(100) NOT NULL UNIQUE,
  value                     JSONB NOT NULL,
  description               TEXT,
  
  -- Timestamps
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STEP 4: INSERT DEFAULT DATA
-- ============================================

-- Default subscription tiers
INSERT INTO subscription_tiers (tier_key, display_name, monthly_price_cents, annual_price_cents, credits_per_month, max_brands, max_products_per_brand, display_order, features) VALUES
  ('free', 'Free', 0, 0, 25, 1, 3, 0, '["25 credits/month", "1 brand", "3 products per brand", "All ad concepts", "Multi-ratio export"]'::jsonb),
  ('starter', 'Starter', 3900, 39000, 250, 3, 10, 1, '["250 credits/month", "3 brands", "10 products per brand", "Standard support", "All Free features"]'::jsonb),
  ('pro', 'Pro', 9900, 99000, 750, 10, 25, 2, '["750 credits/month", "10 brands", "25 products per brand", "Priority support", "All Starter features"]'::jsonb),
  ('growth', 'Growth', 19900, 199000, 2000, 999, 100, 3, '["2,000 credits/month", "Unlimited brands", "100 products per brand", "Dedicated support", "All Pro features"]'::jsonb)
ON CONFLICT (tier_key) DO NOTHING;

-- Default system config
INSERT INTO system_config (key, value, description) VALUES
  ('credits_per_generation', '5', 'Credits consumed per ad generation (produces 6 variations)'),
  ('credits_per_fix_errors', '2', 'Credits consumed per fix errors action'),
  ('credits_per_regenerate_single', '2', 'Credits consumed per single slot regeneration'),
  ('addon_credits_amount', '100', 'Number of credits in add-on package'),
  ('addon_credits_price_cents', '1500', 'Price of credit add-on in cents'),
  ('canva_template_price_cents', '2500', 'Default Canva template price in cents'),
  ('canva_discount_pro', '0.10', 'Canva template discount for Pro tier'),
  ('canva_discount_agency', '0.20', 'Canva template discount for Agency tier'),
  ('payment_grace_days', '3', 'Days grace period for failed payments')
ON CONFLICT (key) DO NOTHING;

-- Default prompt template
INSERT INTO prompt_templates (name, template_type, content, is_active) VALUES
  ('default_system_prompt', 'system', 
   'You are an expert Facebook ad creative director with 15+ years of experience in direct response advertising. You create scroll-stopping static ad creatives that drive conversions. Your ads are on-brand, visually striking, and optimized for the Meta platform.

When generating ads:
1. Analyze the brand voice and visual identity
2. Understand the product''s unique selling propositions
3. Study the reference concept and adapt it to the brand
4. Create compelling headlines that stop the scroll
5. Write persuasive body copy that drives action
6. Generate detailed image prompts for Gemini that include exact text, positioning, and styling

Output must be valid JSON with: headline, subheadline, body_text, callout_texts[], cta_text, gemini_image_prompt', 
   TRUE)
ON CONFLICT DO NOTHING;
