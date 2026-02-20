-- ============================================
-- MIGRATION 003: Production-Ready Concept Library
-- - Soft delete (deleted_at)
-- - Proper indexes
-- - Unique constraint (category_id, display_order)
-- - Atomic increment RPC
-- - Transactional reorder RPC
-- ============================================

-- ──────────────────────────────────────────────
-- 1. Soft Delete Column
-- ──────────────────────────────────────────────
ALTER TABLE ad_concepts
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ──────────────────────────────────────────────
-- 2. Indexes
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ad_concepts_category_id
  ON ad_concepts (category_id);

CREATE INDEX IF NOT EXISTS idx_ad_concepts_is_active
  ON ad_concepts (is_active);

CREATE INDEX IF NOT EXISTS idx_ad_concepts_usage_count
  ON ad_concepts (usage_count DESC);

CREATE INDEX IF NOT EXISTS idx_ad_concepts_display_order
  ON ad_concepts (display_order);

CREATE INDEX IF NOT EXISTS idx_ad_concepts_deleted_at
  ON ad_concepts (deleted_at)
  WHERE deleted_at IS NULL;

-- Unique display_order per category (only for non-deleted)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_concepts_category_order_unique
  ON ad_concepts (category_id, display_order)
  WHERE deleted_at IS NULL;

-- ──────────────────────────────────────────────
-- 3. RPC: Atomic Usage Count Increment
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_concept_usage(concept_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE ad_concepts
  SET usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE _id = concept_id
    AND deleted_at IS NULL
    AND is_active = TRUE
  RETURNING usage_count INTO new_count;

  IF new_count IS NULL THEN
    RAISE EXCEPTION 'Concept not found or inactive: %', concept_id;
  END IF;

  RETURN new_count;
END;
$$;

-- ──────────────────────────────────────────────
-- 4. RPC: Transactional Category-Scoped Reorder
-- ──────────────────────────────────────────────
-- Accepts: target_category_id UUID, items JSONB (array of {id, display_order})
-- Validates all items belong to the target category, then updates in transaction.
CREATE OR REPLACE FUNCTION reorder_concepts_in_category(
  target_category_id UUID,
  items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item JSONB;
  item_id UUID;
  item_order INTEGER;
  actual_category UUID;
BEGIN
  -- Validate all items belong to the target category
  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    item_id := (item->>'id')::UUID;

    SELECT category_id INTO actual_category
    FROM ad_concepts
    WHERE _id = item_id AND deleted_at IS NULL;

    IF actual_category IS NULL THEN
      RAISE EXCEPTION 'Concept % not found or deleted', item_id;
    END IF;

    IF actual_category != target_category_id THEN
      RAISE EXCEPTION 'Concept % does not belong to category %', item_id, target_category_id;
    END IF;
  END LOOP;

  -- Temporarily set all to negative to avoid unique constraint conflicts
  UPDATE ad_concepts
  SET display_order = -1 * display_order - 1
  WHERE category_id = target_category_id
    AND deleted_at IS NULL;

  -- Apply new order
  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    item_id := (item->>'id')::UUID;
    item_order := (item->>'display_order')::INTEGER;

    UPDATE ad_concepts
    SET display_order = item_order,
        updated_at = NOW()
    WHERE _id = item_id;
  END LOOP;
END;
$$;
