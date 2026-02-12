import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateConceptDto } from '../../libs/dto/concept/create-concept.dto';
import { Message } from '../../libs/enums/common.enum';
import { AdConcept } from '../../libs/types/concept/concept.type';

@Injectable()
export class ConceptService {
	constructor(private databaseService: DatabaseService) {}

	// getConcepts — concept library (faqat is_active = true)
	public async getConcepts(category?: string, search?: string, page: number = 1, limit: number = 20) {
		try {
			const offset = (page - 1) * limit;

			// Base query — faqat active conceptlar
			let countQuery = this.databaseService.client
				.from('ad_concepts')
				.select('*', { count: 'exact', head: true })
				.eq('is_active', true);

			let dataQuery = this.databaseService.client
				.from('ad_concepts')
				.select('*')
				.eq('is_active', true);

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
				throw new InternalServerErrorException(Message.CREATE_FAILED);
			}

			return data as AdConcept;
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

