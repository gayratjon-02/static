// Category is now database-driven via concept_categories table

/** ad_concepts jadvalidan kelgan to'liq concept */
export interface AdConcept {
	_id: string;

	// Content
	category_id: string;
	name: string;
	image_url: string;
	tags: string[];
	description: string;

	// Meta
	source_url: string;
	usage_count: number;
	is_active: boolean;
	display_order: number;

	// Joined category (optional, added when queried with join)
	category_name?: string;
	category_slug?: string;

	// Legacy (kept for backward compatibility during migration)
	category?: string;

	// Timestamps
	created_at: Date;
	updated_at: Date;
	deleted_at?: Date | null;
}

/** concept_categories jadvalidan kelgan category */
export interface ConceptCategoryItem {
	_id: string;
	name: string;
	slug: string;
	description?: string;
	display_order: number;
	created_at: Date;
	updated_at: Date;
}
