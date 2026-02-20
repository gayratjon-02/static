import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateBrandDto } from '../../libs/dto/brand/create-brand.dto';
import { UpdateBrandDto } from '../../libs/dto/brand/update-brand.dto';
import { Message } from '../../libs/enums/common.enum';
import { BrandIndustry, BrandVoice, INDUSTRY_LABELS, VOICE_LABELS } from '../../libs/enums/brand/brand.enum';
import { T } from '../../libs/types/common';
import { Brand } from '../../libs/types/brand/brand.type';
import { Member } from '../../libs/types/member/member.type';

@Injectable()
export class BrandService {
	private readonly logger = new Logger('BrandService');
	constructor(private databaseService: DatabaseService) { }

	/** Returns config lists (industries + voices) for frontend dropdowns */
	public getConfig() {
		const industries = Object.values(BrandIndustry).map((id) => ({
			id,
			label: INDUSTRY_LABELS[id],
		}));

		// Ensure "Other" is always last
		const otherIdx = industries.findIndex((i) => i.id === BrandIndustry.OTHER);
		if (otherIdx > -1) {
			const [other] = industries.splice(otherIdx, 1);
			industries.push(other);
		}

		const voices = Object.values(BrandVoice).map((id) => ({
			id,
			label: VOICE_LABELS[id],
		}));

		return { industries, voices };
	}

	// createBrand method
	public async createBrand(input: CreateBrandDto, authMember: Member): Promise<Brand> {
		const {
			name,
			description,
			website_url,
			industry,
			logo_url,
			primary_color,
			secondary_color,
			accent_color,
			background_color,
			voice_tags,
			target_audience,
			competitors,
		} = input;
		try {
			const { data, error } = await this.databaseService.client
				.from('brands')
				.insert({
					user_id: authMember._id,
					name: name,
					description: description,
					website_url: website_url,
					industry: industry,
					logo_url: logo_url || '',
					primary_color: primary_color,
					secondary_color: secondary_color,
					accent_color: accent_color || '#0066FF',
					background_color: background_color || '#FFFFFF',
					voice_tags: voice_tags,
					target_audience: target_audience,
					competitors: competitors || '',
				})
				.select('*')
				.single();

			if (error || !data) {
				throw new InternalServerErrorException(Message.CREATE_FAILED);
			}

			return data as Brand;
		} catch (err) {
			throw err;
		}
	}

	// getBrands method 
	public async getBrands(authMember: Member, page: number, limit: number) {
		try {
			const offset = (page - 1) * limit;

			// 1. Total count
			const { count, error: countError } = await this.databaseService.client
				.from('brands')
				.select('*', { count: 'exact', head: true })
				.eq('user_id', authMember._id);

			if (countError) {
				throw new InternalServerErrorException(Message.NO_DATA_FOUND);
			}

			// 2. Paginated list
			const { data, error } = await this.databaseService.client
				.from('brands')
				.select('*')
				.eq('user_id', authMember._id)
				.order('created_at', { ascending: false })
				.range(offset, offset + limit - 1);

			if (error) {
				throw new InternalServerErrorException(Message.NO_DATA_FOUND);
			}

			return { list: data as Brand[], total: count || 0 };
		} catch (err) {
			throw err;
		}
	}

	// getBrand method
	public async getBrand(id: string, authMember: Member): Promise<Brand> {
		try {
			const { data, error } = await this.databaseService.client
				.from('brands')
				.select('*')
				.eq('_id', id)
				.eq('user_id', authMember._id)
				.single();

			if (error || !data) {
				throw new InternalServerErrorException(Message.NO_DATA_FOUND);
			}

			return data as Brand;
		} catch (err) {
			throw err;
		}
	}

