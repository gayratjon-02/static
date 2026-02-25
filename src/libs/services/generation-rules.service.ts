import { Injectable } from '@nestjs/common';
import { Brand } from '../types/brand/brand.type';
import { Product } from '../types/product/product.type';

interface GenerationRules {
	ctaOptions: string[];
	bannedCtaList: string[];
	bannedClaimPatterns: string[];
	safeClaimPhrases: string[];
	guaranteePhrasing: string;
	reviewTopics: string[];
	avoidWords: string[];
	preferWords: string[];
	toneDescription: string;
}

@Injectable()
export class GenerationRulesService {

	buildRules(brand: Brand, product: Product): GenerationRules {
		const isEcommerce = this.isEcommerceProduct(product);
		const hasSocialProof = !!product.star_rating && !!product.review_count;

		return {
			ctaOptions: this.buildCtaOptions(isEcommerce),
			bannedCtaList: this.buildBannedCtas(isEcommerce),
			bannedClaimPatterns: this.buildBannedClaims(product),
			safeClaimPhrases: this.buildSafeClaims(product),
			guaranteePhrasing: this.buildGuaranteePhrasing(product),
			reviewTopics: this.buildReviewTopics(product),
			avoidWords: this.buildAvoidWords(product),
			preferWords: this.buildPreferWords(product),
			toneDescription: this.buildToneDescription(brand),
		};
	}

	buildRulesPromptSection(brand: Brand, product: Product): string {
		const rules = this.buildRules(brand, product);

		return `
═══ DYNAMIC GENERATION RULES (AUTO-GENERATED FROM PRODUCT DATA) ═══

CTA RULES:
- ALLOWED CTAs (use ONLY one of these): ${rules.ctaOptions.map(c => `"${c}"`).join(', ')}
- BANNED CTAs (NEVER use): ${rules.bannedCtaList.map(c => `"${c}"`).join(', ')}

CLAIM SAFETY:
- BANNED absolute claims (NEVER use phrases like): ${rules.bannedClaimPatterns.map(c => `"${c}"`).join(', ')}
- SAFE alternative phrases (use these instead): ${rules.safeClaimPhrases.map(c => `"${c}"`).join(', ')}
${rules.guaranteePhrasing ? `- GUARANTEE PHRASING: Only use "${rules.guaranteePhrasing}" — never rephrase or abbreviate.` : ''}

TONE: ${rules.toneDescription}

REVIEW TOPIC VARIETY (each review must cover a DIFFERENT topic from this list):
${rules.reviewTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')}

WORD CHOICE:
- AVOID (likely to be misspelled in image generation): ${rules.avoidWords.join(', ')}
- PREFER (short, common words that render well): ${rules.preferWords.join(', ')}

TEMPLATE ARTIFACT PREVENTION:
- NEVER include stray UI labels like "Home", "Menu", "Back", "Header", "Footer" in the ad.
- NEVER include placeholder text like "Lorem ipsum", "Sample text", "Enter text here".
- Every visible word in the ad must be intentional ad copy — no accidental template leftovers.
- If the concept reference image contains UI elements or stray labels, IGNORE them completely.

VISUAL SAFETY RULES:
- Keep ALL text, logo, CTA, and badges inside a 10% margin from all edges (safe zone).
- Text readability: minimum font weight medium/bold, high contrast against background.
- No white/light text on light backgrounds. No dark text on dark backgrounds.
- No smoke, steam, or effects overlapping headline text.
- Product image must occupy 40-60% of the composition area.
═══════════════════════════════════════════════════════════════════
`;
	}

	buildValidationChecklist(brand: Brand, product: Product): string[] {
		const rules = this.buildRules(brand, product);
		const checks: string[] = [];

		checks.push(`CTA must be one of: ${rules.ctaOptions.join(', ')}`);
		checks.push(`No banned CTAs: ${rules.bannedCtaList.join(', ')}`);
		checks.push('No hex codes (#XXXXXX) in gemini_image_prompt');
		checks.push('No pixel dimensions (XXpx, XXpt) in gemini_image_prompt');
		checks.push('Headline max 6 words');
		checks.push('Callout texts max 4 words each');
		checks.push('CTA max 3 words');
		checks.push('All callout texts are unique (no duplicates)');
		checks.push(`No banned claim patterns: ${rules.bannedClaimPatterns.join(', ')}`);
		checks.push('All text inside 10% safe zone');
		checks.push('Product described as "provided product photo" not generated');
		checks.push('Logo described as "provided brand logo" not generated');
		checks.push('Colors described by name, never hex codes');
		checks.push('No template artifacts (stray labels like Home, Menu, etc.)');

		if (rules.guaranteePhrasing) {
			checks.push(`Guarantee must use exact phrasing: "${rules.guaranteePhrasing}"`);
		}

		return checks;
	}

