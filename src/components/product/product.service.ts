import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ProductScraperService } from '../../libs/services/product-scraper.service';
import { CreateProductDto } from '../../libs/dto/product/create-product.dto';
import { UpdateProductDto } from '../../libs/dto/product/update-product.dto';
import { Message } from '../../libs/enums/common.enum';
import { T } from '../../libs/types/common';
import { Product } from '../../libs/types/product/product.type';
import { Member } from '../../libs/types/member/member.type';

export interface ProductImportResult {
	name: string;
	description: string;
	product_url: string;
	price_text: string;
	image_urls: string[];
}

@Injectable()
export class ProductService {
	private readonly logger = new Logger('ProductService');
	constructor(
		private readonly databaseService: DatabaseService,
		private readonly productScraperService: ProductScraperService,
	) { }

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
					photo_url: input.photo_url ?? '',
					back_image_url: input.back_image_url ?? '',
					reference_image_urls: input.reference_image_urls ?? [],
					has_physical_product: input.has_physical_product ?? false,
					price_text: input.price_text ?? '',
					product_url: input.product_url ?? '',
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

	// getProducts method — brand bo'yicha productlar
	public async getProducts(brandId: string, authMember: Member, page: number, limit: number) {
		try {
			// Check brand ownership
			const { data: brand, error: brandError } = await this.databaseService.client
				.from('brands')
				.select('_id')
				.eq('_id', brandId)
				.eq('user_id', authMember._id)
				.single();

			if (brandError || !brand) {
				throw new BadRequestException(Message.NO_BRAND_FOUND);
			}

			const offset = (page - 1) * limit;

			// Total count
			const { count, error: countError } = await this.databaseService.client
				.from('products')
				.select('*', { count: 'exact', head: true })
				.eq('brand_id', brandId);

			if (countError) {
				throw new InternalServerErrorException(Message.NO_DATA_FOUND);
			}

			// Paginated list
			const { data, error } = await this.databaseService.client
				.from('products')
				.select('*')
				.eq('brand_id', brandId)
				.order('created_at', { ascending: false })
				.range(offset, offset + limit - 1);

			if (error) {
				throw new InternalServerErrorException(Message.NO_DATA_FOUND);
			}

			return { list: data as Product[], total: count || 0 };
		} catch (err) {
			throw err;
		}
	}

	// getProduct method — get one product
	public async getProduct(id: string, authMember: Member): Promise<Product> {
		try {
			const { data, error } = await this.databaseService.client
				.from('products')
				.select('*, brands!inner(_id, user_id)')
				.eq('_id', id)
				.eq('brands.user_id', authMember._id)
				.single();

			if (error || !data) {
				throw new BadRequestException(Message.NO_DATA_FOUND);
			}

			const { brands, ...product } = data;
			return product as Product;
		} catch (err) {
			throw err;
		}
	}

	// updateProduct method
	public async updateProduct(id: string, input: UpdateProductDto, authMember: Member): Promise<Product> {
		try {
			// Ownership: product -> brand -> user_id
			const { data: existing, error: findError } = await this.databaseService.client
				.from('products')
				.select('_id, brands!inner(user_id)')
				.eq('_id', id)
				.eq('brands.user_id', authMember._id)
				.single();

			if (findError || !existing) {
				throw new BadRequestException(Message.NO_DATA_FOUND);
			}

			const updateData: T = {};

			const fields = [
				'name', 'description', 'usps', 'photo_url',
				'back_image_url', 'reference_image_urls',
				'has_physical_product', 'price_text', 'product_url',
				'star_rating', 'review_count', 'ingredients_features',
				'before_description', 'after_description', 'offer_text',
			];

			for (const field of fields) {
				if (input[field] !== undefined) {
					updateData[field] = input[field];
				}
			}

			if (Object.keys(updateData).length === 0) {
				throw new BadRequestException(Message.BAD_REQUEST);
			}

			updateData.updated_at = new Date();

			const { data: updated, error: updateError } = await this.databaseService.client
				.from('products')
				.update(updateData)
				.eq('_id', id)
				.select('*')
				.single();

			if (updateError || !updated) {
				throw new InternalServerErrorException(Message.UPDATE_FAILED);
			}

			return updated as Product;
		} catch (err) {
			throw err;
		}
	}