	// updateBrand method
	public async updateBrand(id: string, input: UpdateBrandDto, authMember: Member): Promise<Brand> {
		try {
			const updateData: T = {};

			const fields = [
				'name', 'description', 'website_url', 'industry',
				'logo_url', 'primary_color', 'secondary_color',
				'accent_color', 'background_color',
				'voice_tags', 'target_audience', 'competitors',
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

			const { data, error } = await this.databaseService.client
				.from('brands')
				.update(updateData)
				.eq('_id', id)
				.eq('user_id', authMember._id)
				.select('*')
				.single();

			if (error || !data) {
				throw new InternalServerErrorException(Message.UPDATE_FAILED);
			}

			return data as Brand;
		} catch (err) {
			throw err;
		}
	}

	// deleteBrand method
	public async deleteBrand(id: string, authMember: Member): Promise<{ message: string }> {
		try {
			// check existence
			const { data: existing, error: findError } = await this.databaseService.client
				.from('brands')
				.select('_id')
				.eq('_id', id)
				.eq('user_id', authMember._id)
				.single();

			if (findError || !existing) {
				throw new BadRequestException(Message.NO_DATA_FOUND);
			}

			const { error } = await this.databaseService.client
				.from('brands')
				.delete()
				.eq('_id', id)
				.eq('user_id', authMember._id);

			if (error) {
				throw new InternalServerErrorException(Message.REMOVE_FAILED);
			}

			return { message: 'Brand deleted successfully' };
		} catch (err) {
			throw err;
		}
	}

	/**
	 * Import brand data from a website URL.
	 * Fetches HTML, extracts: title, description, logo, colors, industry guess.
	 */
	public async importFromUrl(url: string) {
		this.logger.log(`Importing brand from URL: ${url}`);

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
					'User-Agent': 'Mozilla/5.0 (compatible; StaticEngine/1.0; Brand Import)',
					'Accept': 'text/html,application/xhtml+xml',
				},
			});
			clearTimeout(timeout);

			if (!response.ok) {
				throw new BadRequestException(`Website returned ${response.status}`);
			}

			const html = await response.text();
			const baseUrl = new URL(normalizedUrl);

			// ── Extract brand name ──
			const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
			let name = titleMatch ? titleMatch[1].trim() : baseUrl.hostname;
			// Clean title: remove " | Site Name", " - Tagline", etc.
			name = name.split(/\s*[|\-–—]\s*/)[0].trim();
			if (name.length > 100) name = name.substring(0, 100);

			// ── Extract description ──
			const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i)
				|| html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i);
			const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["']/i);
			let description = descMatch?.[1] || ogDescMatch?.[1] || '';
			description = description.trim().substring(0, 500);

			// ── Extract logo URL ──
			let logo_url = '';
			// Priority: og:image > apple-touch-icon > favicon
			const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([\s\S]*?)["']/i);
			const appleTouchMatch = html.match(/<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([\s\S]*?)["']/i);
			const faviconMatch = html.match(/<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([\s\S]*?)["']/i);

			const rawLogo = ogImageMatch?.[1] || appleTouchMatch?.[1] || faviconMatch?.[1] || '';
			if (rawLogo) {
				try {
					logo_url = new URL(rawLogo, normalizedUrl).href;
				} catch {
					logo_url = rawLogo;
				}
			}

			// ── Extract colors ──
			let primary_color = '#000000';
			let secondary_color = '#333333';

			// 1. theme-color meta tag
			const themeColorMatch = html.match(/<meta[^>]*name=["']theme-color["'][^>]*content=["'](#[0-9A-Fa-f]{3,8})["']/i)
				|| html.match(/<meta[^>]*content=["'](#[0-9A-Fa-f]{3,8})["'][^>]*name=["']theme-color["']/i);
			if (themeColorMatch?.[1]) {
				primary_color = themeColorMatch[1].substring(0, 7); // trim to 6-char hex
			}

			// 2. Find hex colors from inline CSS
			const hexColors = html.match(/#[0-9A-Fa-f]{6}/g) || [];
			const colorCounts: Record<string, number> = {};
			for (const c of hexColors) {
				const lower = c.toLowerCase();
				// Skip common defaults
				if (['#000000', '#ffffff', '#333333', '#666666', '#999999', '#cccccc', '#f5f5f5', '#e5e5e5'].includes(lower)) continue;
				colorCounts[lower] = (colorCounts[lower] || 0) + 1;
			}
			const sortedColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
			if (sortedColors.length > 0 && primary_color === '#000000') {
				primary_color = sortedColors[0][0];
			}
			if (sortedColors.length > 1) {
				secondary_color = sortedColors[1][0];
			}

			// ── Guess industry ──
			const lowerHtml = (name + ' ' + description).toLowerCase();
			const industryKeywords: Record<string, BrandIndustry> = {
				'supplement': BrandIndustry.SUPPLEMENTS,
				'vitamin': BrandIndustry.SUPPLEMENTS,
				'nutrition': BrandIndustry.SUPPLEMENTS,
				'fashion': BrandIndustry.APPAREL,
				'clothing': BrandIndustry.APPAREL,
				'apparel': BrandIndustry.APPAREL,
				'beauty': BrandIndustry.BEAUTY,
				'skincare': BrandIndustry.BEAUTY,
				'cosmetic': BrandIndustry.BEAUTY,
				'food': BrandIndustry.FOOD_BEVERAGE,
				'beverage': BrandIndustry.FOOD_BEVERAGE,
				'coffee': BrandIndustry.FOOD_BEVERAGE,
				'software': BrandIndustry.SAAS,
				'saas': BrandIndustry.SAAS,
				'platform': BrandIndustry.SAAS,
				'fitness': BrandIndustry.FITNESS,
				'gym': BrandIndustry.FITNESS,
				'workout': BrandIndustry.FITNESS,
				'home': BrandIndustry.HOME_GOODS,
				'furniture': BrandIndustry.HOME_GOODS,
				'pet': BrandIndustry.PETS,
				'dog': BrandIndustry.PETS,
				'cat': BrandIndustry.PETS,
				'finance': BrandIndustry.FINANCIAL_SERVICES,
				'invest': BrandIndustry.FINANCIAL_SERVICES,
				'banking': BrandIndustry.FINANCIAL_SERVICES,
				'education': BrandIndustry.EDUCATION,
				'learn': BrandIndustry.EDUCATION,
				'course': BrandIndustry.EDUCATION,
				'shop': BrandIndustry.ECOMMERCE,
				'store': BrandIndustry.ECOMMERCE,
				'buy': BrandIndustry.ECOMMERCE,
			};

			let industry: BrandIndustry = BrandIndustry.OTHER;
			for (const [keyword, ind] of Object.entries(industryKeywords)) {
				if (lowerHtml.includes(keyword)) {
					industry = ind;
					break;
				}
			}

			this.logger.log(`Import complete: "${name}" | industry: ${industry} | colors: ${primary_color}, ${secondary_color} | logo: ${logo_url ? 'found' : 'none'}`);

			return {
				name,
				description,
				website_url: normalizedUrl,
				industry,
				logo_url,
				primary_color,
				secondary_color,
				accent_color: '',
				background_color: '#FFFFFF',
			};
		} catch (err) {
			if (err instanceof BadRequestException) throw err;
			const message = err instanceof Error ? err.message : String(err);
			this.logger.error(`Import from URL failed: ${message}`);
			throw new BadRequestException(`Could not import brand from URL: ${message}`);
		}
	}
}
