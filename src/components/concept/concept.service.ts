import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ConceptConfigService } from './concept-config.service';
import { CreateConceptDto } from '../../libs/dto/concept/create-concept.dto';
import { UpdateConceptDto } from '../../libs/dto/concept/update-concept.dto';
import { CreateCategoryDto } from '../../libs/dto/concept/create-category.dto';
import { ReorderConceptsDto } from '../../libs/dto/concept/reorder-concepts.dto';
import { Message } from '../../libs/enums/common.enum';
import { T } from '../../libs/types/common';
import { AdConcept, ConceptCategoryItem } from '../../libs/types/concept/concept.type';

// Fallback categories for when DB migration hasn't run.
// These UUIDs allow the frontend to select categories even if the table is missing.
// Fallback categories for when DB migration hasn't run.
// These UUIDs allow the frontend to select categories even if the table is missing.
// Matches the "PDF Spec" list provided by user + migration 002 list.
const FALLBACK_CATEGORIES: ConceptCategoryItem[] = [
	{ _id: '11111111-1111-1111-1111-111111111111', slug: 'social_proof', name: 'Social Proof', display_order: 1, created_at: new Date(), updated_at: new Date(), description: 'Review count, star ratings, badges' },
	{ _id: '22222222-2222-2222-2222-222222222222', slug: 'before_after', name: 'Before & After', display_order: 2, created_at: new Date(), updated_at: new Date(), description: 'Split-screen transformation comparison' },
	{ _id: '33333333-3333-3333-3333-333333333333', slug: 'feature_callout', name: 'Feature Callout', display_order: 3, created_at: new Date(), updated_at: new Date(), description: 'Callout arrows/lines pointing to product features' },
	{ _id: '44444444-4444-4444-4444-444444444444', slug: 'listicle', name: 'Listicle', display_order: 4, created_at: new Date(), updated_at: new Date(), description: 'Numbered list of benefits or features' },
	{ _id: '55555555-5555-5555-5555-555555555555', slug: 'comparison', name: 'Comparison', display_order: 5, created_at: new Date(), updated_at: new Date(), description: 'Side-by-side brand comparison' },
	{ _id: '66666666-6666-6666-6666-666666666666', slug: 'ugc_style', name: 'UGC Style', display_order: 6, created_at: new Date(), updated_at: new Date(), description: 'Casual, native-looking creative' },
	{ _id: '77777777-7777-7777-7777-777777777777', slug: 'editorial', name: 'Editorial', display_order: 7, created_at: new Date(), updated_at: new Date(), description: 'Educational content as an ad' },
	{ _id: '88888888-8888-8888-8888-888888888888', slug: 'bold_offer', name: 'Bold Offer', display_order: 8, created_at: new Date(), updated_at: new Date(), description: 'Discount, sale, limited-time offer' },
	{ _id: '99999999-9999-9999-9999-999999999999', slug: 'minimalist', name: 'Minimalist', display_order: 9, created_at: new Date(), updated_at: new Date(), description: 'Clean, minimal design with focus on product' },
	{ _id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', slug: 'lifestyle', name: 'Lifestyle', display_order: 10, created_at: new Date(), updated_at: new Date(), description: 'Product shown in context' },
	{ _id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', slug: 'feature_pointers', name: 'Feature Pointers', display_order: 11, created_at: new Date(), updated_at: new Date(), description: 'Callout arrows/lines pointing to product features' },
	{ _id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', slug: 'testimonial', name: 'Testimonial', display_order: 12, created_at: new Date(), updated_at: new Date(), description: 'Customer quote overlaid on product image' },
	{ _id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', slug: 'us_vs_them', name: 'Us vs. Them', display_order: 13, created_at: new Date(), updated_at: new Date(), description: 'Side-by-side brand comparison' },
	{ _id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', slug: 'stat_data', name: 'Stat / Data', display_order: 14, created_at: new Date(), updated_at: new Date(), description: 'Bold statistic or data point' },
	{ _id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', slug: 'unboxing_flat_lay', name: 'Unboxing / Flat Lay', display_order: 15, created_at: new Date(), updated_at: new Date(), description: 'Product packaging display' },
	{ _id: '10101010-1010-1010-1010-101010101010', slug: 'ingredient_spotlight', name: 'Ingredient Spotlight', display_order: 16, created_at: new Date(), updated_at: new Date(), description: 'Close-up on key ingredients' },
	{ _id: '20202020-2020-2020-2020-202020202020', slug: 'offer_promo', name: 'Offer / Promo', display_order: 17, created_at: new Date(), updated_at: new Date(), description: 'Discount, sale, limited-time offer' },
	{ _id: '30303030-3030-3030-3030-303030303030', slug: 'problem_solution', name: 'Problem → Solution', display_order: 18, created_at: new Date(), updated_at: new Date(), description: 'Pain point then presents product' },
	{ _id: '40404040-4040-4040-4040-404040404040', slug: 'founder_brand_story', name: 'Founder / Brand Story', display_order: 19, created_at: new Date(), updated_at: new Date(), description: 'Personal message from founder' },
	{ _id: '50505050-5050-5050-5050-505050505050', slug: 'infographic', name: 'Infographic', display_order: 20, created_at: new Date(), updated_at: new Date(), description: 'Educational content as an ad' },
	{ _id: '60606060-6060-6060-6060-606060606060', slug: 'meme_ugc_style', name: 'Meme / UGC Style', display_order: 21, created_at: new Date(), updated_at: new Date(), description: 'Casual, native-looking creative' },
	{ _id: '70707070-7070-7070-7070-707070707070', slug: 'comparison_chart', name: 'Comparison Chart', display_order: 22, created_at: new Date(), updated_at: new Date(), description: 'Feature comparison table/grid' },
];

@Injectable()
export class ConceptService {
	constructor(
		private databaseService: DatabaseService,
		private conceptConfig: ConceptConfigService,
	) { }

	// Helper to map old "category" slug column back to "category_id" UUID
	private normalizeConcept(concept: any): AdConcept {
		if (!concept) return concept;
		// If concept has legacy "category" string but no category_id, map it shim ID
		if (concept.category && !concept.category_id) {
			const shim = FALLBACK_CATEGORIES.find(c => c.slug === concept.category);
			if (shim) {
				concept.category_id = shim._id;
				// Frontend uses category_name for display
				// If join failed (missing table), we don't have category_name from join
				if (!concept.category_name) concept.category_name = shim.name;
			}
		}
		return concept as AdConcept;
	}

	// =============================================
	// CATEGORIES
	// =============================================

	/** Get all concept categories ordered by display_order */
	public async getCategories(): Promise<{ list: ConceptCategoryItem[] }> {
		try {
			const { data, error } = await this.databaseService.client
				.from('concept_categories')
				.select('*')
				.order('display_order', { ascending: true });

			if (error) {
				console.log('getCategories failed (likely missing table), using fallback shim.');
				return { list: FALLBACK_CATEGORIES };
			}

			return { list: (data as ConceptCategoryItem[]) || [] };
		} catch {
			return { list: FALLBACK_CATEGORIES };
		}
	}

	/** Create a new concept category */
	public async createCategory(input: CreateCategoryDto): Promise<ConceptCategoryItem> {
		const slug = input.slug || input.name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_|_$/g, '');

		const { data: existing } = await this.databaseService.client
			.from('concept_categories')
			.select('_id')
			.eq('slug', slug)
			.single();

		if (existing) {
			throw new BadRequestException('Category with this slug already exists');
		}

		const displayOrder = input.display_order ?? await this.getNextCategoryOrder();

		const { data, error } = await this.databaseService.client
			.from('concept_categories')
			.insert({
				name: input.name,
				slug,
				description: input.description || null,
				display_order: displayOrder,
			})
			.select('*')
			.single();

		if (error || !data) {
			console.log('Supabase createCategory error:', error);
			throw new InternalServerErrorException(Message.CREATE_FAILED + ' (Table might be missing)');
		}

		return data as ConceptCategoryItem;
	}

	private async getNextCategoryOrder(): Promise<number> {
		try {
			const { data } = await this.databaseService.client
				.from('concept_categories')
				.select('display_order')
				.order('display_order', { ascending: false })
				.limit(1);

			return (data?.[0]?.display_order ?? 0) + 1;
		} catch {
			return 1;
		}
	}

	// =============================================
	// CONCEPTS — CRUD
	// =============================================

	/** Get concepts with filtering, search, tags, and pagination */
	public async getConcepts(
		categoryId?: string,
		search?: string,
		tags?: string,
		page: number = 1,
		limit: number = 20,
		includeInactive: boolean = false,
	) {
		const offset = (page - 1) * limit;

		let countQuery = this.databaseService.client
			.from('ad_concepts')
			.select('*', { count: 'exact', head: true });

		let dataQuery = this.databaseService.client
			.from('ad_concepts')
			.select('*');

		if (!includeInactive) {
			countQuery = countQuery.eq('is_active', true);
			dataQuery = dataQuery.eq('is_active', true);
		}


		if (categoryId) {
			// Check if this is a fallback shim ID, slug, or name
			const shim = FALLBACK_CATEGORIES.find(c => c._id === categoryId || c.slug === categoryId || c.name === categoryId);
			if (shim) {
				// Query by legacy 'category' column
				countQuery = countQuery.eq('category', shim.slug);
				dataQuery = dataQuery.eq('category', shim.slug);
			} else {
				// Query by real relationship
				countQuery = countQuery.eq('category_id', categoryId);
				dataQuery = dataQuery.eq('category_id', categoryId);
			}
		}

		if (search) {
			const searchFilter = `name.ilike.%${search}%,description.ilike.%${search}%`;
			countQuery = countQuery.or(searchFilter);
			dataQuery = dataQuery.or(searchFilter);
		}

		if (tags) {
			const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
			if (tagList.length > 0) {
				countQuery = countQuery.overlaps('tags', tagList);
				dataQuery = dataQuery.overlaps('tags', tagList);
			}
		}

		const { count, error: countError } = await countQuery;

		if (countError) {
			console.log('Supabase getConcepts count error:', countError);
			throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		}

		const { data, error } = await dataQuery
			.order('display_order', { ascending: true })
			.range(offset, offset + limit - 1);

		if (error) {
			console.log('Supabase getConcepts data error:', error);
			throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		}

		// Normalize data (add shim IDs if needed)
		const list = (data || []).map(c => this.normalizeConcept(c));

		return { list, total: count || 0 };
	}

	/** Create a new concept */
	public async createConcept(input: CreateConceptDto): Promise<AdConcept> {
		const displayOrder = input.display_order ?? await this.getNextConceptOrder(input.category_id);

		// Prepare insert payload
		const insertData: any = {
			name: input.name,
			image_url: input.image_url,
			tags: input.tags,
			description: input.description || null,
			source_url: input.source_url || '',
			is_active: input.is_active ?? true,
			display_order: displayOrder,
			usage_count: 0,
		};


		// Use category_id directly (concept_categories table exists after migration 002)
		insertData.category_id = input.category_id;

		const { data, error } = await this.databaseService.client
			.from('ad_concepts')
			.insert(insertData)
			.select('*')
			.single();

		if (error || !data) {
			console.log('Supabase createConcept error:', error);
			throw new InternalServerErrorException(Message.CREATE_FAILED);
		}

		return this.normalizeConcept(data);
	}

	private async getNextConceptOrder(categoryId?: string): Promise<number> {
		let query = this.databaseService.client
			.from('ad_concepts')
			.select('display_order')
			.order('display_order', { ascending: false })
			.limit(1);

		if (categoryId) {
			const shim = FALLBACK_CATEGORIES.find(c => c._id === categoryId);
			if (shim) {
				query = query.eq('category', shim.slug);
			} else {
				query = query.eq('category_id', categoryId);
			}
		}

		const { data } = await query;
		return (data?.[0]?.display_order ?? -1) + 1;
	}

	/** Update an existing concept */
	public async updateConcept(id: string, input: UpdateConceptDto): Promise<AdConcept> {
		const { data: existing, error: findError } = await this.databaseService.client
			.from('ad_concepts')
			.select('_id')
			.eq('_id', id)
			.single();

		if (findError || !existing) {
			throw new BadRequestException(Message.NO_DATA_FOUND);
		}

		const updateData: T = {};
		const fields = ['name', 'image_url', 'tags', 'description', 'source_url', 'is_active', 'display_order'];

		for (const field of fields) {
			if (input[field] !== undefined) {
				updateData[field] = input[field];
			}
		}


		if (input.category_id !== undefined) {
			updateData.category_id = input.category_id;
		}

		if (Object.keys(updateData).length === 0) {
			throw new BadRequestException(Message.BAD_REQUEST);
		}

		const { data, error } = await this.databaseService.client
			.from('ad_concepts')
			.update(updateData)
			.eq('_id', id)
			.select('*')
			.single();

		if (error || !data) {
			console.log('Supabase updateConcept error:', error);
			throw new InternalServerErrorException(Message.UPDATE_FAILED);
		}

		return this.normalizeConcept(data);
	}

	/** Delete a concept (hard delete — soft delete available after migration 003) */
	public async deleteConcept(id: string): Promise<{ message: string }> {
		const { data: existing, error: findError } = await this.databaseService.client
			.from('ad_concepts')
			.select('_id')
			.eq('_id', id)
			.single();

		if (findError || !existing) {
			throw new BadRequestException(Message.NO_DATA_FOUND);
		}

		const { error } = await this.databaseService.client
			.from('ad_concepts')
			.delete()
			.eq('_id', id);

		if (error) {
			throw new InternalServerErrorException(Message.REMOVE_FAILED);
		}

		return { message: 'Concept deleted successfully' };
	}

	// =============================================
	// CONCEPTS — REORDER (Category-Scoped)
	// =============================================

	/** Batch reorder concepts within a category */
	public async reorderConcepts(input: ReorderConceptsDto): Promise<{ message: string }> {
		const { items } = input;

		if (!items || items.length === 0) {
			throw new BadRequestException('No items to reorder');
		}

		// Sequential updates (RPC migration is missing)
		for (const item of items) {
			const { error } = await this.databaseService.client
				.from('ad_concepts')
				.update({ display_order: item.display_order })
				.eq('_id', item.id);

			if (error) {
				console.log(`Supabase reorder error for ${item.id}:`, error);
				throw new InternalServerErrorException('Failed to reorder concepts');
			}
		}

		return { message: 'Concepts reordered successfully' };
	}

	// =============================================
	// USAGE TRACKING
	// =============================================

	/** Increment usage_count */
	public async incrementUsage(id: string): Promise<{ usage_count: number }> {
		const { data: concept, error: findError } = await this.databaseService.client
			.from('ad_concepts')
			.select('_id, usage_count')
			.eq('_id', id)
			.single();

		if (findError || !concept) {
			throw new BadRequestException(Message.NO_DATA_FOUND);
		}

		const newCount = (concept.usage_count || 0) + 1;

		const { data, error } = await this.databaseService.client
			.from('ad_concepts')
			.update({ usage_count: newCount })
			.eq('_id', id)
			.select('usage_count')
			.single();

		if (error || !data) {
			throw new InternalServerErrorException(Message.UPDATE_FAILED);
		}

		return { usage_count: data.usage_count };
	}

	// =============================================
	// RECOMMENDED
	// =============================================

	/** Get top concepts by usage_count */
	public async getRecommendedConcepts(): Promise<{ list: AdConcept[] }> {
		const { data, error } = await this.databaseService.client
			.from('ad_concepts')
			.select('*')
			.eq('is_active', true)
			.order('usage_count', { ascending: false })
			.limit(this.conceptConfig.recommendedLimit);

		if (error) {
			console.log('Supabase getRecommended error:', error);
			return { list: [] };
		}

		// Normalize data
		return { list: (data || []).map(c => this.normalizeConcept(c as AdConcept)) };
	}
}
