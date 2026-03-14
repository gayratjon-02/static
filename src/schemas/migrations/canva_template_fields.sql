-- Add canva_template_id to ad_concepts
ALTER TABLE ad_concepts ADD COLUMN IF NOT EXISTS canva_template_id VARCHAR(255);

-- Add Canva fields to generated_ads
ALTER TABLE generated_ads ADD COLUMN IF NOT EXISTS canva_design_id VARCHAR(255);
ALTER TABLE generated_ads ADD COLUMN IF NOT EXISTS canva_edit_url VARCHAR(500);
