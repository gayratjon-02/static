import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ClaudeService } from '../../libs/services/claude.service';
import { CreateBrandDto } from '../../libs/dto/brand/create-brand.dto';
import { UpdateBrandDto } from '../../libs/dto/brand/update-brand.dto';
import { Message } from '../../libs/enums/common.enum';
import { BrandIndustry, BrandVoice, INDUSTRY_LABELS, VOICE_LABELS } from '../../libs/enums/brand/brand.enum';
import { T } from '../../libs/types/common';
import { Brand } from '../../libs/types/brand/brand.type';
import { Member } from '../../libs/types/member/member.type';

export interface BrandImportResult {
	name: string;
	description: string;
	website_url: string;
	industry: string;
	logo_url: string;
	primary_color: string;
	secondary_color: string;
	accent_color: string;
	background_color: string;
	confidence_score: number;
	warnings: string[];
}

@Injectable()
export class BrandService {
	private readonly logger = new Logger('BrandService');
	constructor(
		private databaseService: DatabaseService,
		private claudeService: ClaudeService,
	) { }

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
	 * Import brand data from a website URL using Claude AI.
	 * Always resolves to homepage, extracts brand-level (not product-level) data.
	 */
	public async importFromUrl(url: string): Promise<BrandImportResult> {
		this.logger.log(`Importing brand from URL: ${url}`);

		// Step 1: Resolve to homepage
		const { homepageUrl, isProductPage } = this.resolveToHomepage(url);
		this.logger.log(`Resolved to homepage: ${homepageUrl} (product page: ${isProductPage})`);

		// Step 2: Scrape homepage HTML
		const { html, metaTags, cssColors } = await this.scrapeHomepage(homepageUrl);

		// Step 3: Send to Claude for intelligent extraction
		const brandData = await this.extractWithClaude({
			inputUrl: url,
			homepageUrl,
			html,
			metaTags,
			cssColors,
			isProductPage,
		});

		// Step 4: Post-process and validate
		return this.postProcessBrandImport(brandData, homepageUrl);
	}

	/**
	 * Always resolve to homepage root domain.
	 * Product pages should NEVER be used for brand extraction.
	 */
	private resolveToHomepage(inputUrl: string): { homepageUrl: string; isProductPage: boolean } {
		try {
			const normalized = inputUrl.trim();
			const url = new URL(normalized.startsWith('http') ? normalized : `https://${normalized}`);
			const homepageUrl = `${url.protocol}//${url.hostname}/`;
			const isProductPage = this.isProductPageUrl(url.pathname);
			return { homepageUrl, isProductPage };
		} catch {
			throw new BadRequestException('Invalid URL provided');
		}
	}

	/**
	 * Detect common product page URL patterns.
	 */
	private isProductPageUrl(pathname: string): boolean {
		const productPatterns = [
			/\/products?\//i,
			/\/shop\//i,
			/\/item\//i,
			/\/p\//i,
			/\/catalog\//i,
			/\/collections?\/.+\/.+/i,
			/\/dp\//i,
			/\/gp\/product/i,
		];
		return productPatterns.some((pattern) => pattern.test(pathname));
	}

	/**
	 * Scrape homepage and extract structured data for Claude.
	 */
	private async scrapeHomepage(url: string): Promise<{
		html: string;
		metaTags: Record<string, string>;
		cssColors: string[];
	}> {
		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 15000);
			const response = await fetch(url, {
				signal: controller.signal,
				headers: {
					'User-Agent': 'Mozilla/5.0 (compatible; StaticEngineBot/1.0; +https://staticengine.com)',
					'Accept': 'text/html,application/xhtml+xml',
				},
			});
			clearTimeout(timeout);

			if (!response.ok) {
				throw new BadRequestException(`Website returned ${response.status}`);
			}

			const fullHtml = await response.text();

			// Extract meta tags
			const metaTags: Record<string, string> = {};
			const metaRegex = /<meta[^>]*(?:(?:property|name)=["']([^"']+)["'][^>]*content=["']([^"']*?)["']|content=["']([^"']*?)["'][^>]*(?:property|name)=["']([^"']+)["'])[^>]*>/gi;
			let metaMatch;
			while ((metaMatch = metaRegex.exec(fullHtml)) !== null) {
				const key = metaMatch[1] || metaMatch[4];
				const value = metaMatch[2] || metaMatch[3];
				if (key && value) metaTags[key] = value;
			}

			// Extract title
			const titleMatch = fullHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
			if (titleMatch) metaTags['title'] = titleMatch[1].trim();