	validateAdCopy(
		adCopy: { headline: string; subheadline?: string; body_text?: string; callout_texts?: string[]; cta_text: string; gemini_image_prompt: string },
		brand: Brand,
		product: Product,
	): { valid: boolean; errors: string[] } {
		const rules = this.buildRules(brand, product);
		const errors: string[] = [];

		const ctaLower = adCopy.cta_text.toLowerCase().trim();
		const allowedLower = rules.ctaOptions.map(c => c.toLowerCase());
		if (!allowedLower.includes(ctaLower)) {
			errors.push(`Invalid CTA "${adCopy.cta_text}". Must be one of: ${rules.ctaOptions.join(', ')}`);
		}

		for (const banned of rules.bannedCtaList) {
			if (ctaLower === banned.toLowerCase()) {
				errors.push(`Banned CTA detected: "${adCopy.cta_text}"`);
			}
		}

		if (adCopy.headline.split(/\s+/).length > 8) {
			errors.push(`Headline too long: "${adCopy.headline}" (${adCopy.headline.split(/\s+/).length} words, max 8)`);
		}

		if (adCopy.callout_texts) {
			for (const callout of adCopy.callout_texts) {
				if (callout.split(/\s+/).length > 5) {
					errors.push(`Callout too long: "${callout}" (max 4 words)`);
				}
			}
			const unique = new Set(adCopy.callout_texts.map(c => c.toLowerCase()));
			if (unique.size < adCopy.callout_texts.length) {
				errors.push('Duplicate callout texts detected');
			}
		}

		if (/(?:^|[^&])#[0-9a-fA-F]{3,8}/.test(adCopy.gemini_image_prompt)) {
			errors.push('Hex color code found in gemini_image_prompt');
		}

		if (/\d+px|\d+pt|\d+rem|\d+em/i.test(adCopy.gemini_image_prompt)) {
			errors.push('Pixel/point dimensions found in gemini_image_prompt');
		}

		const allText = `${adCopy.headline} ${adCopy.subheadline || ''} ${adCopy.body_text || ''} ${(adCopy.callout_texts || []).join(' ')}`.toLowerCase();

		for (const banned of rules.bannedClaimPatterns) {
			if (allText.includes(banned.toLowerCase())) {
				errors.push(`Banned claim pattern found: "${banned}"`);
			}
		}

		const strayLabels = ['home', 'menu', 'back', 'header', 'footer', 'lorem ipsum', 'sample text'];
		for (const label of strayLabels) {
			if (allText === label || allText.startsWith(`${label} `) || allText.endsWith(` ${label}`)) {
				errors.push(`Template artifact detected: "${label}"`);
			}
		}

		return { valid: errors.length === 0, errors };
	}

	// ── Private builders ─────────────────────────────

	private isEcommerceProduct(product: Product): boolean {
		return !!(product.price_text || product.product_url);
	}

	private buildCtaOptions(isEcommerce: boolean): string[] {
		if (isEcommerce) {
			return ['Shop Now', 'Add to Cart', 'Get Yours'];
		}
		return ['Learn More', 'Get Started', 'Sign Up'];
	}

	private buildBannedCtas(isEcommerce: boolean): string[] {
		if (isEcommerce) {
			return ['Try Free', 'Try Now', 'Learn More', 'Sign Up', 'Download', 'Subscribe'];
		}
		return ['Shop Now', 'Add to Cart', 'Buy Now'];
	}

	private buildBannedClaims(product: Product): string[] {
		const banned = [
			'guaranteed results',
			'works instantly',
			'100% effective',
			'miracle',
			'cure',
			'treat',
			'heal',
			'clinically proven',
			'scientifically proven',
			'doctor recommended',
		];

		const name = product.name.toLowerCase();
		const desc = product.description.toLowerCase();
		const combined = `${name} ${desc}`;

		if (combined.includes('pet') || combined.includes('dog') || combined.includes('cat') || combined.includes('animal')) {
			banned.push('stops barking', 'stops bark', 'cures anxiety', 'eliminates fear');
		}

		if (combined.includes('supplement') || combined.includes('vitamin') || combined.includes('health')) {
			banned.push('cures', 'treats disease', 'prevents illness', 'FDA approved');
		}

		if (combined.includes('skin') || combined.includes('beauty') || combined.includes('cream') || combined.includes('serum')) {
			banned.push('removes wrinkles', 'erases lines', 'instant results', 'permanent change');
		}

		return banned;
	}

