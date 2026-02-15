import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateConceptDto } from '../../libs/dto/concept/create-concept.dto';
import { UpdateConceptDto } from '../../libs/dto/concept/update-concept.dto';
import { Message } from '../../libs/enums/common.enum';
import { T } from '../../libs/types/common';
import { AdConcept } from '../../libs/types/concept/concept.type';

@Injectable()
export class ConceptService {
	constructor(private databaseService: DatabaseService) { }

	// getConcepts — concept library (admin: all, user: faqat is_active = true)
	public async getConcepts(category?: string, search?: string, page: number = 1, limit: number = 20, includeInactive: boolean = false) {
		try {
			const offset = (page - 1) * limit;

			// Base query
			let countQuery = this.databaseService.client
				.from('ad_concepts')
				.select('*', { count: 'exact', head: true });

			let dataQuery = this.databaseService.client.from('ad_concepts').select('*');

			// User uchun faqat active conceptlar
			if (!includeInactive) {
				countQuery = countQuery.eq('is_active', true);
				dataQuery = dataQuery.eq('is_active', true);
			}

			// Filter: category
			if (category) {
				countQuery = countQuery.eq('category', category);
				dataQuery = dataQuery.eq('category', category);
			}

			// Filter: search (tags array ichidan qidirish)
			if (search) {
				countQuery = countQuery.contains('tags', [search]);
				dataQuery = dataQuery.contains('tags', [search]);
			}

			// Total count
			const { count, error: countError } = await countQuery;

			if (countError) {
				throw new InternalServerErrorException(Message.NO_DATA_FOUND);
			}

			// Paginated list
			const { data, error } = await dataQuery
				.order('display_order', { ascending: true })
				.range(offset, offset + limit - 1);

			if (error) {
				throw new InternalServerErrorException(Message.NO_DATA_FOUND);
			}

			return { list: data as AdConcept[], total: count || 0 };
		} catch (err) {
			throw err;
		}
	}

	// createConcept — admin tomonidan yangi concept yaratish
	public async createConcept(input: CreateConceptDto): Promise<AdConcept> {
		try {
			const { data, error } = await this.databaseService.client
				.from('ad_concepts')
				.insert({
					category: input.category,
					name: input.name,
					image_url: input.image_url,
					tags: input.tags,
					description: input.description,
					source_url: input.source_url || '',
					is_active: input.is_active ?? true,
					display_order: input.display_order ?? 0,
					usage_count: 0,
				})
				.select('*')
				.single();

			if (error || !data) {
				console.log('Supabase createConcept error:', error);
				throw new InternalServerErrorException(Message.CREATE_FAILED);
			}

			return data as AdConcept;
		} catch (err) {
			throw err;
		}
	}

	// updateConcept — admin tomonidan concept tahrirlash
	public async updateConcept(id: string, input: UpdateConceptDto): Promise<AdConcept> {
		try {
			// Concept mavjudligini tekshirish
			const { data: existing, error: findError } = await this.databaseService.client
				.from('ad_concepts')
				.select('_id')
				.eq('_id', id)
				.single();

			if (findError || !existing) {
				throw new BadRequestException(Message.NO_DATA_FOUND);
			}

			const updateData: T = {};

			const fields = ['category', 'name', 'image_url', 'tags', 'description', 'source_url', 'is_active', 'display_order'];

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
		} catch (err) {
			throw err;
		}
	}

	// deleteConcept — faqat SUPER_ADMIN
	public async deleteConcept(id: string): Promise<{ message: string }> {
		try {
			const { data: existing, error: findError } = await this.databaseService.client
				.from('ad_concepts')
				.select('_id')
				.eq('_id', id)
				.single();

			if (findError || !existing) {
				throw new BadRequestException(Message.NO_DATA_FOUND);
			}

			const { error } = await this.databaseService.client.from('ad_concepts').delete().eq('_id', id);

			if (error) {
				throw new InternalServerErrorException(Message.REMOVE_FAILED);
			}

			return { message: 'Concept deleted' };
		} catch (err) {
			throw err;
		}
	}

	// getRecommendedConcepts — usage_count bo'yicha top 10
	public async getRecommendedConcepts(): Promise<{ list: AdConcept[] }> {
		try {
			const { data, error } = await this.databaseService.client
				.from('ad_concepts')
				.select('*')
				.eq('is_active', true)
				.order('usage_count', { ascending: false })
				.limit(10);
			if (error) {
				throw new InternalServerErrorException(Message.NO_DATA_FOUND);
			}

			return { list: (data as AdConcept[]) || [] };
		} catch (err) {
			throw err;
		}
	}
}