			// Extract logo candidates
			const logoUrls: string[] = [];
			const iconRegex = /<link[^>]*rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
			let iconMatch;
			while ((iconMatch = iconRegex.exec(fullHtml)) !== null) {
				logoUrls.push(this.resolveUrl(iconMatch[1], url));
			}
			const headerLogoRegex = /<(?:header|div[^>]*class=["'][^"']*(?:header|logo|nav)[^"']*["'])[^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
			let logoMatch;
			while ((logoMatch = headerLogoRegex.exec(fullHtml)) !== null) {
				logoUrls.push(this.resolveUrl(logoMatch[1], url));
			}
			metaTags['_logo_candidates'] = JSON.stringify(logoUrls);

			// Extract CSS colors
			const cssColors: string[] = [];
			const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
			let styleMatch;
			let styleContent = '';
			while ((styleMatch = styleRegex.exec(fullHtml)) !== null) {
				styleContent += styleMatch[1] + '\n';
			}
			const hexMatches = styleContent.match(/#[0-9a-fA-F]{3,8}/g) || [];
			cssColors.push(...hexMatches);
			const varMatches = styleContent.match(/--[\w-]*color[\w-]*:\s*[^;]+/gi) || [];
			cssColors.push(...varMatches);

			// Trim HTML to essential brand-relevant parts
			const essentialHtml = this.extractEssentialHtml(fullHtml);

			return { html: essentialHtml, metaTags, cssColors };
		} catch (err) {
			if (err instanceof BadRequestException) throw err;
			const message = err instanceof Error ? err.message : String(err);
			this.logger.error(`Failed to scrape ${url}: ${message}`);
			throw new BadRequestException(`Could not access website: ${url}. Please check the URL and try again.`);
		}
	}

	/**
	 * Trim HTML to only brand-relevant sections to reduce token usage.
	 */
	private extractEssentialHtml(html: string): string {
		const parts: string[] = [];

		// Header
		const headerMatch = html.match(/<header[^>]*>([\s\S]*?)<\/header>/i);
		if (headerMatch) parts.push(`<header>${headerMatch[1].substring(0, 1500)}</header>`);

		// Hero / Banner section text
		const heroMatch = html.match(/<(?:section|div)[^>]*class=["'][^"']*(?:hero|banner)[^"']*["'][^>]*>([\s\S]*?)<\/(?:section|div)>/i);
		if (heroMatch) {
			const heroText = heroMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 1000);
			if (heroText) parts.push(`<hero_text>${heroText}</hero_text>`);
		}

		// About section
		const aboutMatch = html.match(/<(?:section|div)[^>]*(?:class|id)=["'][^"']*(?:about|mission)[^"']*["'][^>]*>([\s\S]*?)<\/(?:section|div)>/i);
		if (aboutMatch) {
			const aboutText = aboutMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 500);
			if (aboutText) parts.push(`<about_text>${aboutText}</about_text>`);
		}

		// Footer
		const footerMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i);
		if (footerMatch) {
			const footerText = footerMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 500);
			if (footerText) parts.push(`<footer_text>${footerText}</footer_text>`);
		}

		return parts.join('\n') || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 3000);
	}

