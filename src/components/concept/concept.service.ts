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

@Injectable()
export class ConceptService {
	constructor(
		private databaseService: DatabaseService,
		private conceptConfig: ConceptConfigService,
	) { }

	// =============================================
	// CATEGORIES
	// =============================================

	/** Get all concept categories ordered by display_order */
	public async getCategories(): Promise<{ list: ConceptCategoryItem[] }> {
		const { data, error } = await this.databaseService.client
			.from('concept_categories')
			.select('*')
			.order('display_order', { ascending: true });

		if (error) {
			console.log('Supabase getCategories error:', error);
			throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		}

		return { list: (data as ConceptCategoryItem[]) || [] };
	}

	/** Create a new concept category */
	public async createCategory(input: CreateCategoryDto): Promise<ConceptCategoryItem> {
		// Auto-generate slug if not provided
		const slug = input.slug || input.name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_|_$/g, '');

		// Check slug uniqueness
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
			throw new InternalServerErrorException(Message.CREATE_FAILED);
		}

		return data as ConceptCategoryItem;
	}

	/** Get next available display_order for categories */
	private async getNextCategoryOrder(): Promise<number> {
		const { data } = await this.databaseService.client
			.from('concept_categories')
			.select('display_order')
			.order('display_order', { ascending: false })
			.limit(1);

		return (data?.[0]?.display_order ?? 0) + 1;
	}

	// =============================================
	// CONCEPTS — CRUD
	// =============================================

	/** Get concepts with filtering, search, tags, and pagination (excludes soft-deleted) */
	public async getConcepts(
		categoryId?: string,
		search?: string,
		tags?: string,
		page: number = 1,
		limit: number = 20,
		includeInactive: boolean = false,
	) {
		const offset = (page - 1) * limit;

		// Base queries — always exclude soft-deleted
		let countQuery = this.databaseService.client
			.from('ad_concepts')
			.select('*', { count: 'exact', head: true })
			.is('deleted_at', null);

		let dataQuery = this.databaseService.client
			.from('ad_concepts')
			.select('*, concept_categories(name, slug)')
			.is('deleted_at', null);

		// Only active concepts for non-admin queries
		if (!includeInactive) {
			countQuery = countQuery.eq('is_active', true);
			dataQuery = dataQuery.eq('is_active', true);
		}

		// Filter: category_id
		if (categoryId) {
			countQuery = countQuery.eq('category_id', categoryId);
			dataQuery = dataQuery.eq('category_id', categoryId);
		}

		// Filter: search (name or description)
		if (search) {
			const searchFilter = `name.ilike.%${search}%,description.ilike.%${search}%`;
			countQuery = countQuery.or(searchFilter);
			dataQuery = dataQuery.or(searchFilter);
		}

		// Filter: tags (array overlap)
		if (tags) {
			const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
			if (tagList.length > 0) {
				countQuery = countQuery.overlaps('tags', tagList);
				dataQuery = dataQuery.overlaps('tags', tagList);
			}
		}

		// Total count
		const { count, error: countError } = await countQuery;

		if (countError) {
			console.log('Supabase getConcepts count error:', countError);
			throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		}

		// Paginated list
		const { data, error } = await dataQuery
			.order('display_order', { ascending: true })
			.range(offset, offset + limit - 1);

		if (error) {
			console.log('Supabase getConcepts data error:', error);
			throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		}

		// Flatten joined category data
		const list = (data || []).map((item: T) => {
			const concept: T = { ...item };
			if (item.concept_categories) {
				concept.category_name = item.concept_categories.name;
				concept.category_slug = item.concept_categories.slug;
			}
			delete concept.concept_categories;
			return concept;
		});

		return { list: list as AdConcept[], total: count || 0 };
	}

	/** Create a new concept (auto-assigns display_order within category) */
	public async createConcept(input: CreateConceptDto): Promise<AdConcept> {
		// Verify category exists
		const { data: cat, error: catError } = await this.databaseService.client
			.from('concept_categories')
			.select('_id')
			.eq('_id', input.category_id)
			.single();

		if (catError || !cat) {
			throw new BadRequestException('Invalid category_id: category not found');
		}

		// Auto-assign display_order = max in this category + 1
		const displayOrder = input.display_order ?? await this.getNextConceptOrder(input.category_id);

		const { data, error } = await this.databaseService.client
			.from('ad_concepts')
			.insert({
				category_id: input.category_id,
				name: input.name,
				image_url: input.image_url,
				tags: input.tags,
				description: input.description || null,
				source_url: input.source_url || '',
				is_active: input.is_active ?? true,
				display_order: displayOrder,
				usage_count: 0,
			})
			.select('*')
			.single();

		if (error || !data) {
			console.log('Supabase createConcept error:', error);
			throw new InternalServerErrorException(Message.CREATE_FAILED);
		}

		return data as AdConcept;
	}

	/** Get next display_order within a specific category */
	private async getNextConceptOrder(categoryId: string): Promise<number> {
		const { data } = await this.databaseService.client
			.from('ad_concepts')
			.select('display_order')
			.eq('category_id', categoryId)
			.is('deleted_at', null)
			.order('display_order', { ascending: false })
			.limit(1);

		return (data?.[0]?.display_order ?? -1) + 1;
	}

	/** Update an existing concept */
	public async updateConcept(id: string, input: UpdateConceptDto): Promise<AdConcept> {
		// Check concept exists and is not deleted
		const { data: existing, error: findError } = await this.databaseService.client
			.from('ad_concepts')
			.select('_id, category_id')
			.eq('_id', id)
			.is('deleted_at', null)
			.single();

		if (findError || !existing) {
			throw new BadRequestException(Message.NO_DATA_FOUND);
		}

		// If category_id is being updated, verify it exists
		if (input.category_id) {
			const { data: cat, error: catError } = await this.databaseService.client
				.from('concept_categories')
				.select('_id')
				.eq('_id', input.category_id)
				.single();

			if (catError || !cat) {
				throw new BadRequestException('Invalid category_id: category not found');
			}
		}

		const updateData: T = {};
		const fields = ['category_id', 'name', 'image_url', 'tags', 'description', 'source_url', 'is_active', 'display_order'];

		for (const field of fields) {
			if (input[field] !== undefined) {
				updateData[field] = input[field];
			}
		}

		if (Object.keys(updateData).length === 0) {
			throw new BadRequestException(Message.BAD_REQUEST);
		}

		const { data, error } = await this.databaseService.client
			.from('ad_concepts')
			.update(updateData)
			.eq('_id', id)
			.is('deleted_at', null)
			.select('*')
			.single();

		if (error || !data) {
			console.log('Supabase updateConcept error:', error);
			throw new InternalServerErrorException(Message.UPDATE_FAILED);
		}

		return data as AdConcept;
	}

	/** Soft-delete a concept (sets deleted_at, does NOT permanently remove) */
	public async deleteConcept(id: string): Promise<{ message: string }> {
		const { data: existing, error: findError } = await this.databaseService.client
			.from('ad_concepts')
			.select('_id')
			.eq('_id', id)
			.is('deleted_at', null)
			.single();

		if (findError || !existing) {
			throw new BadRequestException(Message.NO_DATA_FOUND);
		}

		const { error } = await this.databaseService.client
			.from('ad_concepts')
			.update({ deleted_at: new Date().toISOString() })
			.eq('_id', id);

		if (error) {
			throw new InternalServerErrorException(Message.REMOVE_FAILED);
		}

		return { message: 'Concept soft-deleted' };
	}

	// =============================================
	// CONCEPTS — REORDER (Category-Scoped, Transactional)
	// =============================================

	/** Batch reorder concepts within a single category via Postgres RPC */
	public async reorderConcepts(input: ReorderConceptsDto): Promise<{ message: string }> {
		const { category_id, items } = input;

		if (!items || items.length === 0) {
			throw new BadRequestException('No items to reorder');
		}

		// Call transactional RPC
		const { error } = await this.databaseService.client.rpc(
			'reorder_concepts_in_category',
			{
				target_category_id: category_id,
				items: JSON.stringify(items),
			},
		);

		if (error) {
			console.log('Supabase reorder RPC error:', error);
			throw new InternalServerErrorException('Failed to reorder concepts: ' + error.message);
		}

		return { message: 'Concepts reordered successfully' };
	}

	// =============================================
	// CONCEPTS — USAGE TRACKING (Atomic via RPC)
	// =============================================

	/** Atomically increment usage_count via Postgres RPC */
	public async incrementUsage(id: string): Promise<{ usage_count: number }> {
		const { data, error } = await this.databaseService.client.rpc(
			'increment_concept_usage',
			{ concept_id: id },
		);

		if (error) {
			console.log('Supabase incrementUsage RPC error:', error);
			throw new BadRequestException(error.message || Message.NO_DATA_FOUND);
		}

		return { usage_count: data as number };
	}

	// =============================================
	// CONCEPTS — RECOMMENDED (excludes soft-deleted)
	// =============================================

	/** Get top concepts by usage_count */
	public async getRecommendedConcepts(): Promise<{ list: AdConcept[] }> {
		const { data, error } = await this.databaseService.client
			.from('ad_concepts')
			.select('*, concept_categories(name, slug)')
			.eq('is_active', true)
			.is('deleted_at', null)
			.order('usage_count', { ascending: false })
			.limit(this.conceptConfig.recommendedLimit);

		if (error) {
			throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		}

		// Flatten joined category data
		const list = (data || []).map((item: T) => {
			const concept: T = { ...item };
			if (item.concept_categories) {
				concept.category_name = item.concept_categories.name;
				concept.category_slug = item.concept_categories.slug;
			}
			delete concept.concept_categories;
			return concept;
		});

		return { list: list as AdConcept[] };
	}
}