	private buildSafeClaims(product: Product): string[] {
		const safe: string[] = [];
		const usps = product.usps || [];

		for (const usp of usps) {
			safe.push(usp);
		}

		const name = product.name.toLowerCase();
		const desc = product.description.toLowerCase();
		const combined = `${name} ${desc}`;

		if (combined.includes('calm') || combined.includes('relax') || combined.includes('stress') || combined.includes('anxiety')) {
			safe.push(
				`Helps support a calmer environment`,
				`Designed to help reduce stress`,
				`Supports relaxation`,
			);
		}

		if (combined.includes('skin') || combined.includes('beauty') || combined.includes('glow')) {
			safe.push(
				'Helps improve appearance',
				'Supports healthier-looking skin',
				'Designed to enhance natural glow',
			);
		}

		if (combined.includes('energy') || combined.includes('focus') || combined.includes('performance')) {
			safe.push(
				'Helps support energy levels',
				'Designed to help with focus',
				'Supports daily performance',
			);
		}

		if (safe.length === 0) {
			safe.push(
				`Designed for ${product.name} users`,
				'Quality you can trust',
				'Built for real results',
			);
		}

		return safe;
	}

	private buildGuaranteePhrasing(product: Product): string {
		const offer = (product.offer_text || '').toLowerCase();

		if (offer.includes('money-back') || offer.includes('moneyback') || offer.includes('guarantee')) {
			return product.offer_text;
		}

		if (offer.includes('day') && offer.includes('guarantee')) {
			return product.offer_text;
		}

		return '';
	}

	private buildReviewTopics(product: Product): string[] {
		const topics: string[] = [];
		const usps = product.usps || [];
		const desc = (product.description || '').toLowerCase();
		const name = (product.name || '').toLowerCase();
		const combined = `${name} ${desc} ${usps.join(' ').toLowerCase()}`;

		for (const usp of usps.slice(0, 5)) {
			const short = usp.length > 40 ? usp.substring(0, 40) + '...' : usp;
			topics.push(`USP-based: "${short}"`);
		}

		topics.push('EASE OF USE: simple, convenient, easy setup');
		topics.push('VALUE: worth the price, great deal');
		topics.push('QUALITY: well-made, premium feel');

		if (combined.includes('pet') || combined.includes('dog') || combined.includes('cat')) {
			topics.push('PET BEHAVIOR: calmer, happier, less stressed');
			topics.push('NIGHTTIME: sleeps better, quieter nights');
		}

		if (combined.includes('skin') || combined.includes('beauty') || combined.includes('hair')) {
			topics.push('VISIBLE RESULTS: noticed a difference');
			topics.push('TEXTURE/FEEL: smoother, softer');
		}

		if (combined.includes('food') || combined.includes('taste') || combined.includes('flavor')) {
			topics.push('TASTE: delicious, love the flavor');
			topics.push('FRESHNESS: always fresh, great quality');
		}

		topics.push('RECOMMENDATION: would recommend to others');
		topics.push('REPEAT PURCHASE: buying again, loyal customer');

		return topics.slice(0, 8);
	}

	private buildAvoidWords(product: Product): string[] {
		const avoid = [
			'finally', 'anxious', 'anxiety', 'recommended', 'comfortable',
			'embarrassing', 'immediately', 'effortless', 'professional',
			'extraordinary', 'revolutionary', 'comprehensive', 'sophisticated',
		];

		const desc = (product.description || '').toLowerCase();
		const name = (product.name || '').toLowerCase();

		if (desc.includes('pheromone') || name.includes('pheromone')) {
			avoid.push('pheromone', 'pheromones');
		}
		if (desc.includes('thunderstorm') || desc.includes('firework')) {
			avoid.push('thunderstorm', 'fireworks');
		}
		if (desc.includes('separation')) {
			avoid.push('separation');
		}
		if (desc.includes('veterinarian')) {
			avoid.push('veterinarian');
		}

		return avoid;
	}

	private buildPreferWords(product: Product): string[] {
		const prefer = [
			'calm', 'safe', 'easy', 'fast', 'works', 'love', 'best',
			'great', 'proof', 'daily', 'trust', 'clean', 'fresh', 'strong',
			'smooth', 'quick', 'smart', 'bold', 'pure',
		];

		const desc = (product.description || '').toLowerCase();
		const name = (product.name || '').toLowerCase();

		if (desc.includes('pet') || name.includes('dog') || name.includes('cat')) {
			prefer.push('calm', 'sleep', 'storm', 'fear', 'bark', 'quiet', 'home', 'vet', 'plug', 'night');
		}
		if (desc.includes('skin') || desc.includes('beauty')) {
			prefer.push('glow', 'soft', 'clear', 'bright', 'smooth', 'radiant');
		}
		if (desc.includes('food') || desc.includes('nutrition')) {
			prefer.push('taste', 'fresh', 'natural', 'organic', 'blend');
		}

		return [...new Set(prefer)];
	}

	private buildToneDescription(brand: Brand): string {
		const tags = brand.voice_tags || [];
		if (tags.length > 0) {
			return `${tags.join(' + ')} — no hype, no absolute guarantees, no aggressive sales language.`;
		}
		return 'Professional + Friendly + Trustworthy — no hype, no absolute guarantees, no aggressive sales language.';
	}
}
