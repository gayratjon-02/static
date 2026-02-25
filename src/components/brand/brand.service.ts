import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
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
	voice_tags: BrandVoice[];
	target_audience: string;
	competitors: string;
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

	getConfig() {
		console.log('BrandService: config');
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

	async createBrand(input: CreateBrandDto, authMember: Member): Promise<Brand> {
		console.log('BrandService: createBrand');
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

	async getBrands(authMember: Member, page: number, limit: number) {
		console.log('BrandService: getBrands');
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

	async getBrand(id: string, authMember: Member): Promise<Brand> {
		console.log('BrandService: getBrandById');
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

	async updateBrand(id: string, input: UpdateBrandDto, authMember: Member): Promise<Brand> {
		console.log('BrandService: updateBrandById');
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

	async deleteBrand(id: string, authMember: Member): Promise<{ message: string }> {
		console.log('BrandService: deleteBrandById');
		try {
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
	async importFromUrl(url: string): Promise<BrandImportResult> {
		console.log('BrandService: importFromUrl');

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
					'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
					'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
				},
			});
			clearTimeout(timeout);

			if (!response.ok) {
				throw new BadRequestException(`Website returned ${response.status}`);
			}

			const fullHtml = await response.text();
			const $ = cheerio.load(fullHtml);

			// --- Meta tags ---
			const metaTags: Record<string, string> = {};
			$('meta[property], meta[name]').each((_, el) => {
				const key = $(el).attr('property') ?? $(el).attr('name');
				const value = $(el).attr('content');
				if (key && value) metaTags[key] = value;
			});

			const title = $('title').text().trim();
			if (title) metaTags['title'] = title;

			// --- Logo candidates (6 strategies) ---
			const logoUrls: string[] = [];

			$('link[rel*="icon"]').each((_, el) => {
				const href = $(el).attr('href');
				if (href) logoUrls.push(this.resolveUrl(href, url));
			});

			$('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]').each((_, el) => {
				const href = $(el).attr('href');
				if (href) logoUrls.push(this.resolveUrl(href, url));
			});

			$('header img, nav img, [class*="header"] img, [class*="logo"] img, [id*="header"] img, [id*="logo"] img').each((_, el) => {
				const src = $(el).attr('src') ?? $(el).attr('data-src');
				if (src) logoUrls.push(this.resolveUrl(src, url));
			});

			$('a[class*="logo"] img, a[id*="logo"] img').each((_, el) => {
				const src = $(el).attr('src') ?? $(el).attr('data-src');
				if (src) logoUrls.push(this.resolveUrl(src, url));
			});

			const ogImage = metaTags['og:image'];
			if (ogImage) logoUrls.push(this.resolveUrl(ogImage, url));

			metaTags['_logo_candidates'] = JSON.stringify([...new Set(logoUrls)]);

			// --- CSS colors ---
			const cssColors: string[] = [];

			const themeColor = $('meta[name="theme-color"]').attr('content');
			if (themeColor) cssColors.push(`theme-color: ${themeColor}`);

			let styleContent = '';
			$('style').each((_, el) => {
				styleContent += $(el).html() + '\n';
			});

			const hexMatches = styleContent.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
			cssColors.push(...hexMatches);

			const varMatches = styleContent.match(/--[\w-]*color[\w-]*:\s*[^;]+/gi) ?? [];
			cssColors.push(...varMatches);

			$('header, nav, [class*="hero"], [class*="banner"], [class*="btn-primary"], button.cta, [class*="cta"]').each((_, el) => {
				const style = $(el).attr('style');
				if (style) {
					const bgMatch = style.match(/background(?:-color)?:\s*(#[0-9a-fA-F]{3,8})/i);
					if (bgMatch) cssColors.push(`element-bg: ${bgMatch[1]}`);
					const colorMatch = style.match(/(?:^|;\s*)color:\s*(#[0-9a-fA-F]{3,8})/i);
					if (colorMatch) cssColors.push(`element-color: ${colorMatch[1]}`);
				}
			});

			const externalCssColors = await this.fetchExternalCssColors($, url);
			cssColors.push(...externalCssColors);

			const essentialHtml = this.extractEssentialHtml($);

			return { html: essentialHtml, metaTags, cssColors };
		} catch (err) {
			if (err instanceof BadRequestException) throw err;
			const message = err instanceof Error ? err.message : String(err);
			this.logger.error(`Failed to scrape ${url}: ${message}`);
			throw new BadRequestException(`Could not access website: ${url}. Please check the URL and try again.`);
		}
	}

	private async fetchExternalCssColors($: cheerio.CheerioAPI, baseUrl: string): Promise<string[]> {
		const colors: string[] = [];
		const cssUrls: string[] = [];

		$('link[rel="stylesheet"]').each((_, el) => {
			const href = $(el).attr('href');
			if (href && cssUrls.length < 3) {
				cssUrls.push(this.resolveUrl(href, baseUrl));
			}
		});

		if (cssUrls.length === 0) return colors;

		const cssTexts = await Promise.all(
			cssUrls.map(async (cssUrl) => {
				try {
					const controller = new AbortController();
					const timeout = setTimeout(() => controller.abort(), 5000);
					const response = await fetch(cssUrl, {
						signal: controller.signal,
						headers: { 'Accept': 'text/css' },
					});
					clearTimeout(timeout);
					if (!response.ok) return '';
					const text = await response.text();
					return text.substring(0, 50000);
				} catch {
					return '';
				}
			}),
		);

		const combinedCss = cssTexts.join('\n');

		const varMatches = combinedCss.match(/--[\w-]*(?:color|brand|primary|secondary|accent|bg)[\w-]*:\s*[^;]+/gi) ?? [];
		colors.push(...varMatches.slice(0, 30));

		const rootBgMatch = combinedCss.match(/(?::root|body)\s*\{[^}]*background(?:-color)?:\s*(#[0-9a-fA-F]{3,8})/i);
		if (rootBgMatch) colors.push(`body-bg: ${rootBgMatch[1]}`);

		return colors;
	}

	private extractEssentialHtml($: cheerio.CheerioAPI): string {
		const parts: string[] = [];

		const header = $('header').first();
		if (header.length) {
			parts.push(`<header>${header.html()?.substring(0, 1500) ?? ''}</header>`);
		}

		const navLinks: string[] = [];
		$('nav a, header a').each((_, el) => {
			const text = $(el).text().trim();
			const href = $(el).attr('href') ?? '';
			if (text && text.length < 50 && !href.startsWith('#')) {
				navLinks.push(text);
			}
		});
		if (navLinks.length > 0) {
			parts.push(`<nav_links>${[...new Set(navLinks)].slice(0, 20).join(', ')}</nav_links>`);
		}

		const hero = $('[class*="hero"], [class*="banner"], [class*="jumbotron"], [id*="hero"]').first();
		if (hero.length) {
			const heroText = hero.text().replace(/\s+/g, ' ').trim().substring(0, 1000);
			if (heroText) parts.push(`<hero_text>${heroText}</hero_text>`);
		}

		const about = $('[class*="about"], [id*="about"], [class*="mission"], [id*="mission"]').first();
		if (about.length) {
			const aboutText = about.text().replace(/\s+/g, ' ').trim().substring(0, 500);
			if (aboutText) parts.push(`<about_text>${aboutText}</about_text>`);
		}

		const testimonials = $('[class*="testimonial"], [class*="review"], [class*="quote"], [id*="testimonial"]').first();
		if (testimonials.length) {
			const testText = testimonials.text().replace(/\s+/g, ' ').trim().substring(0, 500);
			if (testText) parts.push(`<testimonials_text>${testText}</testimonials_text>`);
		}

		const features = $('[class*="feature"], [class*="benefit"], [class*="service"], [id*="features"]').first();
		if (features.length) {
			const featText = features.text().replace(/\s+/g, ' ').trim().substring(0, 500);
			if (featText) parts.push(`<features_text>${featText}</features_text>`);
		}

		$('script[type="application/ld+json"]').each((_, el) => {
			try {
				const json = JSON.parse($(el).html() ?? '');
				const items = Array.isArray(json) ? json : [json];
				for (const item of items) {
					if (['Organization', 'LocalBusiness', 'Brand'].includes(item['@type'])) {
						parts.push(`<structured_data>${JSON.stringify(item).substring(0, 1000)}</structured_data>`);
					}
				}
			} catch { /* malformed JSON-LD */ }
		});

		const footer = $('footer').first();
		if (footer.length) {
			const footerText = footer.text().replace(/\s+/g, ' ').trim().substring(0, 500);
			if (footerText) parts.push(`<footer_text>${footerText}</footer_text>`);
		}

		const socialLinks: string[] = [];
		$('a[href*="facebook.com"], a[href*="instagram.com"], a[href*="twitter.com"], a[href*="x.com"], a[href*="linkedin.com"], a[href*="tiktok.com"], a[href*="youtube.com"]').each((_, el) => {
			const href = $(el).attr('href');
			if (href) socialLinks.push(href);
		});
		if (socialLinks.length > 0) {
			parts.push(`<social_links>${[...new Set(socialLinks)].join(', ')}</social_links>`);
		}

		if (parts.length === 0) {
			return $('body').text().replace(/\s+/g, ' ').trim().substring(0, 3000);
		}

		return parts.join('\n');
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
  "primary_color": "string — hex code (#XXXXXX) of the dominant brand color (header, buttons, CTAs)",
  "secondary_color": "string — hex code (#XXXXXX) of the secondary brand color",
  "accent_color": "string | null — hex code (#XXXXXX) of accent color if clearly present",
  "background_color": "string — hex code (#XXXXXX) of the page background color. Check body/root CSS background-color. Default #FFFFFF only if nothing found",
  "voice_tags": ["array of 1-5 strings from EXACTLY this list: professional, playful, bold, minimalist, luxurious, friendly, edgy, trustworthy, youthful, authoritative"],
  "target_audience": "string — 1-2 sentences describing who this brand serves. Infer from hero text, about section, testimonials, product categories, and overall messaging. Max 300 chars",
  "competitors": "string — comma-separated list of likely competitor brand names if detectable from website content or industry context. Empty string if unknown",
  "confidence_score": "number 0-1 — how confident you are in the extraction",
  "warnings": ["array of strings — any issues found"]
}

VOICE TAG GUIDELINES — analyze the website copy tone, word choice, and design aesthetic:
- "professional" — formal language, corporate tone, business-focused
- "playful" — fun, casual, uses humor or wordplay
- "bold" — strong statements, commanding, provocative headlines
- "minimalist" — clean, simple, few words, whitespace-heavy design
- "luxurious" — premium language, exclusivity, high-end feel
- "friendly" — warm, conversational, approachable
- "edgy" — unconventional, rebellious, counterculture
- "trustworthy" — data-driven, testimonials, guarantees, certifications emphasized
- "youthful" — trendy, energetic, targets younger demographics
- "authoritative" — expert-driven, educational, thought leadership

TARGET AUDIENCE GUIDELINES:
- Combine clues from: hero messaging, product categories (from nav_links), testimonials, about section, and pricing tier
- Format example: "Health-conscious women aged 25-45 who prefer clean beauty products"
- Be specific about demographics, interests, and needs when possible

HANDLING EDGE CASES:
- If the HTML contains an og:site_name meta tag, prefer that for brand_name
- If the HTML title is "Product Name | Brand Name" or "Product Name - Brand Name", extract only the Brand Name part
- Look for the company name in: og:site_name, <title> suffix after | or -, footer copyright text, header logo alt text
- For colors, prioritize: theme-color meta tag, CSS custom properties (--primary-color, --brand-*), header/nav background, main CTA button colors
- For background_color: check body-bg CSS data, :root background, or page background. Only default to #FFFFFF if nothing found
- For voice_tags: ALWAYS return at least 1 tag, max 5. Analyze hero headlines, CTA text, about section tone, and design aesthetic
- For target_audience: ALWAYS provide a meaningful answer. Even if sparse, infer from industry + product categories
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
				max_tokens: 1500,
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

	private postProcessBrandImport(data: BrandImportResult, homepageUrl: string): BrandImportResult {
		const raw = data as unknown as Record<string, unknown>;

		data.website_url = homepageUrl;

		if (!Array.isArray(data.warnings)) data.warnings = [];

		data.name = this.decodeHtmlEntities(data.name ?? '');
		data.description = this.decodeHtmlEntities(data.description ?? '');

		if (raw.brand_name) {
			data.name = this.decodeHtmlEntities(String(raw.brand_name));
		}
		if (raw.brand_description) {
			data.description = this.decodeHtmlEntities(String(raw.brand_description));
		}

		data.primary_color = this.validateHexColor(data.primary_color, '#2c3e50');
		data.secondary_color = this.validateHexColor(data.secondary_color, '#3498db');
		data.accent_color = this.validateHexColor(data.accent_color, '') || '';
		data.background_color = this.validateHexColor(data.background_color, '#FFFFFF');

		if (data.logo_url && this.looksLikeProductImage(data.logo_url)) {
			data.warnings.push('Logo URL appears to be a product image. Please upload your logo manually.');
			data.logo_url = '';
		}

		const validVoices = Object.values(BrandVoice) as string[];
		if (Array.isArray(data.voice_tags)) {
			data.voice_tags = data.voice_tags
				.filter((tag) => validVoices.includes(tag))
				.slice(0, 5) as BrandVoice[];
		} else {
			data.voice_tags = [];
		}
		if (data.voice_tags.length === 0) {
			data.voice_tags = [BrandVoice.PROFESSIONAL];
			data.warnings.push('Could not determine brand voice. Defaulted to "professional".');
		}

		if (!data.target_audience || typeof data.target_audience !== 'string') {
			data.target_audience = '';
			data.warnings.push('Could not determine target audience. Please fill in manually.');
		} else {
			data.target_audience = this.decodeHtmlEntities(data.target_audience).substring(0, 300);
		}

		if (!data.competitors || typeof data.competitors !== 'string') {
			data.competitors = '';
		} else {
			data.competitors = this.decodeHtmlEntities(data.competitors).substring(0, 300);
		}

		if (typeof data.confidence_score !== 'number') data.confidence_score = 0.5;

		this.logger.log(`Brand import complete: "${data.name}" | industry: ${data.industry} | voice: ${data.voice_tags.join(',')} | confidence: ${data.confidence_score}`);
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
