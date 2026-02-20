-- ============================================
-- AD FOLDERS TABLE
-- PostgreSQL (Supabase)
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

-- Indexes
CREATE INDEX idx_ad_folders_user_id ON ad_folders (user_id);
CREATE INDEX idx_ad_folders_brand_id ON ad_folders (brand_id);
CREATE INDEX idx_ad_folders_parent ON ad_folders (parent_folder_id);

-- Row Level Security
ALTER TABLE ad_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY ad_folders_select_own ON ad_folders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ad_folders_insert_own ON ad_folders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ad_folders_update_own ON ad_folders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY ad_folders_delete_own ON ad_folders FOR DELETE USING (auth.uid() = user_id);