	/**
	 * Send scraped data to Claude for intelligent brand extraction.
	 */
	private async extractWithClaude(params: {
		inputUrl: string;
		homepageUrl: string;
		html: string;
		metaTags: Record<string, string>;
		cssColors: string[];
		isProductPage: boolean;
	}): Promise<BrandImportResult> {
		const systemPrompt = `You are a brand intelligence analyst for Static Engine, an AI-powered ad creation platform. Your job is to extract BRAND-LEVEL information from a company's homepage HTML — NOT product-level data.

CRITICAL RULES:
1. You extract information about the COMPANY/BRAND, never about individual products
2. Brand Name = the company/business name (e.g., "GlowVita", "FreshPaws", "UrbanThread"), NOT a product name
3. Brand Description = what the company does overall, its mission, who it serves — NOT a product description
4. If given a product page URL, you MUST extract the root domain and analyze the homepage instead
5. Logo = site-wide logo/favicon, NOT a product image
6. Colors = brand-level colors from the site header, footer, and primary CTAs — not product-specific colors

OUTPUT FORMAT — respond ONLY with valid JSON, no markdown, no preamble:
{
  "brand_name": "string — the company/business name only",
  "brand_description": "string — 1-3 sentence brand overview: what the company does, who it serves, its positioning. Max 500 chars",
  "industry": "string — one of: ecommerce, supplements, apparel, beauty, food_beverage, saas, fitness, home_goods, pets, financial_services, education, other",
  "website_url": "string — the homepage URL (root domain), NOT a product page",
  "logo_url": "string | null — URL to the site logo (from header, og:image if it's a logo, or favicon). NEVER use a product image",
  "primary_color": "string — hex code of the dominant brand color (header, buttons, CTAs)",
  "secondary_color": "string — hex code of the secondary brand color",
  "accent_color": "string | null — hex code of accent color if clearly present",
  "confidence_score": "number 0-1 — how confident you are in the extraction",
  "warnings": ["array of strings — any issues found"]
}

HANDLING EDGE CASES:
- If the HTML contains an og:site_name meta tag, prefer that for brand_name
- If the HTML title is "Product Name | Brand Name" or "Product Name - Brand Name", extract only the Brand Name part
- Look for the company name in: og:site_name, <title> suffix after | or -, footer copyright text, header logo alt text
- For colors, prioritize: CSS custom properties (--primary-color), header/nav background, main CTA button colors
- Decode HTML entities: &ndash; → –, &amp; → &, etc. Never include raw HTML entities in output`;

		const userPrompt = `Extract BRAND-LEVEL information from this website.

INPUT URL (user provided): ${params.inputUrl}
RESOLVED HOMEPAGE URL: ${params.homepageUrl}

<homepage_html>
${params.html}
</homepage_html>

<meta_tags>
${JSON.stringify(params.metaTags, null, 2)}
</meta_tags>

<css_colors>
${JSON.stringify(params.cssColors)}
</css_colors>

${params.isProductPage ? `NOTE: The user entered a product page URL. I have already navigated to the homepage (${params.homepageUrl}) and scraped it instead. Extract brand-level data from the homepage, NOT product data.` : ''}

Remember: Extract BRAND information only. Return valid JSON.`;

		try {
			const response = await this.claudeService.complete({
				system: systemPrompt,
				messages: [{ role: 'user', content: userPrompt }],
				max_tokens: 1000,
				temperature: 0.1,
			});

			const cleaned = response.content
				.replace(/```json\n?/g, '')
				.replace(/```\n?/g, '')
				.trim();
			return JSON.parse(cleaned);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.logger.error(`Claude brand extraction failed: ${message}`);
			throw new BadRequestException('Could not extract brand information. Please fill in the details manually.');
		}
	}

	/**
	 * Post-process: validate, clean, ensure homepage URL.
	 */
	private postProcessBrandImport(data: BrandImportResult, homepageUrl: string): BrandImportResult {
		// Always force homepage URL
		data.website_url = homepageUrl;

		// Ensure warnings array exists
		if (!Array.isArray(data.warnings)) data.warnings = [];

		// Clean HTML entities
		data.name = this.decodeHtmlEntities(data.name || '');
		data.description = this.decodeHtmlEntities(data.description || '');

		// Map Claude's brand_name/brand_description to our fields
		if ((data as any).brand_name && !data.name) data.name = (data as any).brand_name;
		if ((data as any).brand_description && !data.description) data.description = (data as any).brand_description;
		// Also handle if Claude returned brand_name instead of name
		if ((data as any).brand_name) {
			data.name = this.decodeHtmlEntities((data as any).brand_name);
		}
		if ((data as any).brand_description) {
			data.description = this.decodeHtmlEntities((data as any).brand_description);
		}

		// Validate hex colors
		data.primary_color = this.validateHexColor(data.primary_color, '#2c3e50');
		data.secondary_color = this.validateHexColor(data.secondary_color, '#3498db');
		data.accent_color = this.validateHexColor(data.accent_color, '') || '';
		if (!data.background_color) data.background_color = '#FFFFFF';

		// Validate logo URL is NOT a product image
		if (data.logo_url && this.looksLikeProductImage(data.logo_url)) {
			data.warnings.push('Logo URL appears to be a product image. Please upload your logo manually.');
			data.logo_url = '';
		}

		// Default confidence
		if (typeof data.confidence_score !== 'number') data.confidence_score = 0.5;

		this.logger.log(`Brand import complete: "${data.name}" | industry: ${data.industry} | confidence: ${data.confidence_score}`);
		return data;
	}

	private looksLikeProductImage(url: string): boolean {
		const patterns = [
			/\/products?\//i,
			/\/product[-_]images?\//i,
			/\/item[-_]images?\//i,
			/cdn\.shopify\.com\/s\/files.*\/products\//i,
		];
		return patterns.some((p) => p.test(url));
	}

	private decodeHtmlEntities(text: string): string {
		return text
			.replace(/&ndash;/g, '–')
			.replace(/&mdash;/g, '—')
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/&nbsp;/g, ' ')
			.trim();
	}

	private validateHexColor(color: string | null | undefined, fallback: string): string {
		if (!color) return fallback;
		const hex = color.match(/^#?([0-9a-fA-F]{3,8})$/);
		if (hex) return color.startsWith('#') ? color : `#${color}`;
		return fallback;
	}

	private resolveUrl(path: string, baseUrl: string): string {
		try {
			return new URL(path, baseUrl).href;
		} catch {
			return path;
		}
	}
}
