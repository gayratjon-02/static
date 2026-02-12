-- ============================================
-- PROMPT TEMPLATES TABLE
-- PostgreSQL (Supabase)
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

-- Indexes
CREATE INDEX idx_prompt_templates_type ON prompt_templates (template_type);
CREATE INDEX idx_prompt_templates_active ON prompt_templates (is_active);

-- Auto-update updated_at trigger
CREATE TRIGGER trigger_prompt_templates_updated_at
  BEFORE UPDATE ON prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Default prompt
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
