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
		try {
			const { data, error } = await this.databaseService.client
				.from('concept_categories')
				.select('*')
				.order('display_order', { ascending: true });

			if (error) {
				// Table may not exist yet — return empty gracefully
				console.log('getCategories warning:', error.message);
				return { list: [] };
			}

			return { list: (data as ConceptCategoryItem[]) || [] };
		} catch {
			return { list: [] };
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
			throw new InternalServerErrorException(Message.CREATE_FAILED);
		}

		return data as ConceptCategoryItem;
	}

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
			countQuery = countQuery.eq('category_id', categoryId);
			dataQuery = dataQuery.eq('category_id', categoryId);
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

		return { list: (data || []) as AdConcept[], total: count || 0 };
	}

	/** Create a new concept */
	public async createConcept(input: CreateConceptDto): Promise<AdConcept> {
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

	private async getNextConceptOrder(categoryId?: string): Promise<number> {
		let query = this.databaseService.client
			.from('ad_concepts')
			.select('display_order')
			.order('display_order', { ascending: false })
			.limit(1);

		if (categoryId) {
			query = query.eq('category_id', categoryId);
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
			.select('*')
			.single();

		if (error || !data) {
			console.log('Supabase updateConcept error:', error);
			throw new InternalServerErrorException(Message.UPDATE_FAILED);
		}

		return data as AdConcept;
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

		// Sequential updates (will use RPC after migration 003 is run)
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

	/** Increment usage_count (will use atomic RPC after migration 003 is run) */
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

		return { list: (data || []) as AdConcept[] };
	}
}
