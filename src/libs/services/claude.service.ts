import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { DatabaseService } from '../../database/database.service';
import { Brand } from '../types/brand/brand.type';
import { Product } from '../types/product/product.type';
import { AdConcept } from '../types/concept/concept.type';
import { ClaudeResponseJson, Claude6VariationsResponse } from '../types/generation/generation.type';

@Injectable()
export class ClaudeService {
	private readonly logger = new Logger('ClaudeService');
	private client: Anthropic;

	constructor(
		private configService: ConfigService,
		private databaseService: DatabaseService,
	) {
		this.client = new Anthropic({
			apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
		});
	}

	/**
	 * 6 ta turli variation yaratadi — har biri boshqa headline, angle, visual approach bilan.
	 * Bu asosiy generation flow uchun ishlatiladi.
	 */
	async generate6Variations(
		brand: Brand,
		product: Product,
		concept: AdConcept,
		importantNotes: string,
	): Promise<Claude6VariationsResponse> {
		const systemPrompt = await this.get6VariationsSystemPrompt();
		const userPrompt = this.build6VariationsUserPrompt(brand, product, concept, importantNotes);

		this.logger.log('Sending 6-variations request to Claude API...');

		const response = await this.client.messages.create({
			model: 'claude-sonnet-4-5-20250929',
			max_tokens: 8000,
			messages: [
				{
					role: 'user',
					content: userPrompt,
				},
			],
			system: systemPrompt,
		});

		const textContent = response.content.find((block) => block.type === 'text');
		if (!textContent || textContent.type !== 'text') {
			throw new Error('Claude API did not return text content');
		}

		const parsed = this.parse6VariationsResponse(textContent.text);
		this.logger.log(`Claude API returned ${parsed.variations.length} variations successfully`);
		return parsed;
	}

	/**
	 * Bitta ad copy yaratadi — fixErrors va regenerateSingle uchun ishlatiladi.
	 * Eski generateAdCopy backward compatibility uchun saqlanadi.
	 */
	async generateAdCopy(
		brand: Brand,
		product: Product,
		concept: AdConcept,
		importantNotes: string,
	): Promise<ClaudeResponseJson> {
		const systemPrompt = await this.getSystemPrompt();
		const userPrompt = this.buildUserPrompt(brand, product, concept, importantNotes);

		this.logger.log('Sending single ad request to Claude API...');

		const response = await this.client.messages.create({
			model: 'claude-sonnet-4-5-20250929',
			max_tokens: 2000,
			messages: [
				{
					role: 'user',
					content: userPrompt,
				},
			],
			system: systemPrompt,
		});

		const textContent = response.content.find((block) => block.type === 'text');
		if (!textContent || textContent.type !== 'text') {
			throw new Error('Claude API did not return text content');
		}

		const parsed = this.parseResponse(textContent.text);
		this.logger.log('Claude API response parsed successfully');
		return parsed;
	}

	/**
	 * Fix-Errors: original ad data + error description → yangilangan Gemini prompt
	 */
	async fixAdErrors(
		originalAdCopy: ClaudeResponseJson,
		errorDescription: string,
	): Promise<ClaudeResponseJson> {
		const systemPrompt = `You are an expert Facebook ad creative director. You are fixing errors in a previously generated ad image. The user has described the issues. Your task is to generate an improved version that fixes the reported problems while keeping the same brand message and style.

You MUST respond with valid JSON only, no markdown, no code blocks. The JSON must have these exact fields:
{
  "headline": "Short, punchy headline (max 10 words)",
  "subheadline": "Supporting text (max 15 words)",
  "body_text": "Persuasive body copy (2-3 sentences)",
  "callout_texts": ["Callout 1", "Callout 2", "Callout 3"],
  "cta_text": "Call to action button text",
  "gemini_image_prompt": "Extremely detailed and IMPROVED image generation prompt that fixes the reported issues. Be more specific about layout, text positioning, product placement, and visual quality."
}`;

		const userPrompt = `Fix the following ad creative that has issues.

=== ORIGINAL AD COPY ===
Headline: ${originalAdCopy.headline}
Subheadline: ${originalAdCopy.subheadline}
Body: ${originalAdCopy.body_text}
Callouts: ${originalAdCopy.callout_texts.join(', ')}
CTA: ${originalAdCopy.cta_text}

=== ORIGINAL GEMINI IMAGE PROMPT ===
${originalAdCopy.gemini_image_prompt}

=== USER-REPORTED ISSUES ===
${errorDescription || 'General quality issues — improve text clarity, product placement, and visual consistency.'}

Generate an improved version. Keep the same ad copy/messaging but create a much better gemini_image_prompt that specifically addresses the reported issues. Be very precise about text positioning, font sizes, and layout to avoid rendering errors.`;

		this.logger.log('Sending fix-errors request to Claude API...');

		const response = await this.client.messages.create({
			model: 'claude-sonnet-4-5-20250929',
			max_tokens: 2000,
			messages: [{ role: 'user', content: userPrompt }],
			system: systemPrompt,
		});

		const textContent = response.content.find((block) => block.type === 'text');
		if (!textContent || textContent.type !== 'text') {
			throw new Error('Claude API did not return text content for fix-errors');
		}

		const parsed = this.parseResponse(textContent.text);
		this.logger.log('Claude fix-errors response parsed successfully');
		return parsed;
	}

