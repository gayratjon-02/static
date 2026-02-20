import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateProductDto } from '../../libs/dto/product/create-product.dto';
import { UpdateProductDto } from '../../libs/dto/product/update-product.dto';
import { Message } from '../../libs/enums/common.enum';
import { T } from '../../libs/types/common';
import { Product } from '../../libs/types/product/product.type';
import { Member } from '../../libs/types/member/member.type';

@Injectable()
export class ProductService {
	private readonly logger = new Logger('ProductService');
	constructor(private databaseService: DatabaseService) { }

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

	// getProducts method — brand bo'yicha productlar
	public async getProducts(brandId: string, authMember: Member, page: number, limit: number) {
		try {
			// Brand ownership tekshirish
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

	/**
	 * Import product data from a website URL.
	 * Fetches HTML, extracts: name, description, price, photo.
	 */
	public async importFromUrl(url: string) {
		this.logger.log(`Importing product from URL: ${url}`);

		try {
			// Normalize URL
			let normalizedUrl = url.trim();
			if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
				normalizedUrl = `https://${normalizedUrl}`;
			}

			// Fetch HTML with timeout
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 10000);
			const response = await fetch(normalizedUrl, {
				signal: controller.signal,
				headers: {
					'User-Agent': 'Mozilla/5.0 (compatible; StaticEngine/1.0; Product Import)',
					'Accept': 'text/html,application/xhtml+xml',
				},
			});
			clearTimeout(timeout);

			if (!response.ok) {
				throw new BadRequestException(`Website returned ${response.status}`);
			}

			const html = await response.text();
			const baseUrl = new URL(normalizedUrl);

			// ── Extract product name ──
			// Try OG title first, then regular title
			const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([\s\S]*?)["']/i);
			const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
			let name = ogTitleMatch?.[1] || titleMatch?.[1] || baseUrl.pathname.split('/').pop() || 'Imported Product';
			name = name.split(/\s*[|\-–—]\s*/)[0].trim().replace(/_/g, ' ');
			if (name.length > 100) name = name.substring(0, 100);

			// ── Extract description ──
			const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["']/i);
			const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i)
				|| html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i);
			let description = ogDescMatch?.[1] || descMatch?.[1] || '';
			description = description.trim().substring(0, 500);

			// ── Extract photo URL ──
			let photo_url = '';
			const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([\s\S]*?)["']/i);
			const twitterImageMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([\s\S]*?)["']/i);
			const rawPhoto = ogImageMatch?.[1] || twitterImageMatch?.[1] || '';

			if (rawPhoto) {
				try {
					photo_url = new URL(rawPhoto, normalizedUrl).href;
				} catch {
					photo_url = rawPhoto;
				}
			}

			// ── Extract price (Basic heuristics) ──
			let price_text = '';
			// Look for common price patterns like $19.99, £20, €15.50 in meta tags
			const priceAmountMatch = html.match(/<meta[^>]*property=["']product:price:amount["'][^>]*content=["']([\d.]+)["']/i);
			const priceCurrencyMatch = html.match(/<meta[^>]*property=["']product:price:currency["'][^>]*content=["']([A-Z]{3})["']/i);

			if (priceAmountMatch) {
				const amount = priceAmountMatch[1];
				const curr = priceCurrencyMatch?.[1] || '$';
				price_text = curr === 'USD' ? `$${amount}` : `${amount} ${curr}`;
			}

			this.logger.log(`Import complete: "${name}" | photo: ${photo_url ? 'found' : 'none'}`);

			return {
				name,
				description,
				product_url: normalizedUrl,
				photo_url,
				price_text,
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
