-- ============================================
-- GENERATION LOGS TABLE
-- PostgreSQL (Supabase)
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

-- Indexes
CREATE INDEX idx_generation_logs_user_id ON generation_logs (user_id);
CREATE INDEX idx_generation_logs_api_type ON generation_logs (api_type);
CREATE INDEX idx_generation_logs_created_at ON generation_logs (created_at);
