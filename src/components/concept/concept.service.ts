import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
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
}