	/**
	 * 6 Variations uchun system prompt.
	 * Claude dan 6 ta turli creative angle bilan ad copy so'raydi.
	 */
	private async get6VariationsSystemPrompt(): Promise<string> {
		try {
			const { data, error } = await this.databaseService.client
				.from('prompt_templates')
				.select('content')
				.eq('template_type', 'system')
				.eq('is_active', true)
				.order('version', { ascending: false })
				.limit(1)
				.single();

			if (!error && data?.content) {
				this.logger.log('System prompt loaded from DB (6 variations mode)');
				return `${data.content}\n\n${this.get6VariationsJsonSchema()}`;
			}
		} catch {
			this.logger.warn('Failed to load prompt from DB, using fallback (6 variations)');
		}

		return this.getFallback6VariationsSystemPrompt();
	}

	private getFallback6VariationsSystemPrompt(): string {
		return `You are an expert Facebook ad creative director with 15+ years of experience in direct response advertising. You create scroll-stopping static ad creatives that drive conversions. Your ads are on-brand, visually striking, and optimized for the Meta platform.

You MUST generate exactly 6 unique ad creative variations. Each variation should use a DIFFERENT creative angle:

1. **Emotional Appeal** — Focus on feelings, aspirations, transformation
2. **Social Proof** — Leverage reviews, ratings, testimonials, popularity
3. **Problem-Solution** — Highlight the pain point and how the product solves it
4. **Feature Highlight** — Showcase specific product features/ingredients/specs
5. **Urgency/Offer** — Create urgency with deals, limited time, scarcity
6. **Lifestyle/Aspirational** — Show the desired outcome, lifestyle after using the product

For each variation:
- Create a unique headline (different approach, not just rewording)
- Write distinct body copy tailored to that angle
- Design a completely different gemini_image_prompt with different layouts, compositions, and visual treatments
- All variations MUST stay on-brand (same colors, typography style, brand feel)

${this.get6VariationsJsonSchema()}`;
	}

	private get6VariationsJsonSchema(): string {
		return `You MUST respond with valid JSON only, no markdown, no code blocks. The JSON must follow this EXACT structure:
{
  "variations": [
    {
      "headline": "Short, punchy headline (max 10 words)",
      "subheadline": "Supporting text (max 15 words)",
      "body_text": "Persuasive body copy (2-3 sentences)",
      "callout_texts": ["Callout 1", "Callout 2", "Callout 3"],
      "cta_text": "Call to action button text",
      "gemini_image_prompt": "Extremely detailed image generation prompt including: layout, colors, text placement, product photo description, background, style, mood. Must include exact text to overlay on the image."
    }
  ]
}

The "variations" array MUST contain exactly 6 objects. Each object represents one unique ad creative variation.`;
	}

	/**
	 * Single ad uchun system prompt (fixErrors, regenerateSingle uchun).
	 */
	private async getSystemPrompt(): Promise<string> {
		try {
			const { data, error } = await this.databaseService.client
				.from('prompt_templates')
				.select('content')
				.eq('template_type', 'system')
				.eq('is_active', true)
				.order('version', { ascending: false })
				.limit(1)
				.single();

			if (!error && data?.content) {
				this.logger.log('System prompt loaded from DB');
				return `${data.content}

You MUST respond with valid JSON only, no markdown, no code blocks. The JSON must have these exact fields:
{
  "headline": "Short, punchy headline (max 10 words)",
  "subheadline": "Supporting text (max 15 words)",
  "body_text": "Persuasive body copy (2-3 sentences)",
  "callout_texts": ["Callout 1", "Callout 2", "Callout 3"],
  "cta_text": "Call to action button text",
  "gemini_image_prompt": "Extremely detailed image generation prompt including: layout, colors, text placement, product photo description, background, style, mood. Must include exact text to overlay on the image."
}`;
			}
		} catch {
			this.logger.warn('Failed to load prompt from DB, using fallback');
		}

		return this.getFallbackSystemPrompt();
	}

