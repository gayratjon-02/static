// =============================================
// TYPES — Ad Concept (database-driven categories)
// =============================================

/** Concept category from concept_categories table */
export interface ConceptCategoryItem {
    _id: string;
    name: string;
    slug: string;
    description?: string;
    display_order: number;
    created_at: string;
    updated_at: string;
}

/** Ad concept from ad_concepts table */
export interface AdConcept {
    _id: string;

    // Content
    category_id: string;
    name: string;
    image_url: string;
    tags: string[];
    description: string;

    // Joined category info (from API response)
    category_name?: string;
    category_slug?: string;

    // Legacy (backward compat during migration)
    category?: string;

    // Meta
    source_url: string;
    usage_count: number;
    is_active: boolean;
    display_order: number;

    // Timestamps
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}

/** Public config returned by GET /concept/config */
export interface ConceptConfig {
    popular_threshold: number;
    recommended_limit: number;
    max_image_size: number;
}
