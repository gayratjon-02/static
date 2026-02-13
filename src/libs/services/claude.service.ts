import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { DatabaseService } from '../../database/database.service';
import { Brand } from '../types/brand/brand.type';
import { Product } from '../types/product/product.type';
import { AdConcept } from '../types/concept/concept.type';
import { ClaudeResponseJson } from '../types/generation/generation.type';

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

	async generateAdCopy(
		brand: Brand,
		product: Product,
		concept: AdConcept,
		importantNotes: string,
	): Promise<ClaudeResponseJson> {
		const systemPrompt = await this.getSystemPrompt();
		const userPrompt = this.buildUserPrompt(brand, product, concept, importantNotes);

		this.logger.log('Sending request to Claude API...');

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
	 * DB'dan aktiv system prompt'ni oladi.
	 * Topilmasa — fallback default prompt ishlatadi.
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