	private getFallbackSystemPrompt(): string {
		return `You are an expert Facebook ad creative director with 15+ years of experience in direct response advertising. You create scroll-stopping static ad creatives that drive conversions. Your ads are on-brand, visually striking, and optimized for the Meta platform.

When generating ads:
1. Analyze the brand voice and visual identity
2. Understand the product's unique selling propositions
3. Study the reference concept and adapt it to the brand
4. Create compelling headlines that stop the scroll
5. Write persuasive body copy that drives action
6. Generate a detailed image prompt for Gemini that includes exact text overlay, positioning, colors, and styling

You MUST respond with valid JSON only, no markdown, no code blocks. The JSON must have these exact fields:
{
  "headline": "Short, punchy headline (max 10 words)",
  "subheadline": "Supporting text (max 15 words)",
  "body_text": "Persuasive body copy (2-3 sentences)",
  "callout_texts": ["Callout 1", "Callout 2", "Callout 3"],
  "cta_text": "Call to action button text",
  "gemini_image_prompt": "Extremely detailed image generation prompt including: layout, colors, text placement, product photo description, background, style, mood. Must include exact text to overlay on the image."
}`;
	}

	/**
	 * 6 ta variation uchun user prompt.
	 */
	private build6VariationsUserPrompt(
		brand: Brand,
		product: Product,
		concept: AdConcept,
		importantNotes: string,
	): string {
		return `Create exactly 6 unique Facebook ad creative variations based on the following:

=== BRAND ===
Name: ${brand.name}
Industry: ${brand.industry}
Description: ${brand.description}
Voice & Tone: ${brand.voice_tags?.join(', ') || 'professional'}
Target Audience: ${brand.target_audience || 'General audience'}
Colors: Primary ${brand.primary_color}, Secondary ${brand.secondary_color}, Accent ${brand.accent_color}, Background ${brand.background_color}
${brand.logo_url ? `Logo URL: ${brand.logo_url}` : ''}
${brand.competitors ? `Competitors: ${brand.competitors}` : ''}

=== PRODUCT ===
Name: ${product.name}
Description: ${product.description}
USPs: ${product.usps?.join(', ') || 'N/A'}
${product.photo_url ? `Product Photo: ${product.photo_url}` : ''}
Price: ${product.price_text || 'N/A'}
Rating: ${product.star_rating ? `${product.star_rating}/5 (${product.review_count || 0} reviews)` : 'N/A'}
${product.offer_text ? `Offer: ${product.offer_text}` : ''}
${product.ingredients_features ? `Features/Ingredients: ${product.ingredients_features}` : ''}
${product.before_description ? `Before: ${product.before_description}` : ''}
${product.after_description ? `After: ${product.after_description}` : ''}

=== CONCEPT STYLE ===
Category: ${concept.category}
Name: ${concept.name}
Description: ${concept.description}
Tags: ${concept.tags?.join(', ') || 'N/A'}
${concept.image_url ? `Reference Image: ${concept.image_url}` : ''}

${importantNotes ? `=== USER NOTES ===\n${importantNotes}` : ''}

Generate EXACTLY 6 unique variations as a JSON object with a "variations" array. Each variation should:
1. Use a DIFFERENT creative angle (emotional, social proof, problem-solution, feature highlight, urgency/offer, lifestyle)
2. Have a unique headline — not just a rewording but a genuinely different approach
3. Include a detailed gemini_image_prompt describing a 1080x1080 static image ad with text overlays, product placement, and the brand's color scheme
4. Each gemini_image_prompt should describe a DIFFERENT visual layout and composition`;
	}

