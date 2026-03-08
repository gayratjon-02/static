-- Create DA Presets Table
CREATE TABLE IF NOT EXISTS da_presets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100), -- Unique identifier for system presets, e.g., 'DA-1'
    description TEXT,
    is_default BOOLEAN DEFAULT false, -- True if this is a system-wide preset
    image_url TEXT NOT NULL,
    background_type VARCHAR(100),
    floor_type VARCHAR(100),
    mood VARCHAR(100),
    quality VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_da_presets_member_id ON da_presets(member_id);
CREATE INDEX IF NOT EXISTS idx_da_presets_is_default ON da_presets(is_default);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_da_presets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_da_presets_updated_at
BEFORE UPDATE ON da_presets
FOR EACH ROW
EXECUTE FUNCTION update_da_presets_updated_at();