	// deleteProduct method
	public async deleteProduct(id: string, authMember: Member): Promise<{ message: string }> {
		try {
			// Ownership: product -> brand -> user_id
			const { data: existing, error: findError } = await this.databaseService.client
				.from('products')
				.select('_id, brands!inner(user_id)')
				.eq('_id', id)
				.eq('brands.user_id', authMember._id)
				.single();

			if (findError || !existing) {
				throw new BadRequestException(Message.NO_DATA_FOUND);
			}

			const { error } = await this.databaseService.client
				.from('products')
				.delete()
				.eq('_id', id);

			if (error) {
				throw new InternalServerErrorException(Message.REMOVE_FAILED);
			}

			return { message: 'Product deleted successfully' };
		} catch (err) {
			throw err;
		}
	}

	async importFromUrl(url: string): Promise<ProductImportResult> {
		console.log('ProductService: importFromUrl');

		try {
			const scraped = await this.productScraperService.scrape(url);

			let normalizedUrl = url.trim();
			if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
				normalizedUrl = `https://${normalizedUrl}`;
			}

			this.logger.log(`Import complete: "${scraped.name}" | images: ${scraped.image_urls.length}`);

			return {
				name: scraped.name,
				description: scraped.description,
				product_url: normalizedUrl,
				price_text: scraped.price_text,
				image_urls: scraped.image_urls,
			};
		} catch (err) {
			if (err instanceof BadRequestException) throw err;
			const message = err instanceof Error ? err.message : String(err);
			this.logger.error(`Import from URL failed: ${message}`);
			throw new BadRequestException(`Could not import product from URL: ${message}`);
		}
	}

	/**
	 * Remove background from a product photo.
	 * 1. Downloads current photo
	 * 2. Calls remove.bg API
	 * 3. Uploads new transparent PNG to S3
	 * 4. Updates product in DB
	 */
	public async removeBackground(id: string, authMember: Member, s3Service: any): Promise<{ photo_url: string }> {
		try {
			// Ownership check
			const { data: product, error: findError } = await this.databaseService.client
				.from('products')
				.select('_id, photo_url, brands!inner(user_id)')
				.eq('_id', id)
				.eq('brands.user_id', authMember._id)
				.single();

			if (findError || !product) {
				throw new BadRequestException(Message.NO_DATA_FOUND);
			}

			if (!product.photo_url) {
				throw new BadRequestException('Product has no photo to process');
			}

			const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY;
			if (!REMOVE_BG_API_KEY) {
				throw new InternalServerErrorException('Remove.bg API key is not configured');
			}

			// Download original image
			const imgRes = await fetch(product.photo_url);
			if (!imgRes.ok) throw new Error('Could not download original image');
			const imgBuffer = await imgRes.arrayBuffer();

			// Pre-check size logic: remove.bg allows max 12MB.
			// Let's assume it's fine, pass to FormData
			const formData = new FormData();
			formData.append('image_file', new Blob([imgBuffer]), 'image.jpg');
			formData.append('size', 'auto');

			this.logger.log(`Removing bg for product ${id}...`);
			const response = await fetch('https://api.remove.bg/v1.0/removebg', {
				method: 'POST',
				headers: {
					'X-Api-Key': REMOVE_BG_API_KEY,
					'Accept': 'application/json', // Get base64 json back
				},
				body: formData,
			});

			if (!response.ok) {
				const errorText = await response.text();
				this.logger.error(`Remove.bg failed: ${response.status} - ${errorText}`);
				throw new Error('Background removal failed');
			}

			const result = await response.json();
			if (!result.data || !result.data.result_b64) {
				throw new Error('Invalid response from remove.bg');
			}

			// Convert base64 to buffer
			const newBuffer = Buffer.from(result.data.result_b64, 'base64');
			const key = `products/nobg_${id}_${Date.now()}.png`;

			// Upload to S3
			const newUrl = await s3Service.upload(newBuffer, key, 'image/png');

			// Update DB
			const { error: updateError } = await this.databaseService.client
				.from('products')
				.update({ photo_url: newUrl, updated_at: new Date() })
				.eq('_id', id);

			if (updateError) {
				throw new InternalServerErrorException('Failed to save new photo URL');
			}

			this.logger.log(`Background removed successfully for product ${id}`);
			return { photo_url: newUrl };

		} catch (err: any) {
			this.logger.error(`removeBackground error: ${err.message}`);
			if (err instanceof BadRequestException || err instanceof InternalServerErrorException) {
				throw err;
			}
			throw new InternalServerErrorException(err.message || 'Background removal failed');
		}
	}
}