	/**
	 * Single ad uchun user prompt (fixErrors, regenerateSingle uchun).
	 */
	private buildUserPrompt(
		brand: Brand,
		product: Product,
		concept: AdConcept,
		importantNotes: string,
	): string {
		return `Create a Facebook ad creative based on the following:

=== BRAND ===
Name: ${brand.name}
Industry: ${brand.industry}
Description: ${brand.description}
Voice & Tone: ${brand.voice_tags?.join(', ') || 'professional'}
Target Audience: ${brand.target_audience || 'General audience'}
Colors: Primary ${brand.primary_color}, Secondary ${brand.secondary_color}, Accent ${brand.accent_color}, Background ${brand.background_color}
${brand.logo_url ? `Logo URL: ${brand.logo_url}` : ''}
${brand.competitors ? `Competitors: ${brand.competitors}` : ''}

=== PRODUCT ===
Name: ${product.name}
Description: ${product.description}
USPs: ${product.usps?.join(', ') || 'N/A'}
${product.photo_url ? `Product Photo: ${product.photo_url}` : ''}
Price: ${product.price_text || 'N/A'}
Rating: ${product.star_rating ? `${product.star_rating}/5 (${product.review_count || 0} reviews)` : 'N/A'}
${product.offer_text ? `Offer: ${product.offer_text}` : ''}
${product.ingredients_features ? `Features/Ingredients: ${product.ingredients_features}` : ''}
${product.before_description ? `Before: ${product.before_description}` : ''}
${product.after_description ? `After: ${product.after_description}` : ''}

=== CONCEPT STYLE ===
Category: ${concept.category}
Name: ${concept.name}
Description: ${concept.description}
Tags: ${concept.tags?.join(', ') || 'N/A'}
${concept.image_url ? `Reference Image: ${concept.image_url}` : ''}

${importantNotes ? `=== USER NOTES ===\n${importantNotes}` : ''}

Generate the ad creative as JSON. The gemini_image_prompt should be highly detailed, describing a 1080x1080 static image ad with text overlays, product placement, and the brand's color scheme.`;
	}

	/**
	 * 6 ta variation response ni parse qiladi.
	 */
	private parse6VariationsResponse(text: string): Claude6VariationsResponse {
		let jsonStr = text.trim();

		// Code block ichidagi JSON ni ajratib olish
		const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
		if (codeBlockMatch) {
			jsonStr = codeBlockMatch[1].trim();
		}

		const parsed = JSON.parse(jsonStr);

		// "variations" array borligini tekshirish
		if (!parsed.variations || !Array.isArray(parsed.variations)) {
			throw new Error('Claude response missing "variations" array');
		}

		if (parsed.variations.length < 1) {
			throw new Error('Claude response has empty variations array');
		}

		// Har bir variation ni validate qilish
		const required = ['headline', 'subheadline', 'body_text', 'callout_texts', 'cta_text', 'gemini_image_prompt'];
		const validVariations: ClaudeResponseJson[] = [];

		for (let i = 0; i < parsed.variations.length; i++) {
			const v = parsed.variations[i];
			for (const field of required) {
				if (!v[field]) {
					this.logger.warn(`Variation ${i} missing field: ${field}, skipping...`);
					continue;
				}
			}

			validVariations.push({
				headline: v.headline,
				subheadline: v.subheadline,
				body_text: v.body_text,
				callout_texts: v.callout_texts,
				cta_text: v.cta_text,
				gemini_image_prompt: v.gemini_image_prompt,
			});
		}

		if (validVariations.length === 0) {
			throw new Error('No valid variations found in Claude response');
		}

		// Agar 6 tadan kam bo'lsa — log qilish (lekin xato tashlamaslik)
		if (validVariations.length < 6) {
			this.logger.warn(`Claude returned ${validVariations.length} variations instead of 6. Proceeding with available variations.`);
		}

		this.logger.log(`Parsed ${validVariations.length} valid variations from Claude response`);
		return { variations: validVariations };
	}

	/**
	 * Single ad response parse (fixErrors, regenerateSingle uchun).
	 */
	private parseResponse(text: string): ClaudeResponseJson {
		let jsonStr = text.trim();

		const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
		if (codeBlockMatch) {
			jsonStr = codeBlockMatch[1].trim();
		}

		const parsed = JSON.parse(jsonStr);

		const required = ['headline', 'subheadline', 'body_text', 'callout_texts', 'cta_text', 'gemini_image_prompt'];
		for (const field of required) {
			if (!parsed[field]) {
				throw new Error(`Claude response missing required field: ${field}`);
			}
		}

		return {
			headline: parsed.headline,
			subheadline: parsed.subheadline,
			body_text: parsed.body_text,
			callout_texts: parsed.callout_texts,
			cta_text: parsed.cta_text,
			gemini_image_prompt: parsed.gemini_image_prompt,
		};
	}
}
