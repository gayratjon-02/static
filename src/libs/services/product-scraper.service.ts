import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

export interface ScrapedProduct {
	name: string;
	description: string;
	price_text: string;
	image_urls: string[];
	usps: string[];
	star_rating: number | null;
	review_count: number | null;
	offer_text: string;
	ingredients_features: string;
}

interface JsonLdProduct {
	images: string[];
	description: string;
	starRating: number | null;
	reviewCount: number | null;
	offerText: string;
}

interface ShopifyApiData {
	images: string[];
	description: string;
	usps: string[];
	priceText: string;
	offerText: string;
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

		const meta = this.extractMeta($, finalUrl);
		const jsonLd = this.extractJsonLd($, finalUrl);
		const shopifyApi = await this.tryShopifyJsonApi(finalUrl);
		const details = this.extractProductDetails($);

		const images: string[] = [];
		if (shopifyApi?.images.length) {
			images.push(...shopifyApi.images);
		} else {
			const htmlImages = this.extractShopifyHtmlImages($, finalUrl);
			images.push(...htmlImages);
		}
		if (jsonLd.images.length) images.push(...jsonLd.images);
		if (images.length === 0 && meta.ogImage) images.push(meta.ogImage);

		const description = shopifyApi?.description || meta.description || jsonLd.description;
		const usps = shopifyApi?.usps.length ? shopifyApi.usps : details.usps;
		const priceText = shopifyApi?.priceText || meta.price;
		const offerText = shopifyApi?.offerText || jsonLd.offerText;

