import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateProductDto } from '../../libs/dto/product/create-product.dto';
import { Message } from '../../libs/enums/common.enum';
import { Product } from '../../libs/types/product/product.type';
import { Member } from '../../libs/types/member/member.type';

@Injectable()
export class ProductService {
	constructor(private databaseService: DatabaseService) {}

	// createProduct method
	public async createProduct(input: CreateProductDto, authMember: Member): Promise<Product> {
		try {
			// Ccheck existing brand
			const { data: brand, error: brandError } = await this.databaseService.client
				.from('brands')
				.select('_id')
				.eq('_id', input.brand_id)
				.eq('user_id', authMember._id)
				.single();

			if (brandError || !brand) {
				throw new BadRequestException(Message.NO_BRAND_FOUND);
			}

			// photo_url required IF has_physical_product = true
			if (input.has_physical_product && !input.photo_url) {
				throw new BadRequestException('photo_url is required when has_physical_product is true');
			}

			const { data, error } = await this.databaseService.client
				.from('products')
				.insert({
					brand_id: input.brand_id,
					name: input.name,
					description: input.description,
					usps: input.usps,
					photo_url: input.photo_url || '',
					has_physical_product: input.has_physical_product ?? false,
					price_text: input.price_text || '',
					product_url: input.product_url || '',
					star_rating: input.star_rating ?? null,
					review_count: input.review_count ?? null,
					ingredients_features: input.ingredients_features || '',
					before_description: input.before_description || '',
					after_description: input.after_description || '',
					offer_text: input.offer_text || '',
				})
				.select('*')
				.single();

			if (error || !data) {
				throw new InternalServerErrorException(Message.CREATE_FAILED);
			}

			return data as Product;
		} catch (err) {
			throw err;
		}
	}
}
