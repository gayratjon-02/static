import { ConceptCategory } from '../../enums/concept/concept.enum';

/** ad_concepts jadvalidan kelgan to'liq concept */
export interface AdConcept {
	_id: string;

	// Content
	category: ConceptCategory;
	image_url: string;
	tags: string[];
	description: string;

	// Meta
	source_url: string;
	usage_count: number;
	is_active: boolean;
	display_order: number;

	// Timestamps
	created_at: Date;
	updated_at: Date;
}
