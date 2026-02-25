import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

export interface ScrapedProduct {
	name: string;
	description: string;
	price_text: string;
	image_urls: string[];
	ingredients_features: string;
}

type Platform = 'shopify' | 'woocommerce' | 'generic';

interface FetchResult {
	html: string;
	headers: Headers;
	finalUrl: string;
}

@Injectable()
export class ProductScraperService {
	private readonly logger = new Logger('ProductScraperService');

	async scrape(url: string): Promise<ScrapedProduct> {
		console.log('ProductScraperService: scrape');

		const normalizedUrl = this.normalizeUrl(url);
		const fetched = await this.fetchPage(normalizedUrl);
		const platform = this.detectPlatform(fetched);

		this.logger.log(`Detected platform: ${platform} for ${normalizedUrl}`);

		switch (platform) {
			case 'shopify':
				return this.scrapeShopify(fetched);
			case 'woocommerce':
				return this.scrapeWooCommerce(fetched);
			default:
				return this.scrapeGeneric(fetched);
		}
	}

	private normalizeUrl(url: string): string {
		let normalized = url.trim();
		if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
			normalized = `https://${normalized}`;
		}
		return normalized;
	}

	private async fetchPage(url: string): Promise<FetchResult> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 15000);

		const response = await fetch(url, {
			signal: controller.signal,
			headers: {
				'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			},
			redirect: 'follow',
		});
		clearTimeout(timeout);

		if (!response.ok) {
			throw new Error(`Website returned ${response.status}`);
		}

		const html = await response.text();
		return { html, headers: response.headers, finalUrl: response.url || url };
	}

	private detectPlatform(fetched: FetchResult): Platform {
		const { html, headers } = fetched;

		if (
			headers.get('x-shopify-stage') ||
			headers.get('x-sorting-hat-shopid') ||
			html.includes('Shopify.theme') ||
			html.includes('cdn.shopify.com')
		) {
			return 'shopify';
		}

		if (
			html.includes('woocommerce') ||
			html.includes('wc-product') ||
			html.includes('wp-content/plugins/woocommerce')
		) {
			return 'woocommerce';
		}

		return 'generic';
	}

	// ── Shopify ──────────────────────────────────────────

	private async scrapeShopify(fetched: FetchResult): Promise<ScrapedProduct> {
		const { html, finalUrl } = fetched;
		const $ = cheerio.load(html);

		const images = await this.tryShopifyJsonApi(finalUrl);

		const meta = this.extractMeta($, finalUrl);

		if (images.length === 0) {
			const htmlImages = this.extractShopifyHtmlImages($, finalUrl);
			images.push(...htmlImages);
		}

		if (images.length === 0 && meta.ogImage) {
			images.push(meta.ogImage);
		}

		return {
			name: meta.name,
			description: meta.description,
			price_text: meta.price,
			image_urls: this.deduplicateUrls(images),
			ingredients_features: '',
		};
	}

	private async tryShopifyJsonApi(pageUrl: string): Promise<string[]> {
		try {
			const url = new URL(pageUrl);
			const pathParts = url.pathname.split('/').filter(Boolean);

			const productsIdx = pathParts.indexOf('products');
			if (productsIdx === -1 || productsIdx >= pathParts.length - 1) return [];

			const handle = pathParts[productsIdx + 1].split('?')[0];
			const jsonUrl = `${url.origin}/products/${handle}.json`;

			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 8000);

			const response = await fetch(jsonUrl, {
				signal: controller.signal,
				headers: { 'Accept': 'application/json' },
			});
			clearTimeout(timeout);

			if (!response.ok) return [];

			const data = await response.json();
			const product = data?.product;
			if (!product?.images?.length) return [];

			return product.images
				.map((img: { src?: string }) => img.src)
				.filter(Boolean)
				.map((src: string) => src.replace(/\?v=\d+/, ''));
		} catch {
			return [];
		}
	}

	private extractShopifyHtmlImages($: cheerio.CheerioAPI, baseUrl: string): string[] {
		const images: string[] = [];

		$('[data-product-media-type="image"] img, .product__media img, .product-single__photo img').each((_, el) => {
			const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-srcset')?.split(',')[0]?.trim().split(' ')[0];
			if (src) images.push(this.resolveUrl(src, baseUrl));
		});

		if (images.length === 0) {
			$('.product-gallery img, .product-images img, .product__photos img, #product-photos img').each((_, el) => {
				const src = $(el).attr('src') || $(el).attr('data-src');
				if (src) images.push(this.resolveUrl(src, baseUrl));
			});
		}

		return images;
	}

	// ── WooCommerce ──────────────────────────────────────

	private scrapeWooCommerce(fetched: FetchResult): ScrapedProduct {
		const { html, finalUrl } = fetched;
		const $ = cheerio.load(html);

		const meta = this.extractMeta($, finalUrl);
		const images: string[] = [];

		$('.woocommerce-product-gallery__image img, .woocommerce-product-gallery img').each((_, el) => {
			const src = $(el).attr('data-large_image') || $(el).attr('data-src') || $(el).attr('src');
			if (src && !src.includes('placeholder')) {
				images.push(this.resolveUrl(src, finalUrl));
			}
		});

		if (images.length === 0) {
			$('.wp-post-image, .attachment-shop_single, .product-image img').each((_, el) => {
				const src = $(el).attr('src') || $(el).attr('data-src');
				if (src && !src.includes('placeholder')) {
					images.push(this.resolveUrl(src, finalUrl));
				}
			});
		}

		if (images.length === 0 && meta.ogImage) {
			images.push(meta.ogImage);
		}

		return {
			name: meta.name,
			description: meta.description,
			price_text: meta.price,
			image_urls: this.deduplicateUrls(images),
			ingredients_features: '',
		};
	}

	// ── Generic ──────────────────────────────────────────

	private scrapeGeneric(fetched: FetchResult): ScrapedProduct {
		const { html, finalUrl } = fetched;
		const $ = cheerio.load(html);

		const meta = this.extractMeta($, finalUrl);
		const images: string[] = [];

		const jsonLdImages = this.extractJsonLdImages($, finalUrl);
		images.push(...jsonLdImages);

		if (meta.ogImage) {
			images.push(meta.ogImage);
		}

		const twitterImage = $('meta[name="twitter:image"]').attr('content')
			|| $('meta[name="twitter:image:src"]').attr('content');
		if (twitterImage) {
			images.push(this.resolveUrl(twitterImage, finalUrl));
		}

		$('meta[property="og:image"]').each((_, el) => {
			const content = $(el).attr('content');
			if (content) images.push(this.resolveUrl(content, finalUrl));
		});

		$('[data-gallery] img, .product-gallery img, .product-images img, .pdp-image img, .gallery-image img').each((_, el) => {
			const src = $(el).attr('data-src') || $(el).attr('data-zoom-image') || $(el).attr('src');
			if (src && this.isProductImage(src)) {
				images.push(this.resolveUrl(src, finalUrl));
			}
		});

		if (images.length === 0) {
			$('img[src]').each((_, el) => {
				const src = $(el).attr('src')!;
				const alt = ($(el).attr('alt') || '').toLowerCase();
				const width = parseInt($(el).attr('width') || '0', 10);
				const height = parseInt($(el).attr('height') || '0', 10);

				if (
					this.isProductImage(src) &&
					(width >= 200 || height >= 200 || (!width && !height)) &&
					!alt.includes('logo') &&
					!alt.includes('icon') &&
					!alt.includes('banner') &&
					!src.includes('logo') &&
					!src.includes('icon') &&
					!src.includes('sprite')
				) {
					images.push(this.resolveUrl(src, finalUrl));
				}
			});
		}

		return {
			name: meta.name,
			description: meta.description,
			price_text: meta.price,
			image_urls: this.deduplicateUrls(images).slice(0, 10),
			ingredients_features: '',
		};
	}

	// ── JSON-LD ──────────────────────────────────────────

	private extractJsonLdImages($: cheerio.CheerioAPI, baseUrl: string): string[] {
		const images: string[] = [];

		$('script[type="application/ld+json"]').each((_, el) => {
			try {
				const json = JSON.parse($(el).html() || '');
				const items = Array.isArray(json) ? json : [json];

				for (const item of items) {
					if (item['@type'] !== 'Product') continue;

					const imgField = item.image;
					if (typeof imgField === 'string') {
						images.push(this.resolveUrl(imgField, baseUrl));
					} else if (Array.isArray(imgField)) {
						for (const img of imgField) {
							const src = typeof img === 'string' ? img : img?.url || img?.contentUrl;
							if (src) images.push(this.resolveUrl(src, baseUrl));
						}
					}
				}
			} catch { }
		});

		return images;
	}

	// ── Meta Extraction ──────────────────────────────────

	private extractMeta($: cheerio.CheerioAPI, baseUrl: string) {
		const baseUrlObj = new URL(baseUrl);

		const ogTitle = $('meta[property="og:title"]').attr('content');
		const pageTitle = $('title').text();
		let name = ogTitle || pageTitle || baseUrlObj.pathname.split('/').pop() || 'Imported Product';
		name = name.split(/\s*[|\-–—]\s*/)[0].trim().replace(/_/g, ' ');
		if (name.length > 100) name = name.substring(0, 100);

		const ogDesc = $('meta[property="og:description"]').attr('content');
		const metaDesc = $('meta[name="description"]').attr('content');
		let description = ogDesc || metaDesc || '';
		description = description.trim().substring(0, 500);

		let ogImage = '';
		const ogImageContent = $('meta[property="og:image"]').first().attr('content');
		if (ogImageContent) {
			ogImage = this.resolveUrl(ogImageContent, baseUrl);
		}

		let price = '';
		const priceAmount = $('meta[property="product:price:amount"]').attr('content');
		const priceCurrency = $('meta[property="product:price:currency"]').attr('content');
		if (priceAmount) {
			const curr = priceCurrency || '$';
			price = curr === 'USD' ? `$${priceAmount}` : `${priceAmount} ${curr}`;
		}

		return { name, description, ogImage, price };
	}

	// ── Helpers ──────────────────────────────────────────

	private resolveUrl(src: string, baseUrl: string): string {
		if (src.startsWith('//')) return `https:${src}`;
		if (src.startsWith('http')) return src;
		try {
			return new URL(src, baseUrl).href;
		} catch {
			return src;
		}
	}

	private isProductImage(src: string): boolean {
		const lower = src.toLowerCase();
		if (lower.includes('.svg') || lower.includes('data:image')) return false;
		if (lower.includes('tracking') || lower.includes('pixel') || lower.includes('spacer')) return false;
		if (lower.includes('1x1') || lower.includes('blank')) return false;
		return true;
	}

	private deduplicateUrls(urls: string[]): string[] {
		const seen = new Set<string>();
		const result: string[] = [];

		for (const url of urls) {
			const normalized = url.replace(/\?.*$/, '').replace(/\/+$/, '');
			if (!seen.has(normalized)) {
				seen.add(normalized);
				result.push(url);
			}
		}

		return result;
	}
}