		return {
			name: meta.name,
			description,
			price_text: priceText,
			image_urls: this.deduplicateUrls(images),
			usps,
			star_rating: jsonLd.starRating,
			review_count: jsonLd.reviewCount,
			offer_text: offerText,
			ingredients_features: details.ingredients,
		};
	}

	private async tryShopifyJsonApi(pageUrl: string): Promise<ShopifyApiData | null> {
		try {
			const url = new URL(pageUrl);
			const pathParts = url.pathname.split('/').filter(Boolean);

			const productsIdx = pathParts.indexOf('products');
			if (productsIdx === -1 || productsIdx >= pathParts.length - 1) return null;

			const handle = pathParts[productsIdx + 1].split('?')[0];
			const jsonUrl = `${url.origin}/products/${handle}.json`;

			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 8000);

			const response = await fetch(jsonUrl, {
				signal: controller.signal,
				headers: { 'Accept': 'application/json' },
			});
			clearTimeout(timeout);

			if (!response.ok) return null;

			const data = await response.json();
			const product = data?.product;
			if (!product) return null;

			const images = (product.images ?? [])
				.map((img: { src?: string }) => img.src)
				.filter(Boolean)
				.map((src: string) => src.replace(/\?v=\d+/, ''));

			const bodyHtml = product.body_html ?? '';
			const description = this.stripHtml(bodyHtml).substring(0, 500);

			const usps: string[] = [];
			if (bodyHtml) {
				const $body = cheerio.load(bodyHtml);

				$body('li').each((_, el) => {
					if (usps.length >= 5) return;
					const text = $body(el).text().replace(/\s+/g, ' ').trim();
					if (text.length >= 10 && text.length <= 150) {
						usps.push(text);
					}
				});

				if (usps.length === 0) {
					$body('strong, b').each((_, el) => {
						if (usps.length >= 5) return;
						const text = $body(el).text().replace(/\s+/g, ' ').trim();
						if (text.length >= 8 && text.length <= 100 && !text.includes(':')) {
							usps.push(text);
						}
					});
				}

				if (usps.length === 0) {
					usps.push(...this.extractUspsFromText(description));
				}
			}

			let priceText = '';
			let offerText = '';
			const variant = product.variants?.[0];
			if (variant) {
				const price = variant.price;
				const compareAt = variant.compare_at_price;
				if (price) priceText = `$${price}`;
				if (compareAt && parseFloat(compareAt) > parseFloat(price)) {
					const discount = Math.round(((parseFloat(compareAt) - parseFloat(price)) / parseFloat(compareAt)) * 100);
					offerText = `Save ${discount}% (was $${compareAt})`;
				}
			}

			return { images, description, usps, priceText, offerText };
		} catch {
			return null;
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
		const jsonLd = this.extractJsonLd($, finalUrl);
		const details = this.extractProductDetails($);
		const images: string[] = [];

		$('.woocommerce-product-gallery__image img, .woocommerce-product-gallery img').each((_, el) => {
			const src = $(el).attr('data-large_image') ?? $(el).attr('data-src') ?? $(el).attr('src');
			if (src && !src.includes('placeholder')) {
				images.push(this.resolveUrl(src, finalUrl));
			}
		});

		if (images.length === 0) {
			$('.wp-post-image, .attachment-shop_single, .product-image img').each((_, el) => {
				const src = $(el).attr('src') ?? $(el).attr('data-src');
				if (src && !src.includes('placeholder')) {
					images.push(this.resolveUrl(src, finalUrl));
				}
			});
		}

		if (jsonLd.images.length) images.push(...jsonLd.images);
		if (images.length === 0 && meta.ogImage) images.push(meta.ogImage);

		let offerText = jsonLd.offerText;
		if (!offerText) {
			const saleEl = $('.onsale, [class*="sale-badge"], [class*="discount"]').first();
			if (saleEl.length) {
				offerText = saleEl.text().replace(/\s+/g, ' ').trim().substring(0, 100);
			}
		}

		return {
			name: meta.name,
			description: meta.description || jsonLd.description,
			price_text: meta.price,
			image_urls: this.deduplicateUrls(images),
			usps: details.usps,
			star_rating: jsonLd.starRating,
			review_count: jsonLd.reviewCount,
			offer_text: offerText,
			ingredients_features: details.ingredients,
		};
	}

	// ── Generic ──────────────────────────────────────────

	private scrapeGeneric(fetched: FetchResult): ScrapedProduct {
		const { html, finalUrl } = fetched;
		const $ = cheerio.load(html);

		const meta = this.extractMeta($, finalUrl);
		const jsonLd = this.extractJsonLd($, finalUrl);
		const details = this.extractProductDetails($);
		const images: string[] = [];

		images.push(...jsonLd.images);

		if (meta.ogImage) {
			images.push(meta.ogImage);
		}

		const twitterImage = $('meta[name="twitter:image"]').attr('content')
			?? $('meta[name="twitter:image:src"]').attr('content');
		if (twitterImage) {
			images.push(this.resolveUrl(twitterImage, finalUrl));
		}

		$('meta[property="og:image"]').each((_, el) => {
			const content = $(el).attr('content');
			if (content) images.push(this.resolveUrl(content, finalUrl));
		});

		$('[data-gallery] img, .product-gallery img, .product-images img, .pdp-image img, .gallery-image img').each((_, el) => {
			const src = $(el).attr('data-src') ?? $(el).attr('data-zoom-image') ?? $(el).attr('src');
			if (src && this.isProductImage(src)) {
				images.push(this.resolveUrl(src, finalUrl));
			}
		});

		if (images.length === 0) {
			$('img[src]').each((_, el) => {
				const src = $(el).attr('src')!;
				const alt = ($(el).attr('alt') ?? '').toLowerCase();
				const width = parseInt($(el).attr('width') ?? '0', 10);
				const height = parseInt($(el).attr('height') ?? '0', 10);

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

		let offerText = jsonLd.offerText;
		if (!offerText) {
			const saleEl = $('[class*="sale"], [class*="discount"], [class*="offer"], [class*="save"]').first();
			if (saleEl.length) {
				offerText = saleEl.text().replace(/\s+/g, ' ').trim().substring(0, 100);
			}
		}

		return {
			name: meta.name,
			description: meta.description || jsonLd.description,
			price_text: meta.price,
			image_urls: this.deduplicateUrls(images).slice(0, 10),
			usps: details.usps,
			star_rating: jsonLd.starRating,
			review_count: jsonLd.reviewCount,
			offer_text: offerText,
			ingredients_features: details.ingredients,
		};
	}

	// ── JSON-LD ──────────────────────────────────────────

	private extractJsonLd($: cheerio.CheerioAPI, baseUrl: string): JsonLdProduct {
		const result: JsonLdProduct = {
			images: [],
			description: '',
			starRating: null,
			reviewCount: null,
			offerText: '',
		};

		$('script[type="application/ld+json"]').each((_, el) => {
			try {
				const json = JSON.parse($(el).html() ?? '');
				const items = Array.isArray(json) ? json : [json];

				for (const item of items) {
					if (item['@type'] !== 'Product') continue;

					const imgField = item.image;
					if (typeof imgField === 'string') {
						result.images.push(this.resolveUrl(imgField, baseUrl));
					} else if (Array.isArray(imgField)) {
						for (const img of imgField) {
							const src = typeof img === 'string' ? img : img?.url ?? img?.contentUrl;
							if (src) result.images.push(this.resolveUrl(src, baseUrl));
						}
					}

					if (item.description && !result.description) {
						result.description = this.stripHtml(String(item.description)).substring(0, 500);
					}

					const rating = item.aggregateRating;
					if (rating) {
						const ratingValue = parseFloat(rating.ratingValue);
						if (!isNaN(ratingValue) && ratingValue >= 1 && ratingValue <= 5) {
							result.starRating = Math.round(ratingValue * 10) / 10;
						}
						const reviewCount = parseInt(rating.reviewCount ?? rating.ratingCount, 10);
						if (!isNaN(reviewCount) && reviewCount > 0) {
							result.reviewCount = reviewCount;
						}
					}

					const offers = item.offers;
					if (offers) {
						const offerList = Array.isArray(offers) ? offers : [offers];
						for (const offer of offerList) {
							const price = parseFloat(offer.price);
							const highPrice = parseFloat(offer.highPrice);
							if (!isNaN(price) && !isNaN(highPrice) && highPrice > price) {
								const discount = Math.round(((highPrice - price) / highPrice) * 100);
								result.offerText = `Save ${discount}%`;
								break;
							}
						}
					}
				}
			} catch { /* malformed JSON-LD */ }
		});

		return result;
	}

	// ── Product Details ─────────────────────────────────

	private extractProductDetails($: cheerio.CheerioAPI): { usps: string[]; ingredients: string } {
		const usps: string[] = [];

		const liSelectors = [
			'.product-description ul li',
			'.product__description ul li',
			'.product-single__description ul li',
			'.woocommerce-product-details__short-description ul li',
			'[class*="product-detail"] ul li',
			'[class*="feature"] li',
			'[class*="benefit"] li',
			'[class*="highlight"] li',
			'[class*="selling-point"] li',
			'[class*="usp"] li',
		];

		for (const selector of liSelectors) {
			if (usps.length >= 5) break;
			$(selector).each((_, el) => {
				if (usps.length >= 5) return;
				const text = $(el).text().replace(/\s+/g, ' ').trim();
				if (text.length >= 10 && text.length <= 150) {
					usps.push(text);
				}
			});
		}

		if (usps.length === 0) {
			const strongSelectors = [
				'.product-description strong',
				'.product__description strong',
				'.product-single__description strong',
				'[class*="product-detail"] strong',
				'.product-description b',
				'.product__description b',
			];

			for (const selector of strongSelectors) {
				if (usps.length >= 5) break;
				$(selector).each((_, el) => {
					if (usps.length >= 5) return;
					const text = $(el).text().replace(/\s+/g, ' ').trim();
					if (text.length >= 8 && text.length <= 100 && !text.includes(':')) {
						usps.push(text);
					}
				});
			}
		}

		if (usps.length === 0) {
			const descSelectors = [
				'.product-description',
				'.product__description',
				'.product-single__description',
				'[class*="product-detail"]',
				'[itemprop="description"]',
			];

			for (const selector of descSelectors) {
				if (usps.length >= 5) break;
				const el = $(selector).first();
				if (el.length) {
					const text = el.text();
					usps.push(...this.extractUspsFromText(text));
					break;
				}
			}
		}

		let ingredients = '';
		const ingredientSelectors = [
			'[id*="ingredient"]',
			'[class*="ingredient"]',
			'[id*="specification"]',
			'[class*="specification"]',
			'.woocommerce-Tabs-panel--additional_information',
			'[class*="nutrition"]',
		];

		for (const selector of ingredientSelectors) {
			if (ingredients) break;
			const el = $(selector).first();
			if (el.length) {
				ingredients = el.text().replace(/\s+/g, ' ').trim().substring(0, 500);
			}
		}

		return { usps, ingredients };
	}

	private extractUspsFromText(text: string): string[] {
		const usps: string[] = [];

		const lines = text.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);
		for (const line of lines) {
			if (usps.length >= 5) break;
			const cleaned = line.replace(/^[✔✓•★✦▸►▪■□●○◆◇→\-–—]\s*/, '').trim();
			if (cleaned !== line.trim() && cleaned.length >= 10 && cleaned.length <= 150) {
				usps.push(cleaned);
			}
		}

		if (usps.length === 0) {
			const bulletPattern = /[✔✓•★✦▸►]\s*([^✔✓•★✦▸►\n]{10,150})/g;
			let match;
			while ((match = bulletPattern.exec(text)) !== null && usps.length < 5) {
				usps.push(match[1].trim());
			}
		}

		return usps;
	}

	// ── Meta Extraction ──────────────────────────────────

	private extractMeta($: cheerio.CheerioAPI, baseUrl: string) {
		const baseUrlObj = new URL(baseUrl);

		const ogTitle = $('meta[property="og:title"]').attr('content');
		const pageTitle = $('title').text();
		let name = ogTitle ?? pageTitle ?? baseUrlObj.pathname.split('/').pop() ?? 'Imported Product';
		name = name.split(/\s*[|\-–—]\s*/)[0].trim().replace(/_/g, ' ');
		if (name.length > 100) name = name.substring(0, 100);

		const ogDesc = $('meta[property="og:description"]').attr('content');
		const metaDesc = $('meta[name="description"]').attr('content');
		let description = ogDesc ?? metaDesc ?? '';

		const fullDescSelectors = [
			'.product-description',
			'.product__description',
			'.product-single__description',
			'[id*="product-description"]',
			'[class*="pdp-description"]',
			'.woocommerce-product-details__short-description',
			'[itemprop="description"]',
		];

		for (const selector of fullDescSelectors) {
			const el = $(selector).first();
			if (el.length) {
				const fullDesc = el.text().replace(/\s+/g, ' ').trim();
				if (fullDesc.length > description.length) {
					description = fullDesc;
				}
				break;
			}
		}

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
			const curr = priceCurrency ?? '$';
			price = curr === 'USD' ? `$${priceAmount}` : `${priceAmount} ${curr}`;
		}

		if (!price) {
			const priceEl = $('[class*="price"] .money, [class*="price"] ins, .product-price, [itemprop="price"]').first();
			if (priceEl.length) {
				const priceText = priceEl.text().replace(/\s+/g, ' ').trim();
				if (priceText && priceText.length <= 30) price = priceText;
			}
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

	private stripHtml(html: string): string {
		return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
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
